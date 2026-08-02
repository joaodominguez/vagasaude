from __future__ import annotations

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_district,
    guess_profession,
    html_to_text,
)


class CufScraper(BaseScraper):
    slug = "cuf"
    name = "CUF"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        jobs: list[JobPayload] = []
        url = "https://carreiras.cuf.pt/jobs.json"
        try:
            while url:
                data = client.get_json(url)
                for item in data.get("items", []):
                    posting = item.get("_jobposting") or {}
                    locations = posting.get("jobLocation") or []
                    address = {}
                    if locations:
                        address = (locations[0] or {}).get("address") or {}
                    city = address.get("addressLocality")
                    region = address.get("addressRegion") or city
                    district = guess_district(city, region)
                    description = html_to_text(
                        posting.get("description") or item.get("content_html")
                    )
                    title = item.get("title") or posting.get("title") or "Vaga CUF"
                    company = (
                        (posting.get("hiringOrganization") or {}).get("name") or "CUF"
                    )
                    jobs.append(
                        JobPayload(
                            title=title.strip(),
                            company=company,
                            location_district=district,
                            location_concelho=city,
                            profession=guess_profession(title),
                            specialty=None,
                            sector="privado",
                            contract_type=guess_contract(description[:400]),
                            description=description or title,
                            requirements=None,
                            salary=None,
                            application_url=item.get("url")
                            or f"https://carreiras.cuf.pt/jobs/{item.get('id')}",
                            source=self.slug,
                            source_id=str(
                                ((posting.get("identifier") or {}).get("value"))
                                or item.get("id")
                            ),
                            published_at=item.get("date_published")
                            or posting.get("datePosted"),
                        )
                    )
                url = data.get("next_url")
        finally:
            client.close()
        return jobs
