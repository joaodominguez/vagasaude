from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Any

import httpx

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_profession,
    html_to_text,
    looks_like_health_job,
    looks_like_hospital_employer_job,
    norm,
    state_from_uf,
)

NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
    re.S,
)

# (subdomain, company label, sector, source_id prefix). Prefixo "" = sourceId
# só com o job id (boards legados que eram single-tenant — IDs estáveis).
Board = tuple[str, str, str, str]


# ---------------------------------------------------------------------------
# Filtro farmácias (redes de drogarias): só farmacêutico(a) e técnico em farmácia
# ---------------------------------------------------------------------------

_PHARMACIST_RE = re.compile(r"\bfarmaceut")
_PHARMACY_TECH_RE = re.compile(
    r"\b(tecnic[oa]s?|tec)\s+(?:a\s+)?(?:em|de)\s+farmacia\b"
)
# Funções de loja que não são farmacêutico (mesmo que o título cite farmácia).
_PHARMACY_EXCLUDE = (
    "balconista",
    "atendente",
    "operador",
    "operadora",
    "caixa",
    "estoquista",
    "estoque",
    "repositor",
    "vendedor",
    "vendas",
    "motoboy",
    "entregador",
    "perfumista",
    "perfumaria",
    "estagi",
    "aprendiz",
    "banco de talentos",
)


def looks_like_pharmacist_job(title: str) -> bool:
    """Farmacêutico(a) (RT, substituto, gerente farmacêutico…) ou técnico em farmácia.

    Só o título conta — em boards de drogarias o departamento é quase sempre
    "Farmácia/Loja" e deixaria passar balconistas e operadores de caixa.
    """
    t = norm(title)
    if not t:
        return False
    if not (_PHARMACIST_RE.search(t) or _PHARMACY_TECH_RE.search(t)):
        return False
    return not any(x in t for x in _PHARMACY_EXCLUDE)


# ---------------------------------------------------------------------------
# Cache em disco dos detalhes Gupy (evita re-pedir ~1k páginas a cada 6h)
# ---------------------------------------------------------------------------

DETAIL_CACHE_TTL_SECONDS = 30 * 24 * 3600
_DETAIL_FIELDS = (
    "name",
    "description",
    "responsibilities",
    "prerequisites",
    "relevantExperiences",
    "addressCity",
    "addressStateShortName",
    "addressState",
    "jobType",
    "publishedAt",
    "expiresAt",
)
_DEFAULT_CACHE_PATH = (
    Path(__file__).resolve().parents[1] / ".cache" / "gupy_details.json"
)


_HTML_ATTR_BLOAT_RE = re.compile(r"""\s(?:style|class|data-[\w-]+)=(?:"[^"]*"|'[^']*')""")


def _squash(text: str | None) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


class GupyDetailCache:
    """JSON `{ "<subdomain>:<job_id>": {"t": epoch, "d": {...}} }`.

    - Caminho: env `GUPY_DETAIL_CACHE` (ou `off` para desligar); por omissão
      `scrapers-br/.cache/gupy_details.json`.
    - TTL 30 dias: vagas longas voltam a ser lidas 1×/mês (apanha edições).
    - Nunca falha a corrida: leitura corrupta → cache vazia; disco só-leitura
      → continua sem gravar.
    """

    def __init__(
        self,
        path: Path | None,
        ttl_seconds: int = DETAIL_CACHE_TTL_SECONDS,
    ):
        self.path = path
        self.ttl = ttl_seconds
        self.entries: dict[str, dict[str, Any]] = {}
        self.dirty = 0
        self.writable = path is not None
        self.hits = 0
        self.misses = 0
        self._load()

    @staticmethod
    def key(subdomain: str, job_id: int | str) -> str:
        return f"{subdomain}:{job_id}"

    def _load(self) -> None:
        if self.path is None or not self.path.exists():
            return
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            print(f"[gupy-cache] ignorar cache ilegível {self.path}: {exc}")
            return
        if not isinstance(raw, dict):
            return
        cutoff = time.time() - self.ttl
        for k, v in raw.items():
            if (
                isinstance(v, dict)
                and isinstance(v.get("d"), dict)
                and isinstance(v.get("t"), (int, float))
                and v["t"] >= cutoff
            ):
                self.entries[k] = v

    def get(
        self,
        subdomain: str,
        job_id: int | str,
        listing_title: str | None = None,
    ) -> dict[str, Any] | None:
        entry = self.entries.get(self.key(subdomain, job_id))
        if not entry or entry["t"] < time.time() - self.ttl:
            self.misses += 1
            return None
        detail = entry["d"]
        # Título mudou no board → vaga editada; voltar a ler o detalhe.
        if listing_title and _squash(detail.get("name")) not in (
            "",
            _squash(listing_title),
        ):
            self.misses += 1
            return None
        self.hits += 1
        return detail

    def put(
        self, subdomain: str, job_id: int | str, detail: dict[str, Any]
    ) -> dict[str, Any]:
        """Guarda a versão reduzida do detalhe e devolve-a (mesmo output que um hit)."""
        trimmed: dict[str, Any] = {}
        for f in _DETAIL_FIELDS:
            value = detail.get(f)
            if value is None:
                continue
            if isinstance(value, str):
                # style/class inline inflam o HTML Gupy (~20%); html_to_text
                # descarta tags de qualquer forma.
                value = _HTML_ATTR_BLOAT_RE.sub("", value)
            trimmed[f] = value
        self.entries[self.key(subdomain, job_id)] = {
            "t": int(time.time()),
            "d": trimmed,
        }
        self.dirty += 1
        return trimmed

    def save(self) -> None:
        if not self.dirty or not self.writable or self.path is None:
            return
        cutoff = time.time() - self.ttl
        live = {k: v for k, v in self.entries.items() if v["t"] >= cutoff}
        tmp = self.path.with_name(f"{self.path.name}.{os.getpid()}.tmp")
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp.write_text(
                json.dumps(live, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            os.replace(tmp, self.path)
            self.entries = live
            self.dirty = 0
        except OSError as exc:
            self.writable = False
            print(f"[gupy-cache] sem escrita em {self.path} ({exc}); a seguir sem cache")
            try:
                tmp.unlink(missing_ok=True)
            except OSError:
                pass


_detail_cache: GupyDetailCache | None = None


def get_detail_cache() -> GupyDetailCache:
    """Singleton por processo (partilhado por todas as fontes Gupy do run)."""
    global _detail_cache
    if _detail_cache is None:
        raw = (os.environ.get("GUPY_DETAIL_CACHE") or "").strip()
        if raw.lower() in {"off", "0", "false", "none", "disabled"}:
            path: Path | None = None
        else:
            path = Path(raw).expanduser() if raw else _DEFAULT_CACHE_PATH
        _detail_cache = GupyDetailCache(path)
    return _detail_cache


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
    # Força a profissão (ex.: "Farmácia" nas redes de drogarias).
    profession_override: str | None = None
    # Multi-board: lista de Board. None = single-tenant (subdomain/company/sector).
    BOARDS: list[Board] | None = None

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
        if mode == "pharmacist":
            return looks_like_pharmacist_job(title)
        return looks_like_health_job(title, dept)

    def fetch(self) -> list[JobPayload]:
        # Gupy: muitos detalhes; 0.2s × ~1500 ≈ 5 min (aceitável no cron BR).
        # Com a cache de detalhes, corridas seguintes só pedem vagas novas.
        client = HttpClient(min_interval=0.2)
        try:
            if self.BOARDS:
                return self._fetch_boards(client, self.BOARDS)
            return self._fetch_board(client, self.subdomain, self.company, self.sector)
        finally:
            client.close()
            get_detail_cache().save()

    # Pausa antes de repetir um board que falhou (rede / 5xx / 429).
    board_retry_delay: float = 3.0

    def _fetch_boards(
        self, client: HttpClient, boards: list[Board]
    ) -> list[JobPayload]:
        """Multi-board: um board em erro não derruba os outros.

        Repete 1× (falhas transitórias). Se continuar em erro, segue sem ele —
        o ingest só expira IDs em falta quando o lote é "cheio" (≥50% dos
        publicados da fonte), por isso o resto do lote mantém-se.
        """
        jobs: list[JobPayload] = []
        seen_urls: set[str] = set()
        for subdomain, company, sector, prefix in boards:
            batch: list[JobPayload] | None = None
            for attempt in (1, 2):
                try:
                    batch = self._fetch_board(
                        client,
                        subdomain,
                        company,
                        sector,
                        source_prefix=prefix or None,
                    )
                    break
                except Exception as exc:  # noqa: BLE001
                    gone = (
                        isinstance(exc, httpx.HTTPStatusError)
                        and exc.response.status_code in {404, 410}
                    )
                    print(f"[{self.slug}] board {subdomain} (tentativa {attempt}): {exc}")
                    if gone or attempt == 2:
                        break
                    time.sleep(self.board_retry_delay)
            if batch is None:
                continue
            for job in batch:
                if job.application_url in seen_urls:
                    continue
                seen_urls.add(job.application_url)
                jobs.append(job)
        return jobs

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
        total_listed = len(listing)
        # Filtro de função ANTES de qualquer pedido de detalhe.
        listing = [item for item in listing if self._keep_listing_item(item)]

        details: dict[str, dict[str, Any]] = {}
        if self.enrich_details:
            cache = get_detail_cache()
            limit = self.max_detail_fetches
            targets = listing if limit is None else listing[: max(0, limit)]
            cached = fetched = 0
            for item in targets:
                job_id = item.get("id")
                if job_id is None:
                    continue
                hit = cache.get(subdomain, job_id, item.get("title"))
                if hit is not None:
                    details[str(job_id)] = hit
                    cached += 1
                    continue
                try:
                    detail_html = client.get_text(
                        f"https://{subdomain}.gupy.io/jobs/{job_id}"
                    )
                    detail = self._parse_detail_html(detail_html, subdomain)
                    if detail:
                        details[str(job_id)] = cache.put(
                            subdomain, job_id, detail
                        )
                        fetched += 1
                        if cache.dirty >= 200:
                            cache.save()
                except Exception as exc:  # noqa: BLE001
                    print(f"[{self.slug}] detalhe {subdomain}/{job_id}: {exc}")
            print(
                f"[{self.slug}] {subdomain}: {len(listing)}/{total_listed} vagas "
                f"após filtro; detalhes {cached} cache + {fetched} pedidos"
            )
            cache.save()
        else:
            print(
                f"[{self.slug}] {subdomain}: {len(listing)}/{total_listed} vagas após filtro"
            )

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
                    profession=self.profession_override
                    or guess_profession(f"{title} {item.get('department') or ''}"),
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

    BOARDS: list[Board] = [
        # Prefixo "" — board original single-tenant; mantém sourceIds antigos.
        ("hapvidandi", "Hapvida NotreDame Intermédica", "privado", ""),
        (
            "hapvidanditea",
            "Hapvida NotreDame — TEA e Medicina Preventiva",
            "privado",
            "tea",
        ),
    ]


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

    BOARDS: list[Board] = [
        # Prefixo "" — board original single-tenant; mantém sourceIds antigos.
        ("redeamericas", "Rede Américas", "privado", ""),
        ("vagasredeamericas", "Rede Américas", "privado", "vagas"),
    ]


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
    BOARDS: list[Board] = [
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
    BOARDS: list[Board] = [
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
        (
            "spdmpaissa",
            "SPDM/PAIS Santo André",
            "publico",
            "pais_sa",
        ),
        ("spdmpaisfor", "SPDM/PAIS Fortaleza", "publico", "pais_for"),
        ("spdmpaismogi", "SPDM/PAIS Mogi das Cruzes", "publico", "pais_mogi"),
        (
            "rastsvmvg",
            "RAST Vila Maria/Vila Guilherme — SPDM Afiliadas",
            "publico",
            "rast_vmvg",
        ),
        (
            "hmvjs",
            "Hosp. Mun. Vereador José Storopolli — SPDM",
            "publico",
            "hmvjs",
        ),
    ]


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

    BOARDS: list[Board] = [
        ("dasaassistencial", "Dasa Assistencial", "privado", "assist"),
        ("dasaatendimento", "Dasa Atendimento", "privado", "atend"),
    ]


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

    # Coops Gupy com vagas abertas (probe Out 2026 + cauda saudevagas).
    BOARDS: list[Board] = [
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
        # Cauda (saudevagas apply URLs + subdomain probe)
        (
            "unimedvaledosinos",
            "Unimed Vale dos Sinos",
            "privado",
            "valedosinos",
        ),
        (
            "unimedgrandeflorianopolis",
            "Unimed Grande Florianópolis",
            "privado",
            "grandefloripa",
        ),
        ("unimedsjc", "Unimed São José dos Campos", "privado", "sjc"),
        ("unimedpiracicaba", "Unimed Piracicaba", "privado", "piracicaba"),
        ("unimedfortaleza", "Unimed Fortaleza", "privado", "fortaleza"),
        ("unimedvaledocai", "Unimed Vale do Cai", "privado", "valedocai"),
        # Lote Out 2026
        ("unimedcnu", "Unimed CNU", "privado", "cnu"),
        ("unimedhospitalferj", "Hospital Unimed Ferj", "privado", "ferj"),
        (
            "unimedcampinagrande",
            "Unimed Campina Grande",
            "privado",
            "campinagrande",
        ),
    ]


class VeraCruzScraper(GupyScraper):
    """Hospital Vera Cruz (Campinas) — Gupy."""

    slug = "vera_cruz"
    name = "Hospital Vera Cruz"
    subdomain = "veracruzhospital"
    company = "Hospital Vera Cruz"
    sector = "privado"
    filter_mode = "hospital"


class BaiaSulScraper(GupyScraper):
    """Hospital Baía Sul (+ Baía Sul Mulher) — Gupy multi-board."""

    slug = "baia_sul"
    name = "Hospital Baía Sul"
    subdomain = "baiasulhospital"
    company = "Hospital Baía Sul"
    sector = "privado"
    filter_mode = "hospital"
    enrich_details = True

    BOARDS: list[Board] = [
        ("baiasulhospital", "Hospital Baía Sul", "privado", "hospital"),
        (
            "baiasulmulher",
            "Hospital Baía Sul Mulher",
            "privado",
            "mulher",
        ),
    ]


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


class AfipScraper(GupyScraper):
    """AFIP — laboratórios / diagnóstico (Gupy)."""

    slug = "afip"
    name = "AFIP"
    subdomain = "afip"
    company = "AFIP"
    sector = "privado"
    filter_mode = "health"


class MarcelinoChampagnatScraper(GupyScraper):
    """Hospital São Marcelino Champagnat (Curitiba) — Gupy."""

    slug = "marcelino_champagnat"
    name = "Hospital São Marcelino Champagnat"
    subdomain = "hospitalsaomarcelinochampagnat"
    company = "Hospital São Marcelino Champagnat"
    sector = "privado"
    filter_mode = "hospital"


class SaoLucasRibeiraoScraper(GupyScraper):
    """Hospital São Lucas Ribeirão Preto — Gupy (≠ PUCRS `sao_lucas`)."""

    slug = "sao_lucas_ribeirao"
    name = "Hospital São Lucas Ribeirão Preto"
    subdomain = "saolucashospital"
    company = "Hospital São Lucas Ribeirão Preto"
    sector = "privado"
    filter_mode = "hospital"


class CajuruScraper(GupyScraper):
    """Hospital Universitário Cajuru (PUCPR) — Gupy."""

    slug = "cajuru"
    name = "Hospital Universitário Cajuru"
    subdomain = "hospitaluniversitariocajuru"
    company = "Hospital Universitário Cajuru"
    sector = "privado"
    filter_mode = "hospital"


class IrmaDulceScraper(GupyScraper):
    """Obras Sociais Irmã Dulce — Gupy."""

    slug = "irma_dulce"
    name = "Obras Sociais Irmã Dulce"
    subdomain = "obrassociaisirmadulce"
    company = "Obras Sociais Irmã Dulce"
    sector = "ipss"
    filter_mode = "hospital"


class InovaSaudeScraper(GupyScraper):
    """Inova Saúde — OSS / gestão hospitalar (Gupy)."""

    slug = "inova_saude"
    name = "Inova Saúde"
    subdomain = "talentosinovasaude"
    company = "Inova Saúde"
    sector = "publico"
    filter_mode = "health"


class InstitutoMaisSaudeScraper(GupyScraper):
    """Instituto Social Mais Saúde — OSS (Gupy)."""

    slug = "instituto_mais_saude"
    name = "Instituto Social Mais Saúde"
    subdomain = "institutomaissaude"
    company = "Instituto Social Mais Saúde"
    sector = "publico"
    filter_mode = "health"


class RastButantaScraper(GupyScraper):
    """RAST Butantã — rede de atenção / UPA SP (Gupy)."""

    slug = "rast_butanta"
    name = "RAST Butantã"
    subdomain = "rastsbutanta"
    company = "RAST Butantã"
    sector = "publico"
    filter_mode = "health"


class EvangelicoScraper(GupyScraper):
    """Hospital Evangélico (Sorocaba) — Gupy."""

    slug = "evangelico"
    name = "Hospital Evangélico"
    subdomain = "evangelicohospital"
    company = "Hospital Evangélico"
    sector = "ipss"
    filter_mode = "hospital"


class HmbfmScraper(GupyScraper):
    """Hospital Municipal de Barueri Dr. Francisco Moran — Gupy."""

    slug = "hmbfm"
    name = "Hospital Municipal de Barueri"
    subdomain = "hmbfm"
    company = "Hospital Municipal de Barueri Dr. Francisco Moran"
    sector = "publico"
    filter_mode = "hospital"


class CaudaGupyScraper(GupyScraper):
    """Cauda Gupy — clínicas, labs e hospitais médios (multi-board).

    Boards descobertos via saudevagas apply URLs (Out 2026), excluindo
    fontes já registadas como scraper dedicado.
    """

    slug = "cauda_gupy"
    name = "Hospitais e clínicas (cauda Gupy)"
    subdomain = "s3saude"
    company = "Cauda Gupy — saúde"
    sector = "privado"
    filter_mode = "health"
    enrich_details = True

    # (subdomain, company, sector, prefix)
    BOARDS: list[Board] = [
        ("s3saude", "S3 Gestão em Saúde", "privado", "s3"),
        ("dcgroup", "DC Group", "privado", "dcgroup"),
        ("spx", "SPX Imagem", "privado", "spx"),
        (
            "leiriadeandrade",
            "Hospital de Olhos Leiria de Andrade",
            "privado",
            "leiria",
        ),
        (
            "hmdcc",
            "Hospital Metropolitano Dr. Célio de Castro",
            "publico",
            "hmdcc",
        ),
        (
            "htejz",
            "Hospital de Transplantes Euryclides de Jesus Zerbini",
            "publico",
            "htejz",
        ),
        ("ninasaude", "Nina Saúde", "privado", "nina"),
        ("ciadaconsulta", "Cia da Consulta", "privado", "cia"),
        ("sbsc", "Hospital São Camilo SP", "privado", "saocamilo"),
        ("fp", "FP Saúde", "privado", "fp"),
        ("gruposhbrasil", "Grupo SH Brasil", "privado", "sh"),
        # Lote Out 2026 — clínicas / diagnóstico / operadoras (filtro saúde)
        ("cmdp", "Centro Médico Dom Pedro", "privado", "cmdp"),
        ("rbdimagem", "RBD Imagem", "privado", "rbd"),
        ("clinicaflorence", "Clínica Florence", "privado", "florence"),
        ("prodalsaude", "Prodal Saúde", "privado", "prodal"),
        ("vagasamparosaude", "Amparo Saúde", "privado", "amparo"),
        ("medsenior", "MedSênior", "privado", "medsenior"),
    ]


class GupyHospitais2Scraper(GupyScraper):
    """Hospitais Gupy (lote 2, Out 2026) — multi-board com filtro hospitalar.

    Mesmo critério dos scrapers dedicados de um só hospital (Moinhos, BP…):
    mantém funções hospitalares (recepção, faturamento, higienização…) e
    descarta só IT/jurídico/banco de talentos. Clínicas e operadoras ficam em
    `cauda_gupy` (filtro saúde).
    """

    slug = "gupy_hospitais_2"
    name = "Hospitais (Gupy, lote 2)"
    subdomain = "fundacaojosesilveira"
    company = "Fundação José Silveira"
    sector = "ipss"
    filter_mode = "hospital"
    enrich_details = True

    BOARDS: list[Board] = [
        ("fundacaojosesilveira", "Fundação José Silveira", "ipss", "fjs"),
        (
            "hospitaladventistademanaus",
            "Hospital Adventista de Manaus",
            "ipss",
            "adventista_mao",
        ),
        ("mariopenna", "Rede Mário Penna", "ipss", "mariopenna"),
        ("hospitalfeliciorocho", "Hospital Felício Rocho", "ipss", "feliciorocho"),
        ("queroserhnipo", "Hospital Nipo-Brasileiro", "ipss", "nipo"),
        ("gruposantajoana", "Grupo Santa Joana", "privado", "santajoana"),
        ("sabarahospitalinfantil", "Sabará Hospital Infantil", "ipss", "sabara"),
        ("hsl", "Hospital Santa Lucinda", "ipss", "santalucinda"),
        ("checkuphospital", "Check Up Hospital Manaus", "privado", "checkup"),
    ]


class FarmaciasGupyScraper(GupyScraper):
    """Redes de farmácias/drogarias (Gupy) — só farmacêutico(a) e técnico em farmácia.

    Filtro estrito no título da LISTAGEM (antes de pedir detalhes): RD Saúde
    sozinha tem ~1,9k vagas, ~700 de farmacêutico; balconistas, caixas,
    estoquistas, perfumistas, gerentes de loja não-farmacêuticos ficam de fora.
    """

    slug = "farmacias_gupy"
    name = "Redes de farmácias (Gupy)"
    subdomain = "rdsaude-farmacia"
    company = "RD Saúde (Raia Drogasil)"
    sector = "privado"
    filter_mode = "pharmacist"
    profession_override = "Farmácia"
    enrich_details = True

    BOARDS: list[Board] = [
        ("rdsaude-farmacia", "RD Saúde (Raia Drogasil)", "privado", "rd"),
        ("farmaciaspmenos", "Farmácias Pague Menos", "privado", "pmenos"),
        (
            "paguemenosextrafarma",
            "Pague Menos / Extrafarma",
            "privado",
            "extrafarma",
        ),
        ("drogariaglobo", "Drogaria Globo", "privado", "globo"),
        ("lojaspanvel", "Panvel", "privado", "panvel"),
        (
            "clamedfarma",
            "Clamed (Drogaria Catarinense/Preço Popular)",
            "privado",
            "clamed",
        ),
        ("farmaciasaojoao", "Farmácias São João", "privado", "saojoao"),
        ("redepharma", "Redepharma", "privado", "redepharma"),
        ("grupohiperfarma", "Grupo Hiperfarma", "privado", "hiperfarma"),
        ("drogaosuper", "Drogão Super", "privado", "drogaosuper"),
    ]
