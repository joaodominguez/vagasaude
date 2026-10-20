from __future__ import annotations

import re
from datetime import date

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_profession, html_to_text
from sources._pt_boards import (
    decode_cfemails,
    find_pt_place,
    guess_employer,
    is_abroad,
    is_recent,
    iso_day,
    parse_pt_date,
    smart_title,
    stable_id,
    text_fragment_url,
    today_utc,
)

PAGE = "https://www.omv.pt/bolsa-de-emprego"
BOARD = "Ordem dos Médicos Veterinários — Bolsa de Emprego"
MAX_AGE_DAYS = 60


class OmvScraper(BaseScraper):
    slug = "omv"
    name = BOARD

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(timeout=40.0, min_interval=0.5)
        try:
            html = client.get_text(PAGE)
        finally:
            client.close()
        return [_to_payload(item, self.slug) for item in parse_omv(html)]


def parse_omv(
    html: str, today: date | None = None, max_age_days: int = MAX_AGE_DAYS
) -> list[dict]:
    """Página da bolsa → ofertas recentes em Portugal (dicts simples, sem rede)."""
    today = today or today_utc()
    soup = BeautifulSoup(decode_cfemails(html), "lxml")
    items: list[dict] = []
    seen: set[str] = set()
    for box in soup.select("[id^=accordion_]"):
        # Cada acordeão é uma área ("Animais de companhia e equinos", "Espécies pecuárias"…).
        area_el = box.find(["h3", "h4"])
        area = smart_title(area_el.get_text(" ", strip=True)) if area_el else ""
        for panel in box.select(".panel"):
            heading = panel.select_one(".panel-title")
            body = panel.select_one(".panel-body")
            if not heading:
                continue
            head = re.sub(r"\s+", " ", heading.get_text(" ", strip=True))
            title, _, date_txt = head.rpartition("|")
            title = title.strip(" |-–") or head
            published = parse_pt_date(date_txt) or parse_pt_date(head)
            if not is_recent(published, today, max_age_days):
                continue
            text = html_to_text(body.decode_contents()) if body else ""
            if is_abroad(title, text):
                continue
            paragraphs = [p for p in text.split("\n") if p.strip()]
            place = find_pt_place(title, text)
            district, concelho = place if place else ("Portugal", None)
            employer = guess_employer(title, paragraphs)
            source_id = stable_id(title, published.isoformat(), prefix="omv-")
            if source_id in seen:
                continue
            seen.add(source_id)
            description = "\n\n".join(
                part
                for part in (
                    f"Área: {area}" if area else "",
                    f"Publicado a {published.strftime('%d/%m/%Y')}",
                    text or title,
                )
                if part
            )
            items.append(
                {
                    "title": _clean_title(title),
                    "company": employer or BOARD,
                    "district": district,
                    "concelho": concelho,
                    "description": description,
                    "published_at": iso_day(published),
                    "application_url": text_fragment_url(PAGE, title),
                    "source_id": source_id,
                    "area": area,
                }
            )
    return items


def _clean_title(title: str) -> str:
    title = re.sub(r"^(?:oferta\s+de\s+emprego|vaga)\s*[:–-]\s*", "", title, flags=re.I)
    title = re.sub(r"\s+", " ", title).strip(" -–|")
    return smart_title(title)


def _to_payload(item: dict, slug: str) -> JobPayload:
    title = item["title"]
    return JobPayload(
        title=title,
        company=item["company"],
        location_district=item["district"],
        location_concelho=item["concelho"],
        profession=guess_profession(title, fallback="médico veterinário"),
        specialty=None,
        sector="privado",
        contract_type=guess_contract(f"{title} {item['description'][:600]}"),
        description=item["description"],
        requirements=None,
        salary=None,
        application_url=item["application_url"],
        source=slug,
        source_id=item["source_id"],
        published_at=item["published_at"],
    )
