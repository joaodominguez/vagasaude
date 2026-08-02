from __future__ import annotations

import re
from datetime import datetime
from html import unescape

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_district,
    guess_profession,
    html_to_text,
)

BASE = "https://www.fchampalimaud.org"
OFFERS_URL = f"{BASE}/get-offers"
LIST_URL = f"{BASE}/pt-pt/posicoes-em-aberto"

CLOSED_MARKERS = (
    "call is now closed",
    "this call is now closed",
    "recruitment process for this call is now closed",
    "candidatura encerrada",
    "processo de recrutamento para este concurso encontra-se encerrado",
    "o processo de recrutamento para este anúncio encontra-se encerrado",
)

MONTHS = {
    "jan": 1,
    "fev": 2,
    "mar": 3,
    "abr": 4,
    "mai": 5,
    "mayo": 5,
    "jun": 6,
    "jul": 7,
    "ago": 8,
    "set": 9,
    "out": 10,
    "nov": 11,
    "dez": 12,
}


class ChampalimaudScraper(BaseScraper):
    slug = "champalimaud"
    name = "Champalimaud"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.35)
        try:
            items = self._list_offers(client)
            jobs: list[JobPayload] = []
            for item in items:
                job = self._to_job(client, item)
                if job:
                    jobs.append(job)
            return jobs
        finally:
            client.close()

    def _list_offers(self, client: HttpClient) -> list[dict]:
        # O endpoint devolve listas cumulativas; usamos a última página completa.
        last: list[dict] = []
        for pager in range(1, 20):
            data = client.post_json(
                OFFERS_URL,
                {"pager": str(pager), "areas": [], "lang": "pt-pt"},
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                },
            )
            batch = data.get("data") or []
            if not batch:
                break
            last = batch
            if data.get("hiddenButton"):
                break

        by_id: dict[str, dict] = {}
        for item in last:
            offer_id = str(item.get("id") or "").strip()
            if offer_id:
                by_id[offer_id] = item
        return list(by_id.values())

    def _to_job(self, client: HttpClient, item: dict) -> JobPayload | None:
        url = (item.get("url") or "").strip()
        title = (item.get("title") or "").strip()
        offer_id = str(item.get("id") or "").strip()
        if not url or not title or not offer_id:
            return None

        html = client.get_text(url)
        if _is_closed(html):
            return None

        meta = _parse_meta(html)
        area = (item.get("area") or {}).get("name") or ""
        location = meta.get("Localização") or "Lisboa"
        district = guess_district(location, "Lisboa")
        employer = meta.get("Entidade Empregadora") or meta.get("Employer") or ""
        company = (
            "Fundação Champalimaud"
            if "champalimaud" in employer.lower() or not employer
            else employer
        )
        position = meta.get("Posição") or area
        contract = guess_contract(meta.get("Regime") or "")
        description = _extract_description(html) or html_to_text(
            meta.get("og:description") or title
        )
        published_at = _parse_champ_date(item.get("date") or meta.get("Início da Candidatura"))

        return JobPayload(
            title=title,
            company=company,
            location_district=district,
            location_concelho=_concelho_from_location(location, district),
            profession=guess_profession(f"{title} {position}"),
            specialty=position or None,
            sector="privado",
            contract_type=contract,
            description=description,
            requirements=None,
            salary=None,
            application_url=url,
            source=self.slug,
            source_id=offer_id,
            published_at=published_at,
        )


def _is_closed(html: str) -> bool:
    lowered = html.lower()
    return any(marker in lowered for marker in CLOSED_MARKERS)


def _concelho_from_location(location: str, district: str) -> str:
    # Campus Champalimaud / Botton ficam em Lisboa.
    lowered = location.lower()
    if "champalimaud" in lowered or "lisboa" in lowered or "lisbon" in lowered:
        return "Lisboa"
    if location and location != district:
        return location
    return district or "Lisboa"


def _parse_meta(html: str) -> dict[str, str]:
    meta: dict[str, str] = {}
    og = re.search(
        r'property="og:description"\s+content="([^"]+)"',
        html,
        re.I,
    )
    if og:
        meta["og:description"] = unescape(og.group(1))

    for label, value in re.findall(
        r"<strong>([^:<][^<]*?):\s*</strong>\s*([^<]+)",
        html,
        re.I,
    ):
        key = re.sub(r"\s+", " ", unescape(label)).strip()
        val = re.sub(r"\s+", " ", unescape(value)).strip()
        if key and val:
            meta[key] = val
    return meta


def _extract_description(html: str) -> str:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")
    # O corpo da oferta vive em div.description (inclui a meta + texto).
    block = soup.select_one("div.description")
    if block:
        for junk in block.select(".offers-list-info, .offers-share, script, style"):
            junk.decompose()
        text = html_to_text(str(block))
        if text and len(text) > 80:
            return text[:8000]

    for sel in (
        ".offers-description",
        ".field--name-body",
        ".node__content",
    ):
        node = soup.select_one(sel)
        if not node:
            continue
        text = html_to_text(str(node))
        if text and len(text) > 80:
            return text[:8000]

    og = soup.select_one('meta[property="og:description"]')
    if og and og.get("content"):
        return html_to_text(unescape(og["content"]))[:8000]
    return ""


def _parse_champ_date(value: str | None) -> str | None:
    if not value:
        return None
    # Examples: "25 Maio. 2026", "31 Jul. 2026", "01 Mar. 2026"
    match = re.search(
        r"(\d{1,2})\s*([A-Za-zçÇ\.]+)\s*(\d{4})",
        value,
    )
    if not match:
        return None
    day = int(match.group(1))
    month_raw = re.sub(r"[^A-Za-z]", "", match.group(2)).lower()[:3]
    year = int(match.group(3))
    month = MONTHS.get(month_raw)
    if not month:
        return None
    try:
        return datetime(year, month, day).strftime("%Y-%m-%dT00:00:00+00:00")
    except ValueError:
        return None
