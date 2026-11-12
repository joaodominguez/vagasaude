"""Modello di scraper IT (non registrato in SCRAPERS).

Contratto: `fetch()` restituisce una lista di JobPayload che run.py invia a
POST {INGEST_BASE_URL}/api/ingest. Campi obbligatori nell'app: title,
company, location_district (regione, vedi normalize.guess_district),
application_url e source_id. `sector`: publico | privado | concertado
(valori interni invariati; la UI li mostra come Pubblico | Privato | Accreditato
-- verificare la mappatura in apps/web-it prima di scrivere la prima fonte).

Prima di fare scraping di una fonte: controllare robots.txt e termini d'uso,
identificarsi con lo User-Agent di common/http.py e rispettare il throttle di HttpClient.
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
    name = "Fonte di esempio"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        jobs: list[JobPayload] = []
        try:
            # Esempio con JSON-LD / API JSON:
            # data = client.get_json("https://example.org/jobs.json")
            # for item in data["items"]:
            #     district = guess_district(item.get("city"), item.get("region"))
            #     jobs.append(JobPayload(
            #         title=item["title"],
            #         company="Ente",
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
