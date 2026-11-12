"""Ascires (diagnóstico por imagen / Hospital Ascires, Valencia) — Cornerstone OnDemand career site.

La SPA pública (``ascires.csod.com/ux/ats/careersite/5/home``) incrusta un token anónimo de
solo lectura en el HTML y consulta ``eu-fra.api.csod.com/rec-job-search/external/jobs``; es el
mismo flujo que usa el navegador. robots.txt de csod solo fija ``Crawl-delay: 10`` -> 10 s entre
pedidos (son 2 pedidos por ejecución). Solo funciones sanitarias (se descartan las ``Otros``).
Añadido 2026-11-12.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_district, guess_profession, html_to_text

SITE_ID = 5
HOME = f"https://ascires.csod.com/ux/ats/careersite/{SITE_ID}/home?c=ascires"
API = "https://eu-fra.api.csod.com/rec-job-search/external/jobs"
CRAWL_DELAY = 10.0
PAGE_SIZE = 50
_SKIP = re.compile(r"contab|gesti[oó]n de personal|administrat|recursos humanos|\brrhh\b|marketing", re.I)


def parse_date(value: str | None) -> str | None:
    """'24/9/2026' -> ISO UTC."""
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", (value or "").strip())
    if not m:
        return None
    try:
        return datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)), tzinfo=timezone.utc).isoformat()
    except ValueError:
        return None


def parse_requisition(item: dict, slug: str = "ascires") -> JobPayload | None:
    title = re.sub(r"\s+", " ", item.get("displayJobTitle") or "").strip()
    if not title or _SKIP.search(title):
        return None
    locations = item.get("locations") or []
    if locations and not any((loc.get("country") or "ES").upper() == "ES" for loc in locations):
        return None
    profession = guess_profession(title)
    if profession == "Otros":
        return None
    city = next((loc.get("city") for loc in locations if loc.get("city")), None) or "València"
    district = guess_district(city, None)
    if district == "España":
        district = "Comunidad Valenciana"  # todos los centros Ascires están en Valencia
    description = html_to_text(item.get("externalDescription")) or title
    rid = str(item.get("requisitionId"))
    expires = parse_date(item.get("postingExpirationDate"))
    return JobPayload(
        title=title,
        company="Ascires",
        location_district=district,
        location_concelho=city,
        profession=profession,
        specialty=None,
        sector="privado",
        contract_type=guess_contract(description[:800]),
        description=description[:8000],
        requirements=None,
        salary=None,
        application_url=f"https://ascires.csod.com/ux/ats/careersite/{SITE_ID}/home/requisition/{rid}?c=ascires",
        source=slug,
        source_id=rid,
        published_at=parse_date(item.get("postingEffectiveDate")),
        expires_at=expires[:10] if expires else None,
    )


class AsciresScraper(BaseScraper):
    slug = "ascires"
    name = "Ascires"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=CRAWL_DELAY)
        jobs: list[JobPayload] = []
        try:
            html = client.get_text(HOME)
            m = re.search(r'"token":"([^"]+)"', html)
            if not m:
                raise RuntimeError("ascires: token anónimo no encontrado")
            headers = {"Authorization": f"Bearer {m.group(1)}"}
            page = 1
            while True:
                body = {
                    "careerSiteId": SITE_ID, "careerSitePageId": SITE_ID, "pageNumber": page,
                    "pageSize": PAGE_SIZE, "cultureId": 15, "searchText": "", "cultureName": "es-ES",
                    "states": [], "countryCodes": [], "cities": [], "placeID": "", "radius": None,
                    "postingsWithinDays": None, "customFieldCheckboxKeys": [],
                    "customFieldDropdowns": [], "customFieldRadios": [],
                }
                data = client.post_json(API, body, headers=headers)["data"]
                reqs = data.get("requisitions") or []
                for item in reqs:
                    job = parse_requisition(item, self.slug)
                    if job:
                        jobs.append(job)
                if page * PAGE_SIZE >= int(data.get("totalCount") or 0) or not reqs:
                    break
                page += 1
        finally:
            client.close()
        return jobs
