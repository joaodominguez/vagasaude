from __future__ import annotations

import re

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_district,
    guess_profession,
    html_to_text,
)

BASE = "https://recrutamento.jcs.pt"
LOCATION_RE = re.compile(
    r"Distrito:\s*([^,]+?)(?:,\s*Concelho:\s*(.+))?$",
    re.IGNORECASE,
)


class JoaquimChavesScraper(BaseScraper):
    slug = "joaquim_chaves"
    name = "Joaquim Chaves Saúde"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        try:
            items = self._list_offers(client)
            jobs: list[JobPayload] = []
            for item in items:
                title = (item.get("Title") or "").strip()
                offer_id = (item.get("Id") or "").strip()
                if not title or not offer_id:
                    continue

                district, concelho = _parse_location(item.get("Location") or "")
                brief = html_to_text(item.get("Brief") or item.get("Description"))
                description = self._fetch_description(client, offer_id) or brief or title
                contract = _guess_jcs_contract(
                    title,
                    item.get("ProcessParameters"),
                    description,
                )
                application_url = f"{BASE}/OfferDetails?id={offer_id}"
                jobs.append(
                    JobPayload(
                        title=title,
                        company="Joaquim Chaves Saúde",
                        location_district=guess_district(concelho, district),
                        location_concelho=concelho or district,
                        profession=guess_profession(title, brief),
                        specialty=None,
                        sector="privado",
                        contract_type=contract,
                        description=description,
                        requirements=None,
                        salary=None,
                        application_url=application_url,
                        source=self.slug,
                        source_id=str(item.get("Code") or offer_id),
                        published_at=None,
                    )
                )
            return jobs
        finally:
            client.close()

    def _list_offers(self, client: HttpClient) -> list[dict]:
        page = 1
        page_size = 50
        items: list[dict] = []
        while page <= 20:
            data = client.post_json(
                f"{BASE}/GetOffersFiltered",
                {
                    "SortColumn": "UpdateDate",
                    "SortOrderAsc": False,
                    "PageNumber": page,
                    "PageSize": page_size,
                    "FiltersEx": [],
                },
            )
            batch = data.get("list") or []
            if not batch:
                break
            items.extend(batch)
            total = int(data.get("count") or 0)
            if len(items) >= total or len(batch) < page_size:
                break
            page += 1
        return items

    def _fetch_description(self, client: HttpClient, offer_id: str) -> str:
        html = client.get_text(f"{BASE}/OfferDetails?id={offer_id}")
        match = re.search(
            r'<div[^>]*class="[^"]*harpoon-offer-desc[^"]*"[^>]*>(.*?)</div>',
            html,
            re.IGNORECASE | re.DOTALL,
        )
        if not match:
            return ""
        return html_to_text(match.group(1))


def _parse_location(raw: str) -> tuple[str | None, str | None]:
    cleaned = html_to_text(raw).strip()
    match = LOCATION_RE.search(cleaned)
    if not match:
        return None, cleaned or None
    district = (match.group(1) or "").strip() or None
    concelho = (match.group(2) or "").strip() or None
    return district, concelho


def _guess_jcs_contract(
    title: str,
    process_parameters: str | None,
    description: str,
) -> str | None:
    params = process_parameters or ""
    blob = f"{title}\n{description[:500]}".lower()
    if "[P2:V1]" in params or "part-time" in blob or "part time" in blob:
        return "Tempo parcial"
    if "prestação de serviços" in blob or "prestacao de servicos" in blob:
        return "Prestação de serviços"
    if "[P2:V2]" in params:
        return "Tempo inteiro"
    if "turno" in blob:
        return "Turnos"
    if "sem termo" in blob or "40 horas" in blob or "full-time" in blob:
        return "Tempo inteiro"
    if "substitui" in blob:
        return "Contrato"
    return None
