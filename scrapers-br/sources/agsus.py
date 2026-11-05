from __future__ import annotations

import re
from datetime import date, datetime, timedelta

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_profession, state_from_uf

# Desde 2026-11 o site da AgSUS é Plone 6 (Volto): a antiga API WordPress devolve 404.
SITE = "https://www.agenciasus.org.br"
API = f"{SITE}/++api++"
SEARCH = f"{API}/@search"
# Etiqueta que o site usa nos editais com inscrições/etapas em curso.
OPEN_SUBJECT = "Processo Seletivo em Andamento"
MAX_ITEMS = 100
# Editais sem bloco de prazo: só os publicados recentemente (os antigos ficam com a etiqueta).
NO_DEADLINE_MAX_AGE_DAYS = 45
UF_RE = re.compile(
    r"\b("
    r"AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO"
    r")\b"
)
REGION_HINTS = (
    ("amazonas", "Amazonas"),
    ("manaus", "Amazonas"),
    ("roraima", "Roraima"),
    ("boa vista", "Roraima"),
    ("acre", "Acre"),
    ("rondonia", "Rondônia"),
    ("rondônia", "Rondônia"),
    ("dsei ", "Brasil"),  # placeholder skipped below
    ("pará", "Pará"),
    ("xingu", "Pará"),
    ("altamira", "Pará"),
    ("tapajos", "Pará"),
    ("tapajós", "Pará"),
    ("mato grosso do sul", "Mato Grosso do Sul"),
    ("mato grosso", "Mato Grosso"),
    ("bahia", "Bahia"),
    ("ceara", "Ceará"),
    ("ceará", "Ceará"),
    ("maranhao", "Maranhão"),
    ("maranhão", "Maranhão"),
    ("tocantins", "Tocantins"),
    ("minas gerais", "Minas Gerais"),
    ("espirito santo", "Espírito Santo"),
    ("espírito santo", "Espírito Santo"),
    ("sao paulo", "São Paulo"),
    ("são paulo", "São Paulo"),
    ("rio de janeiro", "Rio de Janeiro"),
    ("distrito federal", "Distrito Federal"),
    ("brasilia", "Distrito Federal"),
    ("brasília", "Distrito Federal"),
    ("alagoas", "Alagoas"),
    ("sergipe", "Sergipe"),
    ("pernambuco", "Pernambuco"),
    ("parintins", "Amazonas"),
    ("solimoes", "Amazonas"),
    ("solimões", "Amazonas"),
    ("javari", "Amazonas"),
    ("purus", "Amazonas"),
    ("yanomami", "Roraima"),
    ("porto velho", "Rondônia"),
    ("amapá", "Amapá"),
    ("amapa", "Amapá"),
    ("cuiabá", "Mato Grosso"),
    ("cuiaba", "Mato Grosso"),
    ("potiguara", "Paraíba"),
    ("alto rio negro", "Amazonas"),
    ("kaiapó", "Pará"),
    ("kaiapo", "Pará"),
)


class AgsusScraper(BaseScraper):
    """AgSUS — editais de processo seletivo via API REST do Plone (Trabalhe na AgSUS)."""

    slug = "agsus"
    name = "AgSUS — Trabalhe Conosco"
    # A API devolve exatamente os editais com a etiqueta "em andamento".
    authoritative = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.35)
        client.client.headers.update({"Accept": "application/json"})
        try:
            items = self._collect_items(client)
            jobs: list[JobPayload] = []
            today = date.today()
            for item in items:
                title = (item.get("title") or "").strip()
                link = item.get("@id") or ""
                if not title or not link or not self._looks_like_selection(title):
                    continue
                try:
                    detail = client.get_json(API + link.removeprefix(SITE))
                except Exception:  # noqa: BLE001 — um edital falhado não derruba a fonte
                    detail = {}
                prazo = _find_block(detail, "agsusPrazo")
                end_date = _parse_date(prazo.get("dataFim"))
                # Inscrições já encerradas: o edital fica "em andamento" (resultados), mas não é vaga.
                if end_date and end_date < today:
                    continue
                published = _parse_date(item.get("effective"))
                if not end_date and (
                    not published or published < today - timedelta(days=NO_DEADLINE_MAX_AGE_DAYS)
                ):
                    continue
                description = _build_description(title, detail, prazo)
                blob = f"{title} {description[:500]}"
                jobs.append(
                    JobPayload(
                        title=title[:200],
                        company="AgSUS — Agência Brasileira de Apoio à Gestão do SUS",
                        location_district=self._guess_state(blob),
                        location_concelho=None,
                        profession=guess_profession(title),
                        specialty=None,
                        sector="publico",
                        contract_type=guess_contract(blob) or "PSS",
                        description=description[:8000],
                        requirements=None,
                        salary=None,
                        application_url=link,
                        source=self.slug,
                        source_id=str(item.get("UID") or link),
                        published_at=item.get("effective"),
                        expires_at=f"{end_date.isoformat()}T23:59:59-03:00" if end_date else None,
                    )
                )
            return jobs
        finally:
            client.close()

    @staticmethod
    def _collect_items(client: HttpClient) -> list[dict]:
        data = client.get_json(
            SEARCH,
            params={
                "path.query": "/trabalhe-na-agsus",
                "portal_type": "News Item",
                "Subject": OPEN_SUBJECT,
                "sort_on": "effective",
                "sort_order": "descending",
                "b_size": MAX_ITEMS,
                "metadata_fields": ["UID", "effective"],
            },
        )
        items = data.get("items") if isinstance(data, dict) else None
        if not isinstance(items, list):
            raise RuntimeError("AgSUS: resposta inesperada da API de pesquisa do Plone")
        return items

    @staticmethod
    def _looks_like_selection(title: str) -> bool:
        t = title.lower()
        if "cipaa" in t or "eleitoral" in t:
            return False
        return any(
            k in t
            for k in (
                "edital",
                "processo seletivo",
                "pss",
                "seleção",
                "selecao",
                "vaga",
            )
        )

    @staticmethod
    def _guess_state(text: str) -> str:
        m = UF_RE.search(text.upper())
        if m:
            return state_from_uf(m.group(1))
        low = text.lower()
        for needle, name in REGION_HINTS:
            if needle == "dsei ":
                continue
            if needle in low:
                return name
        return "Brasil"


def _find_block(detail: dict, block_type: str) -> dict:
    blocks = detail.get("blocks") if isinstance(detail, dict) else None
    if not isinstance(blocks, dict):
        return {}
    for block in blocks.values():
        if isinstance(block, dict) and block.get("@type") == block_type:
            return block
    return {}


def _parse_date(raw: object) -> date | None:
    if not isinstance(raw, str) or not raw:
        return None
    try:
        return datetime.fromisoformat(raw[:10]).date()
    except ValueError:
        return None


def _fmt(raw: object) -> str:
    d = _parse_date(raw)
    return d.strftime("%d/%m/%Y") if d else ""


def _build_description(title: str, detail: dict, prazo: dict) -> str:
    lines = [title, ""]
    summary = (detail.get("description") or "").strip() if isinstance(detail, dict) else ""
    if summary:
        lines += [summary, ""]
    start, end = _fmt(prazo.get("dataInicio")), _fmt(prazo.get("dataFim"))
    if start and end:
        lines += [f"Inscrições: de {start} a {end}.", ""]
    etapas = prazo.get("etapas") if isinstance(prazo.get("etapas"), list) else []
    if etapas:
        lines.append("Cronograma do processo seletivo:")
        for etapa in etapas:
            nome = (etapa.get("nome") or "").strip()
            ini, fim = _fmt(etapa.get("inicio")), _fmt(etapa.get("fim"))
            if not nome:
                continue
            when = ini if ini == fim or not fim else f"{ini} a {fim}"
            lines.append(f"- {nome}: {when}" if when else f"- {nome}")
        lines.append("")
    anexos = [
        (i.get("title") or "").strip()
        for i in (detail.get("items") or [])
        if isinstance(i, dict) and i.get("@type") == "File"
    ]
    if anexos:
        lines.append("Documentos publicados (edital, anexos e retificações):")
        lines += [f"- {a}" for a in anexos if a]
        lines.append("")
    lines.append(
        "O edital completo, com o quadro de vagas, requisitos, remuneração e forma de "
        "inscrição, está na página oficial do processo seletivo da AgSUS."
    )
    return "\n".join(lines).strip()
