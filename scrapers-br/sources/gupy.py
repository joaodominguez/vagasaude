from __future__ import annotations

import json
import re
from typing import Any

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_profession,
    html_to_text,
    looks_like_health_job,
    looks_like_hospital_employer_job,
    state_from_uf,
)

NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
    re.S,
)


class GupyScraper(BaseScraper):
    """Cliente partilhado para boards públicos `*.gupy.io`."""

    slug: str
    name: str
    subdomain: str
    company: str
    sector: str  # publico | privado | ipss
    # health = keywords clínicas; hospital = board hospitalar (exclui IT/jurídico);
    # all = sem filtro de título
    filter_mode: str = "health"
    health_only: bool = True  # legacy; prefer filter_mode
    enrich_details: bool = True
    max_detail_fetches: int = 350

    @property
    def board_url(self) -> str:
        return f"https://{self.subdomain}.gupy.io/"

    def job_url(self, job_id: int | str) -> str:
        return f"https://{self.subdomain}.gupy.io/jobs/{job_id}"

    def _keep_listing_item(self, item: dict[str, Any]) -> bool:
        title = item.get("title") or ""
        dept = item.get("department")
        mode = getattr(self, "filter_mode", None) or (
            "health" if self.health_only else "all"
        )
        if mode == "all":
            return True
        if mode == "hospital":
            return looks_like_hospital_employer_job(title, dept)
        return looks_like_health_job(title, dept)

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        try:
            return self._fetch_board(client, self.subdomain, self.company, self.sector)
        finally:
            client.close()

    def _fetch_board(
        self,
        client: HttpClient,
        subdomain: str,
        company: str,
        sector: str,
        source_prefix: str | None = None,
    ) -> list[JobPayload]:
        board_url = f"https://{subdomain}.gupy.io/"
        html = client.get_text(board_url)
        listing = self._parse_listing_html(html, subdomain)
        listing = [item for item in listing if self._keep_listing_item(item)]

        details: dict[str, dict[str, Any]] = {}
        if self.enrich_details:
            for item in listing[: self.max_detail_fetches]:
                job_id = item.get("id")
                if job_id is None:
                    continue
                try:
                    detail_html = client.get_text(
                        f"https://{subdomain}.gupy.io/jobs/{job_id}"
                    )
                    detail = self._parse_detail(detail_html)
                    if detail:
                        details[str(job_id)] = detail
                except Exception as exc:  # noqa: BLE001
                    print(f"[{self.slug}] detalhe {subdomain}/{job_id}: {exc}")

        jobs: list[JobPayload] = []
        for item in listing:
            job_id = item.get("id")
            if job_id is None:
                continue
            detail = details.get(str(job_id)) or {}
            title = ((detail.get("name") or item.get("title") or "")).strip()
            if not title:
                continue

            address = (item.get("workplace") or {}).get("address") or {}
            city = detail.get("addressCity") or address.get("city")
            uf = detail.get("addressStateShortName") or address.get("stateShortName")
            state = state_from_uf(
                uf,
                detail.get("addressState") or address.get("state"),
            )

            description = html_to_text(detail.get("description"))
            responsibilities = html_to_text(detail.get("responsibilities"))
            prerequisites = html_to_text(detail.get("prerequisites"))
            if responsibilities:
                description = (
                    f"{description}\n\nResponsabilidades:\n{responsibilities}"
                    if description
                    else responsibilities
                )
            if not description:
                dept = item.get("department") or ""
                description = f"{title}" + (f" — {dept}" if dept else "")

            contract = guess_contract(
                f"{detail.get('jobType') or item.get('type') or ''} {title}"
            )
            sid = str(job_id)
            if source_prefix:
                sid = f"{source_prefix}:{sid}"
            jobs.append(
                JobPayload(
                    title=title,
                    company=company,
                    location_district=state,
                    location_concelho=city,
                    profession=guess_profession(
                        f"{title} {item.get('department') or ''}"
                    ),
                    specialty=None,
                    sector=sector,
                    contract_type=contract,
                    description=description,
                    requirements=prerequisites or None,
                    salary=None,
                    application_url=f"https://{subdomain}.gupy.io/jobs/{job_id}",
                    source=self.slug,
                    source_id=sid,
                    published_at=detail.get("publishedAt"),
                    expires_at=detail.get("expiresAt"),
                )
            )
        return jobs

    def _parse_listing(self, html: str) -> list[dict[str, Any]]:
        return self._parse_listing_html(html, self.subdomain)

    def _parse_listing_html(self, html: str, subdomain: str) -> list[dict[str, Any]]:
        data = self._next_data(html, subdomain)
        props = data.get("props", {}).get("pageProps", {})
        jobs = props.get("jobs")
        if not isinstance(jobs, list):
            raise RuntimeError(f"Gupy {subdomain}: jobs[] em falta no board")
        return jobs

    def _parse_detail(self, html: str) -> dict[str, Any] | None:
        data = self._next_data(html, self.subdomain)
        props = data.get("props", {}).get("pageProps", {})
        job = props.get("job")
        return job if isinstance(job, dict) else None

    def _next_data(self, html: str, subdomain: str | None = None) -> dict[str, Any]:
        label = subdomain or self.subdomain
        match = NEXT_DATA_RE.search(html)
        if not match:
            raise RuntimeError(f"Gupy {label}: __NEXT_DATA__ não encontrado")
        return json.loads(match.group(1))


class RedeDorScraper(GupyScraper):
    slug = "rededor"
    name = "Rede D'Or"
    subdomain = "rededor"
    company = "Rede D'Or"
    sector = "privado"
    filter_mode = "health"
    max_detail_fetches = 400


class HapvidaScraper(GupyScraper):
    slug = "hapvida"
    name = "Hapvida NotreDame Intermédica"
    subdomain = "hapvidandi"
    company = "Hapvida NotreDame Intermédica"
    sector = "privado"
    filter_mode = "health"
    max_detail_fetches = 350


class IrsslScraper(GupyScraper):
    slug = "irssl"
    name = "IRSSL (Sírio-Libanês / OSS)"
    subdomain = "irssl"
    company = "IRSSL — Instituto de Responsabilidade Social Sírio-Libanês"
    sector = "publico"
    filter_mode = "health"
    max_detail_fetches = 250


class SantaCasaBhScraper(GupyScraper):
    slug = "santa_casa_bh"
    name = "Santa Casa BH"
    subdomain = "santacasabh"
    company = "Santa Casa de Misericórdia de Belo Horizonte"
    sector = "ipss"
    filter_mode = "health"
    max_detail_fetches = 250


class RedeAmericasScraper(GupyScraper):
    slug = "redeamericas"
    name = "Rede Américas (Ímpar)"
    subdomain = "redeamericas"
    company = "Rede Américas"
    sector = "privado"
    filter_mode = "health"
    max_detail_fetches = 300


class MoinhosScraper(GupyScraper):
    slug = "moinhos"
    name = "Hospital Moinhos de Vento"
    subdomain = "hospitalmoinhos"
    company = "Hospital Moinhos de Vento"
    sector = "privado"
    filter_mode = "hospital"
    max_detail_fetches = 80


class BpScraper(GupyScraper):
    slug = "bp"
    name = "Beneficência Portuguesa de São Paulo"
    subdomain = "vemserbp"
    company = "BP — Beneficência Portuguesa de São Paulo"
    sector = "privado"
    filter_mode = "hospital"
    max_detail_fetches = 80


class HaocScraper(GupyScraper):
    """Hospital Alemão Oswaldo Cruz — vários boards Gupy + ISHAOC (OSS)."""

    slug = "haoc"
    name = "Hospital Alemão Oswaldo Cruz"
    subdomain = "vagasassistenciaishaoc"
    company = "Hospital Alemão Oswaldo Cruz"
    sector = "privado"
    filter_mode = "hospital"
    max_detail_fetches = 80
    enrich_details = True

    # (subdomain, company label, sector, source_id prefix)
    BOARDS: list[tuple[str, str, str, str]] = [
        (
            "vagasassistenciaishaoc",
            "Hospital Alemão Oswaldo Cruz",
            "privado",
            "assist",
        ),
        (
            "vagasadministrativashaoc",
            "Hospital Alemão Oswaldo Cruz",
            "privado",
            "admin",
        ),
        (
            "vagasoperacionaishaoc",
            "Hospital Alemão Oswaldo Cruz",
            "privado",
            "ops",
        ),
        (
            "hospitaloswaldocruz",
            "Hospital Alemão Oswaldo Cruz",
            "privado",
            "geral",
        ),
        (
            "ishaoc",
            "ISHAOC — Instituto Social Hospital Alemão Oswaldo Cruz",
            "publico",
            "ishaoc",
        ),
    ]

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        try:
            jobs: list[JobPayload] = []
            seen_urls: set[str] = set()
            for subdomain, company, sector, prefix in self.BOARDS:
                try:
                    batch = self._fetch_board(
                        client, subdomain, company, sector, source_prefix=prefix
                    )
                except Exception as exc:  # noqa: BLE001
                    print(f"[{self.slug}] board {subdomain}: {exc}")
                    continue
                for job in batch:
                    if job.application_url in seen_urls:
                        continue
                    seen_urls.add(job.application_url)
                    jobs.append(job)
            return jobs
        finally:
            client.close()
