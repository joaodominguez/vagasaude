from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timedelta, timezone
from html import unescape
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    CITY_TO_DISTRICT,
    guess_contract,
    guess_district,
    guess_profession,
    html_to_text,
    norm,
)

BASE = "https://www.net-empregos.com"
# A pesquisa `pesquisa-empregos.asp?chaves=` está em Disallow no robots.txt;
# só a listagem da categoria é usada.
LEGACY_LIST_URL = f"{BASE}/emprego-saude-medicina-enfermagem.asp"
RSS_URL = f"{BASE}/rss.asp"
# HTML só como complemento: o arquivo tem dezenas de páginas.
MAX_PAGES = 8
MAX_AGE_DAYS = 14
HEALTH_CATEGORY = "saude medicina enfermagem"

# RSS geral só traz ~30 de saúde (últimos 1000 de todas as categorias).
# Pesquisas `?q=` devolvem feeds focados e contornam o login da listagem HTML.
RSS_QUERIES = [
    "enfermeiro",
    "enfermeira",
    "enfermagem",
    "fisioterapeuta",
    "fisioterapia",
    "farmaceutico",
    "farmacia",
    "medico",
    "medicina",
    "auxiliar de saude",
    "tecnico de saude",
    "radiologia",
    "analises clinicas",
    "terapeuta da fala",
    "terapeuta ocupacional",
    "psicologo",
    "nutricionista",
    "assistente dentario",
    "dentista",
    "cuidador",
    "ajudante familiar",
    "higienista",
    "optometrista",
    "audiologista",
    "cardiopneumologia",
    "ortoptista",
]

ALLOWED_PROFESSIONS = {
    "Enfermagem",
    "Medicina",
    "Farmácia",
    "Fisioterapia",
    "Técnico de Saúde",
    "Auxiliares",
    "Psicologia",
    "Nutrição",
    "Assistência Social",
    "Administrativo",
    "Gestão & suporte",
}

FOREIGN_RE = re.compile(
    r"\b("
    r"estrangeiro|irlanda|ireland|suica|switzerland|belgica|belgium|"
    r"alemanha|germany|franca|france|espanha|spain|holanda|nederland|"
    r"luxemburgo|reino\s+unido|united\s+kingdom|\buk\b|emirados|dubai|"
    r"qatar|suica|italia|italy"
    r")\b",
    re.I,
)
SKIP_TITLE_RE = re.compile(
    r"veterinar|naturopat|homeopat|pilates|"
    r"sess[oõ]es?\s+online|recrutamento\s+internacional|"
    r"massagista|esteticista|animador|sociocultural|"
    r"sales representative",
    re.I,
)
AGENCY_CODE_RE = re.compile(r"\s*\[[0-9]+(?:-[0-9]+)+\]\s*$")
AGENCY_SPAM_RE = re.compile(
    r"\b(amplia|flexon talents|aa euro portugal)\b",
    re.I,
)
JOB_ID_RE = re.compile(r"(?:net-empregos\.com)?/(\d{5,})(?:/|$)", re.I)
DATE_RE = re.compile(r"\b(\d{1,2})-(\d{1,2})-(\d{4})\b")
SALARY_RE = re.compile(
    r"(\d[\d.\s]*\s*€(?:\s*[–-]\s*\d[\d.\s]*\s*€)?(?:\s*/\s*ano)?)",
    re.I,
)
ANON_RE = re.compile(r"^an[oó]nim[oa]?s?$", re.I)

# Se o scrape falhar parcialmente, não soft-expirar o inventário inteiro.
MIN_JOBS_FOR_SOFT_EXPIRE = 40

# Descrição completa da página de detalhe (o RSS corta a ~250 caracteres).
# Só activo com NET_EMPREGOS_DETAIL_CACHE (corrido fora do VPS: o IP do VPS
# recebe a página de login). Cache por sourceId: cada vaga é pedida uma vez.
DETAIL_CACHE_ENV = "NET_EMPREGOS_DETAIL_CACHE"
DETAIL_MAX_FETCHES = int(os.environ.get("NET_EMPREGOS_MAX_DETAILS", "200"))
DETAIL_MIN_INTERVAL = 2.5
DETAIL_MIN_CHARS = 300
DETAIL_CACHE_TTL_DAYS = 60
DETAIL_MAX_CONSECUTIVE_FAILURES = 3
# O site limita as páginas de detalhe por IP sem sessão (depois mostra o login).
# Ao primeiro login pára — não insistir num limite de acesso.
DETAIL_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/141.0 Safari/537.36"
)


class NetEmpregosScraper(BaseScraper):
    slug = "net_empregos"
    name = "Net-Empregos — Saúde / Medicina / Enfermagem"
    # Consumido por run.py / api_client para decidir soft-expire.
    last_listings_complete: bool = False

    def fetch(self) -> list[JobPayload]:
        self.last_listings_complete = False
        listings = self._fetch_html_listings()
        rss_by_id = _fetch_rss_health_by_queries()
        merged = _merge_items(listings, rss_by_id)
        cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
        jobs: list[JobPayload] = []
        seen: set[str] = set()

        for item in merged:
            source_id = item["source_id"]
            if source_id in seen:
                continue
            seen.add(source_id)

            if _should_skip(item):
                continue
            published = item.get("published_at")
            if published:
                try:
                    dt = datetime.fromisoformat(published.replace("Z", "+00:00"))
                    if dt < cutoff:
                        continue
                except ValueError:
                    pass

            rss = rss_by_id.get(source_id)
            job = _to_job(item, rss)
            if job:
                jobs.append(job)

        # HTML costuma estar atrás de login no VPS; o RSS multi-query é a fonte
        # completa. Soft-expire só quando temos um lote suficientemente grande.
        self.last_listings_complete = len(jobs) >= MIN_JOBS_FOR_SOFT_EXPIRE
        cache_path = os.environ.get(DETAIL_CACHE_ENV)
        if cache_path:
            _enrich_with_details(jobs, cache_path)
        return jobs

    def _fetch_html_listings(self) -> list[dict]:
        """Tenta a listagem HTML; devolve [] se o IP for mandado para login."""
        client = HttpClient(min_interval=0.45)
        try:
            for base in (LEGACY_LIST_URL,):
                html = _http_list_page(client, base, 1)
                if not _is_real_listing(html):
                    continue
                items = _parse_listing(html)
                for page in range(2, MAX_PAGES + 1):
                    page_html = _http_list_page(client, base, page)
                    if not _is_real_listing(page_html):
                        break
                    items.extend(_parse_listing(page_html))
                if items:
                    return items
            return []
        finally:
            client.close()


def _http_list_page(client: HttpClient, base: str, page: int) -> str:
    if page <= 1:
        url = base
    elif "?" in base:
        url = f"{base}&page={page}"
    else:
        url = f"{base}?page={page}"
    try:
        return client.get_text(url)
    except httpx.HTTPError:
        return ""


def _is_real_listing(html: str) -> bool:
    if not html:
        return False
    if "Login de Candidato" in html or "loginc.asp" in html.lower():
        return False
    return html.lower().count("job-item") >= 5


def _parse_listing(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    items: list[dict] = []
    for card in soup.select("div.job-item"):
        link = card.select_one("h2 a.oferta-link")
        if not link:
            continue
        href = (link.get("href") or "").strip()
        source_id = _id_from_url(href)
        if not source_id:
            continue
        title = re.sub(r"\s+", " ", link.get_text(" ", strip=True)).strip()
        if not title:
            continue
        place, company, date_raw = _card_meta(card)
        items.append(
            {
                "title": title,
                "company": company or "Anónimo",
                "place": place,
                "date_raw": date_raw,
                "published_at": _parse_date(date_raw),
                "url": urljoin(BASE + "/", href.lstrip("/")),
                "source_id": source_id,
            }
        )
    return items


def _card_meta(card) -> tuple[str, str, str]:
    place = company = date_raw = ""
    for li in card.select(".job-ad-item li"):
        text = re.sub(r"\s+", " ", li.get_text(" ", strip=True)).strip()
        html = str(li)
        if "flaticon-calendar" in html or re.match(r"^\d{1,2}-\d{1,2}-\d{4}$", text):
            date_raw = text
        elif "flaticon-pin" in html:
            place = text
        elif "flaticon-work" in html or (
            li.get("style") and "font-weight:bold" in str(li.get("style"))
        ):
            company = text
        elif not company and text and "Saúde" not in text and "Medicina" not in text:
            if "bold" in html:
                company = text
    if not company:
        bold = card.select_one('.job-ad-item li[style*="font-weight"]')
        if bold:
            company = re.sub(r"\s+", " ", bold.get_text(" ", strip=True)).strip()
    return place, company, date_raw


def _fetch_rss_health_by_queries() -> dict[str, dict]:
    """Junta vários RSS `?q=` e mantém só a categoria Saúde."""
    by_id: dict[str, dict] = {}
    # Feed geral (sem q) ainda apanha cauda recente.
    for query in [None, *RSS_QUERIES]:
        try:
            params = {"q": query} if query else None
            response = httpx.get(
                RSS_URL,
                params=params,
                headers={
                    "User-Agent": "VagaSaudeBot/1.0 (+https://vagasaude.pt/bot)",
                    "Accept": "application/rss+xml, application/xml, text/xml, */*",
                },
                timeout=60.0,
                follow_redirects=True,
            )
            response.raise_for_status()
            text = response.content.decode("iso-8859-1", "replace")
        except httpx.HTTPError:
            continue

        for chunk in re.findall(r"<item>(.*?)</item>", text, re.S | re.I):
            link_match = re.search(r"<link>\s*(.*?)\s*</link>", chunk, re.I | re.S)
            source_id = _id_from_url(link_match.group(1) if link_match else "")
            if not source_id or source_id in by_id:
                continue
            desc_match = re.search(
                r"<description><!\[CDATA\[(.*?)\]\]></description>",
                chunk,
                re.S | re.I,
            )
            raw_desc = unescape(unescape(desc_match.group(1))) if desc_match else ""
            category = _rss_field(raw_desc, "Categoria")
            if HEALTH_CATEGORY not in norm(category):
                continue
            by_id[source_id] = {
                "description": _clean_rss_description(raw_desc),
                "company": _rss_field(raw_desc, "Empresa"),
                "place": _rss_field(raw_desc, "Zona"),
                "date_raw": _rss_field(raw_desc, "Data"),
                "title": _cdata(chunk, "title"),
                "url": (link_match.group(1).strip() if link_match else ""),
            }
    return by_id


def _merge_items(listings: list[dict], rss_by_id: dict[str, dict]) -> list[dict]:
    by_id: dict[str, dict] = {item["source_id"]: item for item in listings}
    for source_id, rss in rss_by_id.items():
        if source_id in by_id:
            existing = by_id[source_id]
            if not existing.get("company") or ANON_RE.match(existing.get("company") or ""):
                existing["company"] = rss.get("company") or existing.get("company")
            if not existing.get("place"):
                existing["place"] = rss.get("place") or ""
            if not existing.get("published_at"):
                existing["published_at"] = _parse_date(rss.get("date_raw") or "")
            continue
        by_id[source_id] = {
            "title": rss.get("title") or "",
            "company": rss.get("company") or "Anónimo",
            "place": rss.get("place") or "",
            "date_raw": rss.get("date_raw") or "",
            "published_at": _parse_date(rss.get("date_raw") or ""),
            "url": rss.get("url") or f"{BASE}/{source_id}/",
            "source_id": source_id,
        }
    return list(by_id.values())


def _rss_field(html: str, label: str) -> str:
    match = re.search(
        rf"(?:<b>|&lt;b&gt;)\s*{re.escape(label)}\s*:\s*(?:</b>|&lt;/b&gt;)\s*([^<]+)",
        html,
        re.I,
    )
    return re.sub(r"\s+", " ", unescape(match.group(1))).strip() if match else ""


def _cdata(chunk: str, tag: str) -> str:
    match = re.search(
        rf"<{tag}><!\[CDATA\[(.*?)\]\]></{tag}>",
        chunk,
        re.S | re.I,
    )
    if match:
        return unescape(match.group(1)).strip()
    match = re.search(rf"<{tag}>(.*?)</{tag}>", chunk, re.S | re.I)
    return unescape(re.sub(r"<[^>]+>", " ", match.group(1))).strip() if match else ""


def _clean_rss_description(html: str) -> str:
    text = html_to_text(html)
    parts = re.split(r"\bDescri[cç][aã]o:\s*", text, maxsplit=1, flags=re.I)
    if len(parts) == 2:
        text = parts[1]
    text = re.split(r"\bVer Oferta de Emprego\b", text, maxsplit=1)[0].strip()
    return text[:8000]


def _should_skip(item: dict) -> bool:
    blob = " ".join(
        [
            item.get("title") or "",
            item.get("company") or "",
            item.get("place") or "",
        ]
    )
    key = norm(blob)
    place_key = norm(item.get("place") or "")
    if "estrangeiro" in place_key or "todas as zonas" in place_key:
        return True
    if FOREIGN_RE.search(key):
        return True
    if SKIP_TITLE_RE.search(item.get("title") or ""):
        return True
    if AGENCY_SPAM_RE.search(item.get("company") or ""):
        return True
    profession = guess_profession(item.get("title") or "")
    if profession not in ALLOWED_PROFESSIONS:
        return True
    return False


def _to_job(item: dict, rss: dict | None) -> JobPayload | None:
    title = AGENCY_CODE_RE.sub("", (item.get("title") or "").strip()).strip()
    company = (item.get("company") or "").strip() or "Anónimo"
    place = (item.get("place") or "").strip()
    if rss:
        title = title or AGENCY_CODE_RE.sub("", rss.get("title") or "").strip()
        company = (
            company
            if company and not ANON_RE.match(company)
            else (rss.get("company") or company)
        )
        place = place or rss.get("place") or ""
    if not title:
        return None

    description = (rss or {}).get("description") or _fallback_description(
        title, company, place
    )
    district = guess_district(place, f"{title} {description[:280]}")
    profession = guess_profession(title)
    if profession not in ALLOWED_PROFESSIONS:
        return None

    anonymous = bool(ANON_RE.match(company))
    return JobPayload(
        title=title,
        company=company,
        location_district=district,
        location_concelho=_concelho(place, district, title),
        profession=profession,
        specialty=None,
        sector="privado",
        contract_type=guess_contract(f"{title} {description[:400]}"),
        description=description,
        requirements=None,
        salary=_salary(title, description),
        application_url=item["url"],
        source="net_empregos",
        source_id=item["source_id"],
        published_at=item.get("published_at")
        or _parse_date((rss or {}).get("date_raw") or ""),
        status="pending_review" if anonymous else "published",
        review_reason="Empresa anónima no Net-Empregos" if anonymous else None,
    )


def _load_detail_cache(path: str) -> dict[str, dict]:
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _save_detail_cache(path: str, cache: dict[str, dict]) -> None:
    cutoff = (
        datetime.now(timezone.utc) - timedelta(days=DETAIL_CACHE_TTL_DAYS)
    ).isoformat()
    kept = {k: v for k, v in cache.items() if (v.get("fetched_at") or "") >= cutoff}
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(kept, fh, ensure_ascii=False)
    os.replace(tmp, path)


def _is_login_wall(html: str) -> bool:
    return "JobPosting" not in html and (
        "loginc.asp" in html.lower() or "Login de Candidato" in html
    )


def _parse_detail_description(html: str) -> str | None:
    """Descrição da página de detalhe: JSON-LD JobPosting, senão div.job-description."""
    if _is_login_wall(html):
        return None
    for raw in re.findall(
        r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html, re.S | re.I
    ):
        try:
            data = json.loads(raw, strict=False)
        except ValueError:
            continue
        for node in data if isinstance(data, list) else [data]:
            if isinstance(node, dict) and node.get("@type") == "JobPosting":
                text = _strip_detail_footer(html_to_text(node.get("description") or ""))
                if text:
                    return text
    soup = BeautifulSoup(html, "lxml")
    box = soup.select_one("div.job-description")
    if not box:
        return None
    for junk in box.select("script, style, ins, iframe, [id^=div-gpt], .adsbygoogle"):
        junk.decompose()
    text = re.sub(r"\n{3,}", "\n\n", box.get_text("\n", strip=True))
    text = re.sub(r"^Detalhe da Oferta:\s*", "", text, flags=re.I)
    return text.strip() or None


def _strip_detail_footer(text: str) -> str:
    """Remove o rodapé técnico do JSON-LD ("net_empregos_2" e o URL do anúncio)."""
    lines = text.strip().splitlines()
    while lines and (
        not lines[-1].strip()
        or re.fullmatch(r"net_empregos_\d+", lines[-1].strip())
        or re.fullmatch(r"https?://(?:www\.)?net-empregos\.com/\S*", lines[-1].strip())
    ):
        lines.pop()
    return "\n".join(lines).strip()


def _enrich_with_details(jobs: list[JobPayload], cache_path: str) -> None:
    """Troca o excerto do RSS pela descrição completa (cache + pedidos novos espaçados)."""
    cache = _load_detail_cache(cache_path)
    fetched = failures = enriched = 0
    last_request = 0.0
    blocked = False
    # Mais recentes primeiro: com o limite do site, os pedidos vão para as vagas novas.
    ordered = sorted(jobs, key=lambda job: job.published_at or "", reverse=True)
    with httpx.Client(
        timeout=30.0,
        follow_redirects=True,
        headers={"User-Agent": DETAIL_UA, "Accept-Language": "pt-PT,pt;q=0.9"},
    ) as client:
        for job in ordered:
            entry = cache.get(job.source_id)
            if not entry:
                if (
                    blocked
                    or fetched >= DETAIL_MAX_FETCHES
                    or failures >= DETAIL_MAX_CONSECUTIVE_FAILURES
                ):
                    continue
                wait = DETAIL_MIN_INTERVAL - (time.monotonic() - last_request)
                if wait > 0:
                    time.sleep(wait)
                last_request = time.monotonic()
                fetched += 1
                try:
                    response = client.get(job.application_url)
                    response.raise_for_status()
                    # windows-1252 (superconjunto de ISO-8859-1: "–", "€" em 0x80–0x9F)
                    html = response.content.decode("cp1252", "replace")
                except httpx.HTTPError:
                    html = ""
                if html and _is_login_wall(html):
                    blocked = True
                    continue
                text = _parse_detail_description(html) if html else None
                if not text:
                    # Página sem descrição: tenta-se noutra execução.
                    failures += 1
                    continue
                failures = 0
                # Anúncios curtos também ficam em cache (não voltar a pedir).
                entry = {
                    "description": text[:8000],
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }
                cache[job.source_id] = entry
            if len(entry["description"]) <= len(job.description or ""):
                continue
            job.description = entry["description"]
            job.salary = job.salary or _salary(job.title, job.description)
            job.contract_type = job.contract_type or guess_contract(
                f"{job.title} {job.description[:600]}"
            )
            enriched += 1
    _save_detail_cache(cache_path, cache)
    print(
        f"[net_empregos] detalhe: {enriched}/{len(jobs)} com descrição completa "
        f"({fetched} pedidos novos, cache {len(cache)}"
        f"{', parou no login do site' if blocked else ''})"
    )


def _fallback_description(title: str, company: str, place: str) -> str:
    lines = [title, "", f"Empresa: {company}"]
    if place:
        lines.append(f"Local: {place}")
    lines.append("")
    lines.append("Candidatura através do Net-Empregos.")
    return "\n".join(lines)


def _concelho(place: str, district: str, title: str = "") -> str | None:
    for value in (place, title):
        cleaned = re.sub(r"\s+", " ", (value or "").strip())
        if not cleaned:
            continue
        key = norm(cleaned)
        if "estrangeiro" in key or "todas as zonas" in key:
            continue
        if key != norm(district):
            for city, mapped in CITY_TO_DISTRICT.items():
                if mapped == district and city in key and city != norm(district):
                    return city.title() if len(city) > 3 else cleaned[:80]
            if key != norm(district) and value == place:
                return cleaned[:80]
    return None


def _salary(*parts: str) -> str | None:
    blob = " ".join(p for p in parts if p)
    match = SALARY_RE.search(blob)
    if not match:
        return None
    return re.sub(r"\s+", " ", match.group(1)).strip()


def _parse_date(raw: str | None) -> str | None:
    if not raw:
        return None
    match = DATE_RE.search(raw)
    if not match:
        return None
    day, month, year = (int(match.group(1)), int(match.group(2)), int(match.group(3)))
    try:
        return datetime(year, month, day, tzinfo=timezone.utc).isoformat().replace(
            "+00:00", "Z"
        )
    except ValueError:
        return None


def _id_from_url(url: str) -> str | None:
    match = JOB_ID_RE.search(url or "")
    return match.group(1) if match else None
