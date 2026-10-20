from __future__ import annotations

import re

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_district, guess_profession, html_to_text, norm
from sources._ats_pt import resolve_pt_place

# O widget Workable da Unilabs é global (PT, NL, ES, UK) e cheio de funções de suporte.
CLINICAL_RE = re.compile(
    r"tecnic.*(analises|laborat|radiolog|cardiop)|fisic[oa] medic|medical physicist"
    r"|medic|enfermeir|nurse|farmac|pharmac|biolog|patolog|patholog|radiograph"
)
NON_CLINICAL_PROFESSIONS = {"Outros", "Administrativo", "Gestão & suporte"}


class UnilabsScraper(BaseScraper):
    slug = "unilabs"
    name = "Unilabs"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        try:
            data = client.get_json(
                "https://apply.workable.com/api/v1/widget/accounts/unilabs?details=true"
            )
        finally:
            client.close()

        jobs: list[JobPayload] = []
        for item in data.get("jobs", []):
            title = (item.get("title") or "").strip()
            if not title:
                continue
            profession = guess_profession(title)
            if not CLINICAL_RE.search(norm(title)) and profession in NON_CLINICAL_PROFESSIONS:
                continue
            place = _portugal_place(item)
            if not place:
                continue
            district, concelho = place
            if profession in NON_CLINICAL_PROFESSIONS:
                # Ex.: "Medical Physicist" — diagnóstico, não cai nas regras do normalize.
                profession = "Técnico de Saúde"

            description = html_to_text(item.get("description"))
            jobs.append(
                JobPayload(
                    title=title,
                    company="Unilabs",
                    location_district=district,
                    location_concelho=concelho,
                    profession=profession,
                    specialty=None,
                    sector="privado",
                    contract_type=guess_contract(item.get("employment_type") or title),
                    description=description or title,
                    requirements=None,
                    salary=None,
                    application_url=item.get("url") or item.get("shortlink"),
                    source=self.slug,
                    source_id=str(item.get("shortcode")),
                    published_at=item.get("published_on") or item.get("created_at"),
                )
            )
        return jobs


def _portugal_place(item: dict) -> tuple[str, str | None] | None:
    locations = item.get("locations") or [
        {"country": item.get("country"), "city": item.get("city"), "region": item.get("state")}
    ]
    for loc in locations:
        if (loc.get("countryCode") or "").upper() != "PT" and norm(loc.get("country") or "") != "portugal":
            continue
        # region vem como "Porto District"
        region = re.sub(r"(?i)\s*district$", "", loc.get("region") or "")
        place = resolve_pt_place(loc.get("city"), region)
        if place:
            return place
        district = guess_district(region)
        if district != "Portugal":
            return district, None
    return None
