"""Plantilla de scraper ES (no registrada en SCRAPERS).

Contrato: `fetch()` devuelve una lista de JobPayload que run.py envía a
POST {INGEST_BASE_URL}/api/ingest. Campos obligatorios en la app: title,
company, location_district (comunidad autónoma, ver normalize.guess_district),
application_url y source_id. `sector`: publico | privado | concertado.

Antes de scrapear una fuente: revisar robots.txt y términos de uso, identificarse
con el User-Agent de common/http.py y respetar el throttle de HttpClient.
"""
from __future__ import annotations

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_district,
    guess_profession,
    html_to_text,
)


class ExampleScraper(BaseScraper):
    slug = "example"
    name = "Fuente de ejemplo"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        jobs: list[JobPayload] = []
        try:
            # Ejemplo con JSON-LD / API JSON:
            # data = client.get_json("https://example.org/jobs.json")
            # for item in data["items"]:
            #     district = guess_district(item.get("city"), item.get("region"))
            #     jobs.append(JobPayload(
            #         title=item["title"],
            #         company="Entidad",
            #         location_district=district,
            #         location_concelho=item.get("city"),
            #         profession=guess_profession(item["title"]),
            #         specialty=None,
            #         sector="privado",
            #         contract_type=guess_contract(item.get("employmentType")),
            #         description=html_to_text(item.get("description")),
            #         requirements=None,
            #         salary=None,
            #         application_url=item["url"],
            #         source=self.slug,
            #         source_id=str(item["id"]),
            #         published_at=item.get("datePosted"),
            #     ))
            pass
        finally:
            client.close()
        return jobs
