from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_profession,
    html_to_text,
    looks_like_hospital_employer_job,
    state_from_uf,
)

BASE = "https://hcoracao.pandape.infojobs.com.br"
DETAIL_RE = re.compile(r"^/Detail/(\d+)/?$", re.I)
SALARY_RE = re.compile(r"R\$\s*[\d.]+(?:\s*[-–]\s*R\$\s*[\d.]+)?")


class HcorScraper(BaseScraper):
    """HCor — Hospital do Coração (Pandapé / InfoJobs)."""

    slug = "hcor"
    name = "HCor — Hospital do Coração"
    company = "HCor — Hospital do Coração"
    sector = "ipss"  # Associação Beneficente Síria → Filantrópico
    max_detail_fetches = 80

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(
            headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer": "https://www.hcor.com.br/",
            }
        )
        try:
            html = client.get_text(f"{BASE}/")
            listing = self._parse_list(html)
            jobs: list[JobPayload] = []
            detail_budget = self.max_detail_fetches
            for job_id, meta in listing.items():
                title = meta.get("title") or ""
                if not looks_like_hospital_employer_job(title):
                    continue
                application_url = urljoin(BASE, f"/Detail/{job_id}")
                if detail_budget <= 0:
                    jobs.append(
                        JobPayload(
                            title=title,
                            company=self.company,
                            location_district=state_from_uf("SP", None),
                            location_concelho=meta.get("city") or "São Paulo",
                            profession=guess_profession(title),
                            specialty=None,
                            sector=self.sector,
                            contract_type=guess_contract(title),
                            description=title,
                            requirements=None,
                            salary=meta.get("salary"),
                            application_url=application_url,
                            source=self.slug,
                            source_id=job_id,
                            published_at=None,
                        )
                    )
                    continue
                detail_budget -= 1
                try:
                    detail_html = client.get_text(application_url)
                except Exception as exc:  # noqa: BLE001
                    print(f"[hcor] detalhe {job_id}: {exc}")
                    jobs.append(
                        JobPayload(
                            title=title,
                            company=self.company,
                            location_district=state_from_uf("SP", None),
                            location_concelho=meta.get("city") or "São Paulo",
                            profession=guess_profession(title),
                            specialty=None,
                            sector=self.sector,
                            contract_type=guess_contract(title),
                            description=title,
                            requirements=None,
                            salary=meta.get("salary"),
                            application_url=application_url,
                            source=self.slug,
                            source_id=job_id,
                            published_at=None,
                        )
                    )
                    continue
                job = self._parse_detail(job_id, application_url, detail_html, meta)
                if job:
                    jobs.append(job)
            return jobs
        finally:
            client.close()

    def _parse_list(self, html: str) -> dict[str, dict[str, str | None]]:
        soup = BeautifulSoup(html, "html.parser")
        found: dict[str, dict[str, str | None]] = {}
        for a in soup.select("a.card-vacancy[href], a[href*='/Detail/']"):
            href = (a.get("href") or "").split("?")[0]
            match = DETAIL_RE.match(href)
            if not match:
                continue
            job_id = match.group(1)
            title_el = a.select_one("h3, h2, .link")
            title = (
                title_el.get_text(" ", strip=True)
                if title_el
                else a.get_text(" ", strip=True)
            )
            title = re.sub(r"\s+", " ", title).strip()
            # Trim trailing meta noise if whole card text leaked
            if len(title) > 140:
                title = title[:140].rsplit(" ", 1)[0]
            text = a.get_text(" ", strip=True)
            city = None
            if "São Paulo" in text:
                city = "São Paulo"
            salary_m = SALARY_RE.search(text)
            found[job_id] = {
                "title": title,
                "city": city,
                "salary": salary_m.group(0) if salary_m else None,
            }
        return found

    def _parse_detail(
        self,
        job_id: str,
        application_url: str,
        html: str,
        meta: dict[str, str | None],
    ) -> JobPayload | None:
        soup = BeautifulSoup(html, "html.parser")
        h1 = soup.find("h1")
        title = h1.get_text(" ", strip=True) if h1 else (meta.get("title") or "")
        title = title.strip()
        if not title:
            return None
        if not looks_like_hospital_employer_job(title):
            return None

        description = ""
        for sel in [
            "#description",
            ".job-description",
            ".vacancy-description",
            ".description",
            "article",
        ]:
            node = soup.select_one(sel)
            if node:
                description = html_to_text(str(node))
                if len(description) > 60:
                    break
        if not description:
            description = html_to_text(html)[:2500] or title

        text = soup.get_text("\n", strip=True)
        salary = meta.get("salary")
        # Prefer salary near the vacancy header; ignore tiny generic matches (VA/VR).
        candidates = SALARY_RE.findall(text)
        for cand in candidates:
            digits = re.sub(r"\D", "", cand.split("-")[0])
            try:
                value = int(digits) if digits else 0
            except ValueError:
                value = 0
            if value >= 1000:
                salary = cand
                break

        contract = guess_contract(f"{title} {description[:300]}")
        if not contract:
            if re.search(r"\best[aá]gio\b", title + description, re.I):
                contract = "Estágio"
            elif re.search(r"\bCLT\b", text):
                contract = "CLT"

        return JobPayload(
            title=title,
            company=self.company,
            location_district=state_from_uf("SP", None),
            location_concelho=meta.get("city") or "São Paulo",
            profession=guess_profession(title),
            specialty=None,
            sector=self.sector,
            contract_type=contract,
            description=description,
            requirements=None,
            salary=salary,
            application_url=application_url,
            source=self.slug,
            source_id=job_id,
            published_at=None,
        )
