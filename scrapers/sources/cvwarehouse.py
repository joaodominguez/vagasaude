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


class CvWarehouseScraper(BaseScraper):
    slug: str
    name: str
    company_guid: str
    default_company: str

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        try:
            url = (
                "https://jobpage.cvwarehouse.com/"
                f"?companyGuid={self.company_guid}&lang=pt-PT"
            )
            html = client.get_text(url)
        finally:
            client.close()

        jobs: list[JobPayload] = []
        pattern = re.compile(
            r'<div data-item-collection="jobCollection-[^"]+"([^>]*)>([\s\S]*?)'
            r'(?=<div data-item-collection="jobCollection-|\Z)'
        )
        for attrs, body in pattern.findall(html):

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
            description = html_to_text(attr("keywordsearchdescription") or "")
            city = attr("city")
            region_raw = attr("region") or ""
            try:
                region_list = json.loads(region_raw) if region_raw.startswith("[") else []
                region = region_list[0] if region_list else region_raw
            except json.JSONDecodeError:
                region = region_raw.strip("[]\"' ")

            schedule_raw = attr("workschedule") or ""
            try:
                schedule_list = (
                    json.loads(schedule_raw) if schedule_raw.startswith("[") else []
                )
                schedule = ", ".join(schedule_list) if schedule_list else schedule_raw
            except json.JSONDecodeError:
                schedule = schedule_raw

            # Infer hospital/unit from description opening if present.
            company = self.default_company
            company_match = re.search(
                r"\b(Hospital da Luz[^.|\n]{0,60}|Hospital do Mar[^.|\n]{0,40}|Luz Saúde)\b",
                description,
                re.I,
            )
            if company_match:
                company = company_match.group(1).strip()

            application_url = urljoin(
                "https://jobpage.cvwarehouse.com/",
                f"?companyGuid={self.company_guid}&lang=pt-PT&job={job_id}",
            )
            district = guess_district(city, region)
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
