from __future__ import annotations

from datetime import datetime, timedelta, timezone

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_district, guess_profession, html_to_text, norm
from sources._ats_pt import contract_from, resolve_pt_place

# Ofertas abertas há mais de 12 meses são anúncios "perpétuos" (ex.: 2021) — ignorar.
MAX_AGE = timedelta(days=365)


class AffideaScraper(BaseScraper):
    slug = "affidea"
    name = "Affidea"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        try:
            data = client.get_json("https://affideaportugal.recruitee.com/api/offers/")
        finally:
            client.close()

        now = datetime.now(timezone.utc)
        jobs: list[JobPayload] = []
        for offer in data.get("offers", []):
            title = (offer.get("title") or "").strip()
            if not title or offer.get("status") != "published":
                continue
            if (offer.get("country_code") or "").upper() != "PT":
                continue
            if "candidatura espontanea" in norm(title):
                continue
            published = _parse_date(offer.get("published_at") or offer.get("created_at"))
            if published and now - published > MAX_AGE:
                continue

            # Cidade antes do distrito: Almada vem com state "Lisboa".
            city = offer.get("city")
            place = resolve_pt_place(city)
            if place:
                district, concelho = place
            else:
                district, concelho = guess_district(offer.get("state_name")), None
            if district == "Portugal":
                continue

            description = html_to_text(offer.get("description"))
            requirements = html_to_text(offer.get("requirements")) or None
            jobs.append(
                JobPayload(
                    title=title,
                    company="Affidea",
                    location_district=district,
                    location_concelho=concelho,
                    profession=guess_profession(title),
                    specialty=None,
                    sector="privado",
                    contract_type=_contract(offer.get("employment_type_code"))
                    or contract_from(title, description),
                    description=description or title,
                    requirements=requirements,
                    salary=None,
                    application_url=offer.get("careers_url")
                    or f"https://affideaportugal.recruitee.com/o/{offer.get('slug')}",
                    source=self.slug,
                    source_id=str(offer.get("id")),
                    published_at=published.isoformat() if published else None,
                )
            )
        return jobs


def _parse_date(value: str | None) -> datetime | None:
    # Formato Recruitee: "2026-10-19 16:22:30 UTC"
    if not value:
        return None
    try:
        return datetime.strptime(value.replace(" UTC", ""), "%Y-%m-%d %H:%M:%S").replace(
            tzinfo=timezone.utc
        )
    except ValueError:
        return None


def _contract(code: str | None) -> str | None:
    code = (code or "").lower()
    if code.startswith("parttime"):
        return "Tempo parcial"
    if code.startswith("fulltime"):
        return "Tempo inteiro"
    return None
