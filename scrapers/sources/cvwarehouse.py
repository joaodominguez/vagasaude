from __future__ import annotations

import json
import re
from html import unescape
from urllib.parse import urljoin

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_district,
    guess_profession,
    html_to_text,
)

LUZ_GUID = "5498d2b5-b889-48e2-b434-d850c72bc42e"
LUSIADAS_GUID = "af1a9847-a9ab-4cd7-904e-d48470afea9a"
HOLON_GUID = "1037b978-b846-4df6-98ad-b3cc4d24f206"
HOLON_DERMO_GUID = "30536c2b-6af6-429a-b468-9f4c37ffe8d3"

JOB_BLOCK_PATTERN = re.compile(
    r'<div data-item-collection="jobCollection-[^"]+"([^>]*)>([\s\S]*?)'
    r'(?=<div data-item-collection="jobCollection-|\Z)'
)
SECTION_PATTERN = re.compile(
    r'[?&](?:amp;)?section=([0-9a-fA-F-]{36})',
)
COMPANY_PATTERN = re.compile(
    r"\b("
    r"Hospital da Luz[^.|\n]{0,60}"
    r"|Hospital do Mar[^.|\n]{0,40}"
    r"|Hospital Lus[ií]adas[^.|\n]{0,60}"
    r"|Cl[ií]nica Lus[ií]adas[^.|\n]{0,60}"
    r"|Luz Sa[uú]de"
    r"|Lus[ií]adas Sa[uú]de"
    r")\b",
    re.I,
)


class CvWarehouseScraper(BaseScraper):
    slug: str
    name: str
    company_guid: str
    default_company: str
    extra_company_guids: list[str] = []

    def landing_url(self, guid: str | None = None) -> str:
        company = guid or self.company_guid
        return (
            "https://jobpage.cvwarehouse.com/"
            f"?companyGuid={company}&lang=pt-PT"
        )

    def section_url(self, section_id: str, guid: str | None = None) -> str:
        return f"{self.landing_url(guid)}&section={section_id}"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        pages: list[tuple[str, str]] = []
        try:
            for guid in [self.company_guid, *self.extra_company_guids]:
                landing_html = client.get_text(self.landing_url(guid))
                pages.append((guid, landing_html))
                for section_id in self._discover_sections(landing_html):
                    pages.append(
                        (guid, client.get_text(self.section_url(section_id, guid)))
                    )
        finally:
            client.close()

        by_id: dict[str, JobPayload] = {}
        for guid, html in pages:
            for job in self._parse_jobs(html, guid):
                by_id[job.source_id] = job
        return list(by_id.values())

    def _discover_sections(self, html: str) -> list[str]:
        seen: list[str] = []
        for section_id in SECTION_PATTERN.findall(html):
            if section_id not in seen:
                seen.append(section_id)
        return seen

    def _parse_jobs(self, html: str, guid: str | None = None) -> list[JobPayload]:
        company_guid = guid or self.company_guid
        jobs: list[JobPayload] = []
        for attrs, body in JOB_BLOCK_PATTERN.findall(html):

            def attr(name: str) -> str | None:
                match = re.search(rf'data-filter-{name}="([^"]*)"', attrs)
                return unescape(match.group(1)) if match else None

            job_match = re.search(
                r'data-jobid="(\d+)"[^>]*data-titleslug="([^"]*)"', body
            )
            if not job_match:
                continue

            job_id = job_match.group(1)
            title = (attr("keywordsearchtitle") or unescape(job_match.group(2))).strip()
            if not title:
                continue

            description = html_to_text(attr("keywordsearchdescription") or "")
            city = attr("city")
            region = self._parse_jsonish_list(attr("region") or "")
            schedule = self._parse_jsonish_list(attr("workschedule") or "", join=True)
            company = self._guess_company(description)
            city, district = self._resolve_location(title, city, region)

            application_url = urljoin(
                "https://jobpage.cvwarehouse.com/",
                f"?companyGuid={company_guid}&lang=pt-PT&job={job_id}",
            )
            jobs.append(
                JobPayload(
                    title=title,
                    company=company,
                    location_district=district,
                    location_concelho=city,
                    profession=guess_profession(title, attr("worktype")),
                    specialty=None,
                    sector="privado",
                    contract_type=guess_contract(schedule),
                    description=description or title,
                    requirements=None,
                    salary=None,
                    application_url=application_url,
                    source=self.slug,
                    source_id=job_id,
                    published_at=None,
                )
            )
        return jobs

    def _resolve_location(
        self, title: str, city: str | None, region: str
    ) -> tuple[str | None, str]:
        district = guess_district(city, region)
        # Prefer an explicit place named in the title when ATS city is wrong.
        title_place = re.search(
            r"(?:Hospital|Cl[ií]nica)\s+(?:da\s+Luz|Lus[ií]adas|do\s+Mar)\s+([^–\-,(|]+)",
            title,
            re.I,
        )
        if title_place:
            place = title_place.group(1).strip()
            place_district = guess_district(place)
            if place_district != "Portugal":
                return place, place_district
        return city, district

    def _guess_company(self, description: str) -> str:
        match = COMPANY_PATTERN.search(description)
        if match:
            return re.sub(r"\s+", " ", match.group(1)).strip(" ,.-")
        return self.default_company

    @staticmethod
    def _parse_jsonish_list(raw: str, join: bool = False) -> str:
        value = raw.strip()
        if not value:
            return ""
        try:
            parsed = json.loads(value) if value.startswith("[") else []
            if isinstance(parsed, list) and parsed:
                return ", ".join(str(item) for item in parsed) if join else str(parsed[0])
        except json.JSONDecodeError:
            pass
        return value.strip("[]\"' ")


class LuzSaudeScraper(CvWarehouseScraper):
    slug = "luz_saude"
    name = "Luz Saúde"
    company_guid = LUZ_GUID
    default_company = "Luz Saúde"


class LusiadasScraper(CvWarehouseScraper):
    slug = "lusiadas"
    name = "Lusíadas Saúde"
    company_guid = LUSIADAS_GUID
    default_company = "Lusíadas Saúde"


class HolonScraper(CvWarehouseScraper):
    slug = "holon"
    name = "Farmácias Holon"
    company_guid = HOLON_GUID
    extra_company_guids = [HOLON_DERMO_GUID]
    default_company = "Farmácias Holon"

    def _resolve_location(
        self, title: str, city: str | None, region: str
    ) -> tuple[str | None, str]:
        place_match = re.search(r"\(([^)]+)\)\s*$", title)
        place = place_match.group(1).strip() if place_match else None
        district = guess_district(place, city or region)
        if district == "Portugal":
            district = guess_district(city, region)
        return place or city, district
