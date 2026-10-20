from __future__ import annotations

import re
from datetime import date
from urllib.parse import quote

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_profession, html_to_text
from sources._pt_boards import (
    block_links,
    decode_cfemails,
    find_pt_place,
    guess_employer,
    guess_sector,
    is_abroad,
    is_recent,
    iso_day,
    parse_pt_date,
    smart_title,
    stable_id,
    text_fragment_url,
    today_utc,
    with_links,
)

BASE = "https://www.ordemenfermeiros.pt"
# "divulgação-de-ofertas-de-emprego" com ç/ã codificados.
PAGE = f"{BASE}/{quote('divulgação-de-ofertas-de-emprego')}/"
BOARD = "Ordem dos Enfermeiros — Ofertas de emprego"
MAX_AGE_DAYS = 60
MIN_TEXT = 80  # ofertas só em imagem (cartaz) não têm texto aproveitável

_PUBLISHED_RE = re.compile(r"Publicad[oa]\s+a\s+([^)<]{6,40})\)?", re.I)
_SPLIT_RE = re.compile(
    r"(?i)(?=<(?:h\d|p)[^>]*>\s*(?:<[^>]+>\s*)*\(\s*Publicad[oa]\s+a\s)"
)
# Primeira linha que já é um título curto ("Enfermeiro(a) para ERPI - Tempo Inteiro").
_TITLE_WORD_RE = re.compile(
    r"enfermeir|t[ée]cnic[oa]|m[ée]dic[oa]|fisioterapeut|auxiliar|cuidador|"
    r"docente|coordenador|diretor|gestor|account\s+manager",
    re.I,
)
_SENTENCE_START_RE = re.compile(
    r"^(?:A|O|As|Os|Estamos|Recrutamos|Procuramos|Pretende|Está|Encontra|Em\s)\b"
)
_SPECIALIST_RE = re.compile(
    r"Especialistas?\s+em\s+Enfermagem\s+(?:de|em)\s+"
    r"((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ]*|e|de|da|do)(?:\s+(?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ]*|e|de|da|do)){0,5})"
)


class OrdemEnfermeirosScraper(BaseScraper):
    slug = "ordem_enfermeiros"
    name = BOARD

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(timeout=40.0, min_interval=0.5)
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
        try:
            html = client.get_text(PAGE)
        finally:
            client.close()
        return [_to_payload(item, self.slug) for item in parse_ordem_enfermeiros(html)]


def parse_ordem_enfermeiros(
    html: str, today: date | None = None, max_age_days: int = MAX_AGE_DAYS
) -> list[dict]:
    """Página da OE → ofertas recentes em Portugal (só as que têm texto)."""
    today = today or today_utc()
    html = decode_cfemails(html)
    soup = BeautifulSoup(html, "lxml")
    content = soup.select_one(".imagerichtxt") or soup.select_one("#left_col") or soup
    items: list[dict] = []
    seen: set[str] = set()
    for chunk in _SPLIT_RE.split(content.decode_contents()):
        m = _PUBLISHED_RE.search(html_to_text(chunk)[:120])
        if not m:
            continue
        published = parse_pt_date(m.group(1))
        if not is_recent(published, today, max_age_days):
            continue
        body = re.sub(
            r"(?is)^\s*<(h\d|p)[^>]*>.*?\(\s*Publicad[oa]\s+a[^)]*\).*?</\1>", "", chunk, count=1
        )
        text = html_to_text(body)
        text = re.sub(r"(?m)^[\s_]{5,}$|_{5,}", "", text)
        text = re.sub(r"(?m)^\s*p>\s*$", "", text)  # lixo de HTML partido na fonte
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        # Bolsa da OE: tudo é enfermagem; só descarta cartazes sem texto.
        if len(text) < MIN_TEXT:
            continue
        paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
        first = paragraphs[0]
        if is_abroad(first, text):
            continue
        place = find_pt_place(first, text)
        district, concelho = place if place else ("Portugal", None)
        employer = guess_employer("", paragraphs)
        title = _title(first, text, concelho)
        source_id = stable_id(published.isoformat(), text[:300], prefix="oe-")
        if source_id in seen:
            continue
        seen.add(source_id)
        links = block_links(body, BASE)
        description = with_links(
            f"Publicado a {published.strftime('%d/%m/%Y')}\n\n{text}", links
        )
        offer_link = next((u for u in links if u.startswith("http")), None)
        items.append(
            {
                "title": title,
                "company": employer or BOARD,
                "district": district,
                "concelho": concelho,
                "description": description,
                "published_at": iso_day(published),
                "application_url": offer_link or text_fragment_url(PAGE, _fragment_text(body)),
                "source_id": source_id,
            }
        )
    return items


def _title(first_line: str, text: str, concelho: str | None) -> str:
    line = re.sub(r"\s+", " ", first_line).strip(" -–:")
    if (
        len(line) <= 100
        and _TITLE_WORD_RE.search(line)
        and not line.endswith((".", ":", ";"))
        and not _SENTENCE_START_RE.match(line)
    ):
        return smart_title(line)
    role = "Enfermeiro(a)"
    spec = _SPECIALIST_RE.search(text[:1500])
    if spec:
        role = f"Enfermeiro(a) Especialista em {spec.group(1).strip()}"
    return f"{role} — {concelho}" if concelho else role


def _fragment_text(body_html: str) -> str:
    soup = BeautifulSoup(body_html, "lxml")
    for el in soup.find_all(["p", "li", "td", "div"]):
        txt = re.sub(r"\s+", " ", el.get_text("", strip=False)).strip()
        if len(txt) > 15:
            return txt
    return ""


def _to_payload(item: dict, slug: str) -> JobPayload:
    title = item["title"]
    return JobPayload(
        title=title,
        company=item["company"],
        location_district=item["district"],
        location_concelho=item["concelho"],
        profession=guess_profession(title, fallback="enfermeiro"),
        specialty=None,
        sector=guess_sector(f"{item['company']} {item['description'][:1500]}"),
        contract_type=guess_contract(item["description"][:1500]),
        description=item["description"],
        requirements=None,
        salary=None,
        application_url=item["application_url"],
        source=slug,
        source_id=item["source_id"],
        published_at=item["published_at"],
    )
