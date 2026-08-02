from __future__ import annotations

import re

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_district,
    guess_profession,
    html_to_text,
)


class TrofaSaudeScraper(BaseScraper):
    slug = "trofa_saude"
    name = "Trofa Saúde"
    landing_url = "https://recrutamento.grupovnc.com/trofasaude/Pages/LandingPage.aspx"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        try:
            html = client.get_text(self.landing_url)
            token_match = re.search(
                r"webapi\.ashx\?P=([^`\'\"&]+)&Page=\$\{page_counter\}",
                html,
            )
            if not token_match:
                raise RuntimeError("Token da API Trofa Saúde não encontrado.")

            token = token_match.group(1)
            jobs: list[JobPayload] = []
            page = 1
            while page <= 20:
                api_url = (
                    "https://recrutamento.grupovnc.com/trofasaude/framework/webapi.ashx"
                    f"?P={token}&Page={page}&Filters=[]&Keyword=&InputID=&PageSize=50"
                )
                data = client.get_json(api_url)
                batch = data.get("advertisementsList") or []
                if not batch:
                    break
                for item in batch:
                    title = (item.get("Title") or "").strip()
                    if not title:
                        continue
                    city = item.get("LocationDescription")
                    district = guess_district(city)
                    description = html_to_text(item.get("PositionDescription"))
                    if not description:
                        description = html_to_text(item.get("CompanyDescription"))
                    params = item.get("EncriptedParams") or ""
                    application_url = (
                        "https://recrutamento.grupovnc.com/trofasaude/Pages/"
                        f"Advertisement.aspx?P={params}"
                        if params
                        else self.landing_url
                    )
                    jobs.append(
                        JobPayload(
                            title=title,
                            company=item.get("CompanyCodeDescription") or "Trofa Saúde",
                            location_district=district,
                            location_concelho=city,
                            profession=guess_profession(
                                title, item.get("FunctionalAreaDescription")
                            ),
                            specialty=None,
                            sector="privado",
                            contract_type=guess_contract(
                                item.get("WorkLoadDescription")
                            ),
                            description=description or title,
                            requirements=None,
                            salary=None,
                            application_url=application_url,
                            source=self.slug,
                            source_id=str(
                                item.get("AdvertisementEntryNo")
                                or item.get("EntryNo")
                                or item.get("ProcessCode")
                                or title
                            ),
                    published_at=_pick_published_at(item),
                        )
                    )
                if len(batch) < 50:
                    break
                page += 1
            return jobs
        finally:
            client.close()


def _pick_published_at(item: dict) -> str | None:
    from datetime import datetime, timezone

    candidates = [item.get("CreatedAt"), item.get("StartDate")]
    now = datetime.now(timezone.utc)
    parsed: list[datetime] = []
    for value in candidates:
        if not value:
            continue
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        if dt <= now:
            return dt.isoformat()
        parsed.append(dt)
    # Prefer earliest known date even if scheduled in the future.
    if parsed:
        return min(parsed).isoformat()
    return None
