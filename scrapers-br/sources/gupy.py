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


def compose_gupy_description(
    description: str,
    responsibilities: str,
    benefits: str,
) -> str:
    """Monta o texto da vaga com secções legíveis no detalhe (padrão IEFP PT)."""
    blocks: list[str] = []
    if description:
        blocks.append(description.strip())
    if responsibilities:
        blocks.append(f"Responsabilidades:\n{responsibilities.strip()}")
    if benefits:
        blocks.append(f"O que oferecemos:\n{benefits.strip()}")
    return "\n\n".join(blocks).strip()


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
    # None = enriquecer TODAS as vagas filtradas (o board Rede D'Or passa de 1k).
    # Um teto baixo deixava a maioria só com "título — departamento".
    max_detail_fetches: int | None = None

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
        # Gupy: muitos detalhes; 0.2s × ~1500 ≈ 5 min (aceitável no cron BR).
        client = HttpClient(min_interval=0.2)
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
            limit = self.max_detail_fetches
            targets = listing if limit is None else listing[: max(0, limit)]
            print(
                f"[{self.slug}] {subdomain}: a enriquecer "
                f"{len(targets)}/{len(listing)} detalhes"
            )
            for item in targets:
                job_id = item.get("id")
                if job_id is None:
                    continue
                try:
                    detail_html = client.get_text(
                        f"https://{subdomain}.gupy.io/jobs/{job_id}"
                    )
                    detail = self._parse_detail_html(detail_html, subdomain)
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

            profile = html_to_text(detail.get("description"))
            responsibilities = html_to_text(detail.get("responsibilities"))
            prerequisites = html_to_text(detail.get("prerequisites"))
            # Em Gupy, "relevantExperiences" costuma trazer benefícios / condições.
            benefits = html_to_text(detail.get("relevantExperiences"))
            description = compose_gupy_description(
                profile, responsibilities, benefits
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
        return self._parse_detail_html(html, self.subdomain)

    def _parse_detail_html(
        self, html: str, subdomain: str
    ) -> dict[str, Any] | None:
        data = self._next_data(html, subdomain)
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


class HapvidaScraper(GupyScraper):
    slug = "hapvida"
    name = "Hapvida NotreDame Intermédica"
    subdomain = "hapvidandi"
    company = "Hapvida NotreDame Intermédica"
    sector = "privado"
    filter_mode = "health"


class IrsslScraper(GupyScraper):
    slug = "irssl"
    name = "IRSSL (Sírio-Libanês / OSS)"
    subdomain = "irssl"
    company = "IRSSL — Instituto de Responsabilidade Social Sírio-Libanês"
    sector = "publico"
    filter_mode = "health"


class SantaCasaBhScraper(GupyScraper):
    slug = "santa_casa_bh"
    name = "Santa Casa BH"
    subdomain = "santacasabh"
    company = "Santa Casa de Misericórdia de Belo Horizonte"
    sector = "ipss"
    filter_mode = "health"


class SantaCasaPoaScraper(GupyScraper):
    slug = "santa_casa_poa"
    name = "Santa Casa Porto Alegre"
    subdomain = "santacasa"
    company = "Santa Casa de Misericórdia de Porto Alegre"
    sector = "ipss"
    filter_mode = "hospital"


class SantaCasaBaScraper(GupyScraper):
    slug = "santa_casa_ba"
    name = "Santa Casa da Bahia"
    subdomain = "santacasaba"
    company = "Santa Casa da Bahia"
    sector = "ipss"
    filter_mode = "hospital"


class AacdScraper(GupyScraper):
    """AACD — Associação de Assistência à Criança Deficiente (filantrópico)."""

    slug = "aacd"
    name = "AACD"
    subdomain = "aacd"
    company = "AACD — Associação de Assistência à Criança Deficiente"
    sector = "ipss"
    filter_mode = "hospital"


class RedeAmericasScraper(GupyScraper):
    slug = "redeamericas"
    name = "Rede Américas (Ímpar)"
    subdomain = "redeamericas"
    company = "Rede Américas"
    sector = "privado"
    filter_mode = "health"


class MoinhosScraper(GupyScraper):
    slug = "moinhos"
    name = "Hospital Moinhos de Vento"
    subdomain = "hospitalmoinhos"
    company = "Hospital Moinhos de Vento"
    sector = "privado"
    filter_mode = "hospital"


class BpScraper(GupyScraper):
    slug = "bp"
    name = "Beneficência Portuguesa de São Paulo"
    subdomain = "vemserbp"
    company = "BP — Beneficência Portuguesa de São Paulo"
    sector = "privado"
    filter_mode = "hospital"


class HaocScraper(GupyScraper):
    """Hospital Alemão Oswaldo Cruz — vários boards Gupy + ISHAOC (OSS)."""

    slug = "haoc"
    name = "Hospital Alemão Oswaldo Cruz"
    subdomain = "vagasassistenciaishaoc"
    company = "Hospital Alemão Oswaldo Cruz"
    sector = "privado"
    filter_mode = "hospital"
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
        client = HttpClient(min_interval=0.2)
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


class SpdmScraper(GupyScraper):
    """SPDM/PAIS (+ afiliadas) — OSS/SUS via Gupy multi-board.

    Sector `publico` (como IRSSL): gestão de equipamentos SUS / contratos OSS.
    """

    slug = "spdm"
    name = "SPDM/PAIS"
    subdomain = "spdmpais"
    company = "SPDM/PAIS"
    sector = "publico"
    filter_mode = "health"
    enrich_details = True

    # (subdomain, company label, sector, source_id prefix)
    BOARDS: list[tuple[str, str, str, str]] = [
        ("spdmpais", "SPDM/PAIS", "publico", "pais"),
        ("spdmpaisrj", "SPDM/PAIS Rio de Janeiro", "publico", "pais_rj"),
        ("spdmpaisdiadema", "SPDM/PAIS Diadema", "publico", "pais_diadema"),
        (
            "hgg",
            "Hospital Geral de Guarulhos — SPDM Afiliadas",
            "publico",
            "hgg",
        ),
        (
            "hed",
            "Hospital Estadual de Diadema — SPDM Afiliadas",
            "publico",
            "hed",
        ),
        ("spdmhsp", "SPDM Hospital São Paulo", "publico", "hsp"),
        ("spdm", "SPDM Afiliadas", "publico", "afiliadas"),
    ]

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.2)
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


class DavitaScraper(GupyScraper):
    """DaVita / Serviços Assistenciais — diálise (Gupy)."""

    slug = "davita"
    name = "DaVita Serviços Assistenciais"
    subdomain = "servicosassistenciais"
    company = "DaVita — Serviços Assistenciais aos Pacientes"
    sector = "privado"
    filter_mode = "health"


class SeconciSpScraper(GupyScraper):
    """Seconci-SP — filantrópico / SST (Gupy)."""

    slug = "seconci_sp"
    name = "Seconci-SP"
    subdomain = "seconci-sp"
    company = "Seconci-SP"
    sector = "ipss"
    filter_mode = "health"


class DasaScraper(GupyScraper):
    """Dasa — medicina diagnóstica (boards assistencial + atendimento).

    Skip `dasatecnologia` (IT/dados — fora do filtro saúde).
    """

    slug = "dasa"
    name = "Dasa"
    subdomain = "dasaassistencial"
    company = "Dasa"
    sector = "privado"
    filter_mode = "health"
    enrich_details = True

    BOARDS: list[tuple[str, str, str, str]] = [
        ("dasaassistencial", "Dasa Assistencial", "privado", "assist"),
        ("dasaatendimento", "Dasa Atendimento", "privado", "atend"),
    ]

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.2)
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


class SabinScraper(GupyScraper):
    """Grupo Sabin — laboratórios (Gupy)."""

    slug = "sabin"
    name = "Grupo Sabin"
    subdomain = "gruposabin"
    company = "Grupo Sabin"
    sector = "privado"
    filter_mode = "health"


class FidiScraper(GupyScraper):
    """FIDI — diagnóstico por imagem (Gupy)."""

    slug = "fidi"
    name = "FIDI"
    subdomain = "fidi"
    company = "FIDI"
    sector = "privado"
    filter_mode = "health"


class UnimedScraper(GupyScraper):
    """Top Unimeds por volume em Gupy (não cobre todas as coops).

    Solides-only Unimeds (JP, Santos, Rio Branco, Patos…) ficam em `solides`.
    """

    slug = "unimed"
    name = "Unimed (cooperativas)"
    subdomain = "unimedcampinas"
    company = "Unimed"
    sector = "privado"
    filter_mode = "health"
    enrich_details = True

    # Top ~10 por jobs vivos (probe Out 2026).
    BOARDS: list[tuple[str, str, str, str]] = [
        ("unimedcampinas", "Unimed Campinas", "privado", "campinas"),
        ("unimednacional", "Unimed Nacional", "privado", "nacional"),
        ("unimedjf", "Unimed Juiz de Fora", "privado", "jf"),
        ("unimedcuiaba", "Unimed Cuiabá", "privado", "cuiaba"),
        ("unimedgoiania", "Unimed Goiânia", "privado", "goiania"),
        ("unimedbelem", "Unimed Belém", "privado", "belem"),
        ("unimedpoa", "Unimed Porto Alegre", "privado", "poa"),
        ("unimedguarulhos", "Unimed Guarulhos", "privado", "guarulhos"),
        ("unimedmaceio", "Unimed Maceió", "privado", "maceio"),
        ("vagasunimedpelotas", "Unimed Pelotas", "privado", "pelotas"),
    ]

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.2)
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


class VeraCruzScraper(GupyScraper):
    """Hospital Vera Cruz (Campinas) — Gupy."""

    slug = "vera_cruz"
    name = "Hospital Vera Cruz"
    subdomain = "veracruzhospital"
    company = "Hospital Vera Cruz"
    sector = "privado"
    filter_mode = "hospital"


class BaiaSulScraper(GupyScraper):
    """Hospital Baía Sul (Florianópolis / Hospital Care) — Gupy."""

    slug = "baia_sul"
    name = "Hospital Baía Sul"
    subdomain = "baiasulhospital"
    company = "Hospital Baía Sul"
    sector = "privado"
    filter_mode = "hospital"


class FhsaScraper(GupyScraper):
    """FHSA — Fundação Hospitalar São Francisco de Assis (BH, 100% SUS)."""

    slug = "fhsa"
    name = "Hospital São Francisco de Assis (FHSA)"
    subdomain = "fhsfa"
    company = "Hospital São Francisco de Assis"
    sector = "ipss"
    filter_mode = "hospital"


class PilarScraper(GupyScraper):
    """Pilar Hospital — Gupy."""

    slug = "pilar"
    name = "Pilar Hospital"
    subdomain = "pilarhospital"
    company = "Pilar Hospital"
    sector = "privado"
    filter_mode = "hospital"


class SaoLucasScraper(GupyScraper):
    """Hospital São Lucas — Gupy."""

    slug = "sao_lucas"
    name = "Hospital São Lucas"
    subdomain = "hospitalsaolucas"
    company = "Hospital São Lucas"
    sector = "privado"
    filter_mode = "hospital"


class MedMaisScraper(GupyScraper):
    """MedMais — urgência / socorro — Gupy."""

    slug = "medmais"
    name = "MedMais"
    subdomain = "medmais"
    company = "MedMais"
    sector = "privado"
    filter_mode = "health"


class ImedScraper(GupyScraper):
    """IMED — OSS / gestão de hospitais públicos (Goiás, SP)."""

    slug = "imed"
    name = "IMED"
    subdomain = "vagasimed"
    company = "IMED — Instituto de Medicina, Estudos e Desenvolvimento"
    sector = "publico"
    filter_mode = "hospital"


class OncologiaDorScraper(GupyScraper):
    """Oncologia D’Or — Gupy."""

    slug = "oncologia_dor"
    name = "Oncologia D'Or"
    subdomain = "oncologiador"
    company = "Oncologia D'Or"
    sector = "privado"
    filter_mode = "health"
