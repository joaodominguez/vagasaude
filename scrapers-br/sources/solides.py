"""Cliente partilhado para boards públicos `{tenant}.vagas.solides.com.br`.

API pública (sem auth):
  GET https://apigw.solides.com.br/jobs/v3/home/vacancy?take=25&page=N&slug={tenant}
"""

from __future__ import annotations

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

API_BASE = "https://apigw.solides.com.br/jobs/v3"
PAGE_SIZE = 25


class SolidesScraper(BaseScraper):
    """Cliente partilhado para portals Solides Vagas."""

    slug: str
    name: str
    tenant: str
    company: str
    sector: str  # publico | privado | ipss
    filter_mode: str = "health"

    @property
    def board_url(self) -> str:
        return f"https://{self.tenant}.vagas.solides.com.br/"

    def job_url(self, job_id: int | str) -> str:
        return f"https://{self.tenant}.vagas.solides.com.br/vaga/{job_id}"

    def _keep_item(self, item: dict[str, Any]) -> bool:
        title = item.get("title") or ""
        areas = item.get("occupationAreas") or []
        dept = " ".join(
            a.get("name") or "" for a in areas if isinstance(a, dict)
        )
        mode = getattr(self, "filter_mode", "health")
        if mode == "all":
            return True
        if mode == "hospital":
            return looks_like_hospital_employer_job(title, dept)
        return looks_like_health_job(title, dept)

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.25)
        try:
            return self._fetch_tenant(
                client, self.tenant, self.company, self.sector
            )
        finally:
            client.close()

    def _fetch_tenant(
        self,
        client: HttpClient,
        tenant: str,
        company: str,
        sector: str,
        source_prefix: str | None = None,
    ) -> list[JobPayload]:
        listing = self._list_vacancies(client, tenant)
        listing = [item for item in listing if self._keep_item(item)]
        print(f"[{self.slug}] {tenant}: {len(listing)} vagas após filtro")

        jobs: list[JobPayload] = []
        for item in listing:
            job_id = item.get("id")
            title = (item.get("title") or "").strip()
            if job_id is None or not title:
                continue

            state_obj = item.get("state") or {}
            city_obj = item.get("city") or {}
            uf = state_obj.get("code") if isinstance(state_obj, dict) else None
            state_name = (
                state_obj.get("name") if isinstance(state_obj, dict) else None
            )
            city = city_obj.get("name") if isinstance(city_obj, dict) else None

            description = html_to_text(item.get("description"))
            benefits = item.get("benefits") or []
            if isinstance(benefits, list) and benefits:
                names = [
                    b.get("name")
                    for b in benefits
                    if isinstance(b, dict) and b.get("name")
                ]
                if names:
                    block = "O que oferecemos:\n" + "\n".join(
                        f"- {n}" for n in names
                    )
                    description = (
                        f"{description}\n\n{block}" if description else block
                    )
            if not description:
                description = title

            education = item.get("education") or []
            requirements = None
            if isinstance(education, list) and education:
                req_bits = [
                    e.get("name")
                    for e in education
                    if isinstance(e, dict) and e.get("name")
                ]
                if req_bits:
                    requirements = "Escolaridade: " + ", ".join(req_bits)

            contracts = item.get("recruitmentContractType") or []
            contract_hint = " ".join(
                c.get("name") or ""
                for c in contracts
                if isinstance(c, dict)
            )
            contract = guess_contract(f"{contract_hint} {title}")

            salary = self._format_salary(item.get("salary"))
            company_name = (item.get("companyName") or company or "").strip()
            sid = str(job_id)
            if source_prefix:
                sid = f"{source_prefix}:{sid}"

            jobs.append(
                JobPayload(
                    title=title,
                    company=company_name or company,
                    location_district=state_from_uf(uf, state_name),
                    location_concelho=city,
                    profession=guess_profession(title),
                    specialty=None,
                    sector=sector,
                    contract_type=contract,
                    description=description,
                    requirements=requirements,
                    salary=salary,
                    application_url=f"https://{tenant}.vagas.solides.com.br/vaga/{job_id}",
                    source=self.slug,
                    source_id=sid,
                    published_at=item.get("createdAt") or item.get("date"),
                    expires_at=None,
                )
            )
        return jobs

    def _list_vacancies(
        self, client: HttpClient, tenant: str
    ) -> list[dict[str, Any]]:
        origin = f"https://{tenant}.vagas.solides.com.br"
        headers = {
            "Accept": "application/json",
            "Origin": origin,
            "Referer": f"{origin}/",
        }
        page = 1
        total_pages = 1
        items: list[dict[str, Any]] = []
        seen: set[int] = set()
        while page <= total_pages and page <= 40:
            url = (
                f"{API_BASE}/home/vacancy"
                f"?take={PAGE_SIZE}&page={page}&slug={tenant}"
            )
            payload = client.get_json(url, headers=headers)
            data = payload.get("data") if isinstance(payload, dict) else None
            if not isinstance(data, dict):
                raise RuntimeError(
                    f"Solides {tenant}: resposta inesperada em page={page}"
                )
            total_pages = int(data.get("totalPages") or 1)
            batch = data.get("data") or []
            if not isinstance(batch, list):
                raise RuntimeError(f"Solides {tenant}: data[] em falta")
            for item in batch:
                if not isinstance(item, dict):
                    continue
                jid = item.get("id")
                if jid is None or jid in seen:
                    continue
                seen.add(jid)
                items.append(item)
            if not batch:
                break
            page += 1
        return items

    @staticmethod
    def _format_salary(salary: Any) -> str | None:
        if not isinstance(salary, dict):
            return None
        initial = salary.get("initialRange") or 0
        final = salary.get("finalRange") or 0
        try:
            initial_f = float(initial)
            final_f = float(final)
        except (TypeError, ValueError):
            return None
        if initial_f <= 0 and final_f <= 0:
            return None
        if salary.get("negotiable"):
            return "A combinar"
        if final_f > initial_f > 0:
            return f"R$ {initial_f:,.2f} – R$ {final_f:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        value = final_f or initial_f
        return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


class SolidesSaudeScraper(SolidesScraper):
    """Cauda Solides saúde: Unimeds sem Gupy + clínicas/home care.

    Tenant list = boards vivos descobertos (Out 2026). Expandir BOARDS
    quando houver novos slugs com volume.
    """

    slug = "solides"
    name = "Solides (Unimeds / clínicas)"
    tenant = "unimedjp"
    company = "Solides — saúde"
    sector = "privado"
    filter_mode = "health"

    # (tenant, company label, sector, source_id prefix)
    # Descoberta: saudevagas apply URLs + probe API (Out 2026).
    BOARDS: list[tuple[str, str, str, str]] = [
        (
            "unimedjp",
            "Unimed João Pessoa",
            "privado",
            "unimedjp",
        ),
        (
            "unimedsantos",
            "Unimed Santos",
            "privado",
            "unimedsantos",
        ),
        (
            "unimedrb",
            "Unimed Rio Branco",
            "privado",
            "unimedrb",
        ),
        (
            "unimedpatosdeminas",
            "Unimed Patos de Minas",
            "privado",
            "unimedpatos",
        ),
        (
            "unimedcapivari",
            "Unimed Capivari",
            "privado",
            "unimedcapivari",
        ),
        (
            "unimedsetelagoas",
            "Unimed Sete Lagoas",
            "privado",
            "unimedsetelagoas",
        ),
        (
            "homedoctor",
            "Home Doctor",
            "privado",
            "homedoctor",
        ),
        (
            "solarcuidados",
            "Solar Cuidados e Serviços em Saúde",
            "privado",
            "solar",
        ),
        (
            "homecarerenascer",
            "Renascer Home Care",
            "privado",
            "renascer",
        ),
        (
            "hospitalhilda",
            "Instituto São Lucas (Hospital Hilda)",
            "privado",
            "hilda",
        ),
        (
            "franciscajulia",
            "Hospital Francisca Júlia",
            "privado",
            "franciscajulia",
        ),
        (
            "hjf",
            "Hospital Jacob Facuri",
            "privado",
            "hjf",
        ),
        (
            "clinicadoyon",
            "Data Med / Clínica Doyon",
            "privado",
            "doyon",
        ),
        (
            "santacasapc",
            "Santa Casa de Poços de Caldas",
            "ipss",
            "santacasapc",
        ),
    ]

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.25)
        try:
            jobs: list[JobPayload] = []
            seen_urls: set[str] = set()
            for tenant, company, sector, prefix in self.BOARDS:
                try:
                    batch = self._fetch_tenant(
                        client, tenant, company, sector, source_prefix=prefix
                    )
                except Exception as exc:  # noqa: BLE001
                    print(f"[{self.slug}] board {tenant}: {exc}")
                    continue
                for job in batch:
                    if job.application_url in seen_urls:
                        continue
                    seen_urls.add(job.application_url)
                    jobs.append(job)
            return jobs
        finally:
            client.close()
