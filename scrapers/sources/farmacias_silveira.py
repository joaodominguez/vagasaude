"""Farmácias Silveira (Sintra / Cascais) — "Oportunidades de emprego".

A página de recrutamento lista as oportunidades (``.oportunidade-wrapper``
com ``data-oportunidade-id``) e inclui a descrição completa de cada uma num
modal (``.oportunidade-modal.oportunidade-<id>``). Página em ISO-8859-1.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text
from sources._farmacia_pt import PROFESSION, is_pharmacy_role, resolve_place

URL = "https://www.farmaciasilveira.com/institucional/a-farmacia/recrutamento.html"
COMPANY = "Farmácias Silveira"


class FarmaciasSilveiraScraper(BaseScraper):
    slug = "farmacias_silveira"
    name = "Farmácias Silveira — Recrutamento"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        try:
            html = client.get_text(URL)
        finally:
            client.close()
        return parse_page(html)


def parse_page(html: str) -> list[JobPayload]:
    soup = BeautifulSoup(html, "lxml")
    jobs: list[JobPayload] = []
    seen: set[str] = set()
    for wrapper in soup.select(".oportunidade-wrapper"):
        button = wrapper.select_one("[data-oportunidade-id]")
        heading = wrapper.select_one("h5, h4, h3")
        if not button or not heading:
            continue
        opp_id = (button.get("data-oportunidade-id") or "").strip()
        title = re.sub(r"\s+", " ", heading.get_text(" ", strip=True)).strip()
        if not opp_id or opp_id in seen or not is_pharmacy_role(title):
            continue
        seen.add(opp_id)

        places = _places(title)
        place = resolve_place(*places) if places else None
        if not place:
            continue
        district, _ = place
        concelho = " / ".join(places)

        modal = soup.select_one(
            f".oportunidade-modal.oportunidade-{opp_id} .modal-body"
        )
        description = html_to_text(str(modal)) if modal else ""
        description = re.sub(
            r"\n\s*candidatura\s*$", "", description, flags=re.I
        ).strip()
        if len(description) < 80:
            description = title
        header = f"{title}\nFarmácias Silveira — {concelho}"
        jobs.append(
            JobPayload(
                title=title,
                company=COMPANY,
                location_district=district,
                location_concelho=concelho,
                profession=PROFESSION,
                specialty=None,
                sector="privado",
                contract_type=guess_contract(f"{title} {description[:600]}"),
                description=f"{header}\n\n{description}"[:8000],
                requirements=None,
                salary=None,
                application_url=URL,
                source="farmacias_silveira",
                source_id=opp_id,
                published_at=None,
            )
        )
    return jobs


def _places(title: str) -> list[str]:
    """ "Farmacêutico (Sintra & Cascais)" → ["Sintra", "Cascais"]."""
    match = re.search(r"\(([^)]+)\)\s*$", title)
    if not match:
        return []
    return [
        p.strip()
        for p in re.split(r"\s*(?:&|/|,|\be\b)\s*", match.group(1))
        if p.strip()
    ]
