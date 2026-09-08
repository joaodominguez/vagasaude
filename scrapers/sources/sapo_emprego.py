from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_district,
    guess_profession,
    html_to_text,
)

BASE = "https://emprego.sapo.pt"
LIST_URL = f"{BASE}/offers"
# Categoria saúde tem ~1000 anúncios; limitamos páginas + filtro clínico.
MAX_PAGES = 25
MAX_AGE_DAYS = 30

# Pesquisas clínicas extra (apanham cauda além da 1.ª página genérica).
TEXT_QUERIES = [
    "enfermeiro",
    "enfermeira",
    "fisioterapeuta",
    "farmacêutico",
    "farmaceutico",
    "técnico de farmácia",
    "auxiliar de ação médica",
    "auxiliar de saude",
    "médico",
    "medico",
    "terapeuta da fala",
    "terapeuta ocupacional",
    "psicólogo",
    "psicologo",
    "nutricionista",
]

CLINICAL_RE = re.compile(
    r"enferm|fisioterap|terapeuta|farmaceut|farm[aá]cia|\btaf\b|"
    r"m[eé]dic|auxiliar\s+de\s+(?:a[cç][aã]o\s+m[eé]dica|sa[uú]de|lar)|"
    r"t[eé]cnic[oa].{0,20}(?:sa[uú]de|radiolog|an[aá]lis|cardiopneum|"
    r"patologia|farm)|psicolog|nutric|dietista|odontolog|estomatolog|"
    r"radiolog|imagiolog|ortopt|podolog|osteopat|massagista\s+de\s+reabil|"
    r"cuidados\s+paliativos|ucci|lar\s+de\s+idosos|resid[eê]ncia\s+s[eé]nior",
    re.I,
)

SKIP_RE = re.compile(
    r"veterin[aá]r|renda\s+extra|part-time\s+em\s+casa|call\s*center|"
    r"customer\s+service|tech\s+support|order\s+and\s+tech|"
    r"tratamento\s+de\s+res[ií]duos|comercial\s+puro|"
    r"motorista(?!\s+de\s+ambul)",
    re.I,
)

FOREIGN_RE = re.compile(
    r"angola|fran[cç]a|franca|holanda|alemanha|espanha|su[ií]ca|suica|"
    r"b[eé]lgica|belgica|reino\s+unido|irlanda|emirados|dubai|qatar",
    re.I,
)


class SapoEmpregoScraper(BaseScraper):
    slug = "sapo_emprego"
    name = "SAPO Emprego — Saúde"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(timeout=45.0, min_interval=0.4)
        try:
            client.client.headers.update(
                {
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/124.0.0.0 Safari/537.36"
                    ),
                    "Accept-Language": "pt-PT,pt;q=0.9",
                }
            )
            listings = self._collect_listings(client)
            cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
            jobs: list[JobPayload] = []
            seen: set[str] = set()

            for item in listings:
                source_id = item["id"]
                if source_id in seen:
                    continue
                seen.add(source_id)
                if not _is_relevant(item):
                    continue
                published = item.get("publication_date")
                if published:
                    try:
                        dt = datetime.fromisoformat(f"{published}T00:00:00+00:00")
                        if dt < cutoff:
                            continue
                    except ValueError:
                        pass

                detail_html = ""
                link = item.get("link") or ""
                if link:
                    try:
                        detail_html = client.get_text(link)
                    except Exception:  # noqa: BLE001
                        detail_html = ""

                job = _to_job(item, detail_html)
                if job:
                    jobs.append(job)
            return jobs
        finally:
            client.close()

    def _collect_listings(self, client: HttpClient) -> list[dict]:
        by_id: dict[str, dict] = {}
        for page in range(1, MAX_PAGES + 1):
            for item in self._list_page(client, categoria="saude", pagina=page):
                by_id.setdefault(item["id"], item)
        for text in TEXT_QUERIES:
            for page in range(1, 4):
                for item in self._list_page(
                    client,
                    categoria="saude",
                    pesquisa=text,
                    pagina=page,
                ):
                    by_id.setdefault(item["id"], item)
        return list(by_id.values())

    def _list_page(
        self,
        client: HttpClient,
        *,
        categoria: str | None = None,
        pesquisa: str | None = None,
        pagina: int = 1,
    ) -> list[dict]:
        params: dict[str, str] = {}
        if categoria:
            params["categoria"] = categoria
        if pesquisa:
            params["pesquisa"] = pesquisa
        if pagina > 1:
            params["pagina"] = str(pagina)
        url = f"{LIST_URL}?{urlencode(params)}" if params else LIST_URL
        try:
            html = client.get_text(url)
        except Exception:  # noqa: BLE001
            return []
        return _parse_list_offers(html)


def _parse_list_offers(html: str) -> list[dict]:
    marker = ":offers='["
    start = html.find(marker)
    if start < 0:
        return []
    try:
        data, _ = json.JSONDecoder().raw_decode(html, start + len(":offers='"))
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    out: list[dict] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        offer_id = item.get("id")
        title = (item.get("offer_name") or "").strip()
        if not offer_id or not title:
            continue
        out.append(
            {
                "id": str(offer_id),
                "title": title,
                "company": (item.get("company_name") or "").strip()
                or "Empresa anunciante (SAPO Emprego)",
                "district": (item.get("job_district") or "").strip(),
                "municipality": (item.get("job_municipality") or "").strip(),
                "location": (item.get("location") or "").strip(),
                "country": (item.get("job_country") or "").strip() or "Portugal",
                "description": (item.get("job_description") or "").strip(),
                "work_hours": (item.get("job_work_hours") or "").strip(),
                "publication_date": (item.get("publication_date") or "").strip(),
                "link": (item.get("link") or "").strip(),
                "anonymous": bool(item.get("anonymous")),
            }
        )
    return out


def _is_relevant(item: dict) -> bool:
    country = (item.get("country") or "Portugal").strip().lower()
    if country and country != "portugal":
        return False
    title = item.get("title") or ""
    blob = f"{title}\n{item.get('description') or ''}"
    if SKIP_RE.search(title) or SKIP_RE.search(blob[:400]):
        return False
    if FOREIGN_RE.search(title):
        return False
    return bool(CLINICAL_RE.search(title) or CLINICAL_RE.search(blob[:500]))


def _detail_description(html: str) -> tuple[str, str | None]:
    if not html:
        return "", None
    soup = BeautifulSoup(html, "lxml")
    description = ""
    requirements = None
    for h3 in soup.select("h3"):
        label = h3.get_text(" ", strip=True).lower()
        sib = h3.find_next_sibling()
        if not sib:
            continue
        text = sib.get_text("\n", strip=True)
        if not text:
            continue
        if "descri" in label and "fun" in label:
            description = text
        elif label.startswith("requisito"):
            requirements = text
    if not description:
        pre = soup.select_one("p.pre-formatted")
        if pre:
            description = pre.get_text("\n", strip=True)
    return description, requirements


def _salary_from_detail(html: str) -> str | None:
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")
    el = soup.select_one(".salary, [class*='salary']")
    if not el:
        return None
    value = re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip()
    if not value or value.lower() in {"a definir", "não especificado", "nao especificado"}:
        return None
    return value


def _to_job(item: dict, detail_html: str) -> JobPayload | None:
    title = item["title"]
    detail_desc, detail_req = _detail_description(detail_html)
    description = detail_desc or item.get("description") or title
    description = html_to_text(description) if "<" in description else description
    description = description.strip() or title

    requirements = None
    if detail_req:
        # Normaliza "* item" do SAPO para "- item"
        req_lines = []
        for line in detail_req.splitlines():
            line = line.strip()
            if not line:
                continue
            line = re.sub(r"^\*\s*", "- ", line)
            if not line.startswith("-"):
                line = f"- {line}"
            req_lines.append(line)
        requirements = "\n".join(req_lines) if req_lines else None

    locality = item.get("municipality") or item.get("location") or item.get("district") or ""
    district = guess_district(locality, item.get("district") or "")
    if not district or district == "Portugal":
        district = guess_district(item.get("district") or locality) or "Lisboa"

    contract = None
    hours = (item.get("work_hours") or "").lower()
    if "part" in hours:
        contract = "Tempo parcial"
    elif "full" in hours:
        contract = "Tempo inteiro"
    if not contract:
        contract = guess_contract(f"{title} {description[:400]}")

    company = item.get("company") or "Empresa anunciante (SAPO Emprego)"
    if item.get("anonymous"):
        company = "Empresa confidencial (SAPO Emprego)"

    published_at = None
    if item.get("publication_date"):
        published_at = f"{item['publication_date']}T00:00:00+00:00"

    link = item.get("link") or f"{BASE}/offers?id={item['id']}"
    salary = _salary_from_detail(detail_html)

    return JobPayload(
        title=title,
        company=company,
        location_district=district,
        location_concelho=locality or None,
        profession=guess_profession(title, description[:240]),
        specialty=None,
        sector="privado",
        contract_type=contract,
        description=description[:8000],
        requirements=requirements,
        salary=salary,
        application_url=link,
        source="sapo_emprego",
        source_id=item["id"],
        published_at=published_at,
    )
