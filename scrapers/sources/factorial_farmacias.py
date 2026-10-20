"""Grupos de farmácias com portal de carreiras Factorial HR (*.factorialhr.pt).

A página inicial lista as ofertas (``li.job-offer-item``) com o id da
localização; cada oferta tem página própria com a descrição completa
(``div.styledText``) e metadados (contrato, horário, localidade).
"""

from __future__ import annotations

import re
from html import unescape

import httpx
from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text
from sources._farmacia_pt import PROFESSION, is_pharmacy_role, resolve_place

_REGIME = re.compile(
    r"^\s*(tempo\s+(inteiro|parcial|integral)|full[\s-]*time|part[\s-]*time)\s*$", re.I
)


class FactorialPharmacyScraper(BaseScraper):
    slug: str
    name: str
    subdomain: str
    company: str

    @property
    def base_url(self) -> str:
        return f"https://{self.subdomain}.factorialhr.pt"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        try:
            listing = client.get_text(f"{self.base_url}/")
            for item in _parse_listing(listing):
                if not is_pharmacy_role(item["title"]):
                    continue
                try:
                    detail = client.get_text(item["url"])
                except httpx.HTTPError:
                    detail = ""
                job = self._to_job(item, detail)
                if job:
                    jobs.append(job)
        finally:
            client.close()
        return jobs

    def _to_job(self, item: dict, detail_html: str) -> JobPayload | None:
        meta, description = _parse_detail(detail_html)
        parts = [p.strip() for p in item["title"].split("|") if p.strip()]
        regime = next((p for p in parts if _REGIME.match(p)), None)
        title_parts = [p for p in parts if p is not regime]
        title = " – ".join(title_parts) or item["title"]

        location = meta.get("location")
        place = resolve_place(location, item.get("location"), *title_parts[1:])
        if not place:
            return None
        district, concelho = place

        if len(description) < 80:
            description = item["title"]
        contract_text = " ".join(
            filter(
                None,
                [
                    item["title"],
                    regime,
                    meta.get("schedule"),
                    meta.get("contract"),
                    description[:400],
                ],
            )
        )
        return JobPayload(
            title=title,
            company=self.company,
            location_district=district,
            location_concelho=concelho,
            profession=PROFESSION,
            specialty=None,
            sector="privado",
            contract_type=guess_contract(contract_text)
            or (
                "Tempo inteiro"
                if "integral" in (meta.get("schedule") or "").lower()
                else None
            ),
            description=description[:8000],
            requirements=None,
            salary=None,
            application_url=item["url"],
            source=self.slug,
            source_id=item["source_id"],
            published_at=None,
        )


def _parse_listing(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    locations = {
        (opt.get("value") or "").strip(): opt.get_text(" ", strip=True)
        for opt in soup.select("option[value]")
    }
    items: list[dict] = []
    seen: set[str] = set()
    for li in soup.select("li.job-offer-item[data-job-postings-url]"):
        url = (li.get("data-job-postings-url") or "").strip()
        if not url or url in seen:
            continue
        seen.add(url)
        heading = li.select_one(".factorial__headingFontFamily") or li
        title = re.sub(r"\s+", " ", unescape(heading.get_text(" ", strip=True))).strip()
        slug = url.rstrip("/").rsplit("/", 1)[-1]
        match = re.search(r"-(\d+)$", slug)
        items.append(
            {
                "url": url,
                "title": title,
                "location": locations.get((li.get("data-location-id") or "").strip()),
                "source_id": match.group(1) if match else slug,
            }
        )
    return items


def _parse_detail(html: str) -> tuple[dict, str]:
    if not html:
        return {}, ""
    soup = BeautifulSoup(html, "lxml")
    meta: dict[str, str] = {}
    values = [
        span.get_text(" ", strip=True)
        for span in soup.select("li span.inline-block.align-middle")
    ]
    for value in values:
        low = value.lower()
        if "portugal" in low and "location" not in meta:
            meta["location"] = value
        elif re.search(r"tempo|time|parcial|integral", low) and "schedule" not in meta:
            meta["schedule"] = value
        elif "contract" not in meta and value and "location" not in meta:
            meta["contract"] = value
    body = soup.select_one("div.styledText")
    description = html_to_text(str(body)) if body else ""
    return meta, description.strip()


class FarmaciasCuidoScraper(FactorialPharmacyScraper):
    slug = "farmacias_cuido"
    name = "Farmácias Cuido (Factorial)"
    subdomain = "farmaciascuido"
    company = "Farmácias Cuido"


class QuatroFarmaScraper(FactorialPharmacyScraper):
    slug = "farmacias_4farma"
    name = "4Farma Shee — Farmácias (Factorial)"
    subdomain = "4farma"
    company = "4Farma Shee"
