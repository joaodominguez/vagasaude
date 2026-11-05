"""Colisée España (residencias): ofertas del WordPress REST /wp-json/wp/v2/oferta (~4); solo clínicas."""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text, norm

from ._es_common import es_profession, iso_date
from ._private_es import is_health_role, region_with_fallback

API_URL = "https://colisee.es/wp-json/wp/v2/oferta?per_page=100"
COMPANY = "Colisée"
# is_health_role da por sanitario "Técnico/a Superior en Prevención de Riesgos Laborales" (no es clínico).
_NOT_CLINICAL_RE = re.compile(r"prevencion de riesgos|riesgos laborales|\bprl\b")


def parse_content(html: str) -> tuple[str, str | None]:
    """(descripción, requisitos) de la plantilla de oferta; ignora el formulario con el listado de centros."""
    soup = BeautifulSoup(html or "", "html.parser")
    rich = soup.select_one(".oferta-descripcion .oferta-rich")
    kicker = soup.select_one(".oferta-descripcion .oferta-kicker")
    description = html_to_text(str(rich)) if rich else ""
    if kicker and description:
        description = f"{kicker.get_text(' ', strip=True)}\n\n{description}"
    req = soup.select_one(".oferta-requisitos")
    requirements = None
    if req:
        for h in req.find_all(["h2", "h3"]):
            h.decompose()
        requirements = html_to_text(str(req)) or None
    return description, requirements


class ColiseeScraper(BaseScraper):
    slug = "colisee"
    name = "Colisée — Ofertas de empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        try:
            offers = client.get_json(API_URL)
        finally:
            client.close()
        jobs: list[JobPayload] = []
        for offer in offers:
            title = html_to_text((offer.get("title") or {}).get("rendered")).strip()
            link = offer.get("link") or ""
            if not title or not link or not is_health_role(title) or _NOT_CLINICAL_RE.search(norm(title)):
                continue
            description, requirements = parse_content((offer.get("content") or {}).get("rendered"))
            jobs.append(JobPayload(
                title=title,
                company=COMPANY,
                # Ofertas genéricas para los centros de toda España (el formulario elige centro).
                location_district=region_with_fallback(None, None, title=title),
                location_concelho=None,
                profession=es_profession(title),
                specialty=None,
                sector="privado",
                contract_type=guess_contract(title) or guess_contract(description[:1500]),
                description=description or title,
                requirements=requirements,
                salary=None,
                application_url=link,
                source=self.slug,
                source_id=str(offer.get("id") or offer.get("slug")),
                published_at=iso_date(offer.get("date_gmt")),
            ))
        return jobs
