"""Clínica Corachan (Barcelona): ofertas activas de https://www.corachan.com/es/trabaja-con-nosotros_7992.

Cada oferta es un PDF; la web pide enviar el CV por correo, así que application_url = la página.
robots.txt: Crawl-delay 10 (se respeta con min_interval=10; el scraper hace una sola petición).
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import norm

from ._es_common import es_profession
from ._private_es import is_health_role

PAGE_URL = "https://www.corachan.com/es/trabaja-con-nosotros_7992"
COMPANY = "Clínica Corachan"
EMAIL = "seleccionrrhh@corachan.com"

# Los títulos "Vacante ..." vienen en minúsculas y sin tildes: se normalizan los habituales.
_FIXES = {
    "vacante enfermeria": "Enfermero/a",
    "vacante enfermero ref hospitalizacion": "Enfermero/a – Hospitalización",
    "vacante graduados enfermeria": "Graduado/a en Enfermería",
    "vacante matron@": "Matrón/a",
    "vacante medico pediatra": "Médico/a pediatra",
}


def clean_title(raw: str) -> str:
    raw = re.sub(r"\s+", " ", raw).strip()
    fixed = _FIXES.get(norm(raw))
    if fixed:
        return fixed
    t = re.sub(r"^vacante\s+", "", raw, flags=re.I)
    return t[:1].upper() + t[1:]


def parse_listing(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for section in soup.select("section.PublishableListing"):
        heading = section.find(["h2", "h3"])
        if "ofertas activas" not in norm(heading.get_text(" ", strip=True) if heading else section.get_text(" ", strip=True)[:40]):
            continue
        for a in section.select("a.publishable_link[href]"):
            m = re.search(r"_(\d+)\.pdf", a["href"])
            if m:
                out.append({"id": m.group(1), "raw": a.get_text(" ", strip=True), "pdf": a["href"]})
    return out


class CorachanScraper(BaseScraper):
    slug = "corachan"
    name = "Clínica Corachan — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=10.0)
        try:
            rows = parse_listing(client.get_text(PAGE_URL))
        finally:
            client.close()
        if not rows:
            raise RuntimeError("Corachan: listado de ofertas activas vacío (¿cambió el maquetado?)")
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        for row in rows:
            title = clean_title(row["raw"])
            if row["id"] in seen or not is_health_role(title):
                continue
            seen.add(row["id"])
            jobs.append(JobPayload(
                title=title,
                company=COMPANY,
                location_district="Cataluña",
                location_concelho="Barcelona",
                profession=es_profession(title),
                specialty=None,
                sector="privado",
                contract_type=None,
                description=(
                    f"{title} en Clínica Corachan (Barcelona).\n\n"
                    f"Ficha completa de la oferta (PDF): {row['pdf']}\n"
                    f"Candidaturas: envía tu currículum a {EMAIL}."
                ),
                requirements=None,
                salary=None,
                application_url=PAGE_URL,
                source=self.slug,
                source_id=row["id"],
                published_at=None,
            ))
        return jobs
