"""Mutua Navarra: vacantes en pestañas de https://www.mutuanavarra.es/unete-a-nuestro-equipo.

La web no tiene URL por oferta (todas las descripciones están en la misma página, en pestañas
Divi): application_url = página + ancla con el slug del título, y source_id = ese slug.
Mutua colaboradora con la Seguridad Social (entidad privada sin ánimo de lucro) -> "concertado".
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text, norm

from ._es_common import es_profession
from ._private_es import is_health_role

PAGE_URL = "https://www.mutuanavarra.es/unete-a-nuestro-equipo"
COMPANY = "Mutua Navarra"


def slugify(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", norm(title)).strip("-")


def parse_vacancies(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    tabs = soup.select_one(".et_pb_tabs")
    if not tabs:
        return []
    titles = [li.get_text(" ", strip=True) for li in tabs.select("ul.et_pb_tabs_controls > li")]
    panels = tabs.select(".et_pb_all_tabs > .et_pb_tab")
    out = []
    for title, panel in zip(titles, panels):
        if not title or "espontanea" in norm(title):
            continue
        out.append({"title": title, "description": html_to_text(str(panel.select_one(".et_pb_tab_content") or panel))})
    return out


class MutuaNavarraScraper(BaseScraper):
    slug = "mutua_navarra"
    name = "Mutua Navarra — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        try:
            vacancies = parse_vacancies(client.get_text(PAGE_URL))
        finally:
            client.close()
        if not vacancies:
            raise RuntimeError("Mutua Navarra: sin vacantes en la página (¿cambió el maquetado?)")
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        for vac in vacancies:
            title = vac["title"]
            source_id = slugify(title)
            if source_id in seen or not is_health_role(title):
                continue
            seen.add(source_id)
            description = vac["description"]
            jobs.append(JobPayload(
                title=title,
                company=COMPANY,
                location_district="Navarra",
                location_concelho="Pamplona",
                profession=es_profession(title),
                specialty=None,
                sector="concertado",
                contract_type=guess_contract(description[:3000]),
                description=description or title,
                requirements=None,
                salary=None,
                application_url=f"{PAGE_URL}#{source_id}",
                source=self.slug,
                source_id=source_id,
                published_at=None,
            ))
        return jobs
