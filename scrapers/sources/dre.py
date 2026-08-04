from __future__ import annotations

import json
import re
import subprocess
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

from common.models import BaseScraper, JobPayload
from common.normalize import guess_district, guess_profession, html_to_text

ROOT = Path(__file__).resolve().parents[1]
SEARCH_SCRIPT = ROOT / "tools" / "dre_search.mjs"
BASE = "https://diariodarepublica.pt"

# Só avisos recentes — concursos públicos têm prazos curtos.
MAX_AGE_DAYS = 120

OPEN_RE = re.compile(
    r"abertura|procedimento concursal|constitui[cç][aã]o de (bolsa|reserva)|"
    r"reserva de recrutamento|recrutamento de|contrata[cç][aã]o de",
    re.I,
)
CLOSED_RE = re.compile(
    r"homologa[cç][aã]o|lista de ordena[cç][aã]o|lista de classifica[cç][aã]o|"
    r"classifica[cç][aã]o final|cessa[cç][aã]o|"
    r"conclus[aã]o com sucesso|celebra[cç][aã]o de contrato|"
    r"declara[cç][aã]o de retifica|per[ií]odo experimental conclu",
    re.I,
)
HEALTH_RE = re.compile(
    r"enferm|m[eé]dic|fisioterap|farmaceut|auxiliar de sa|"
    r"t[eé]cnico auxiliar de sa|diagn[oó]stico e terap|"
    r"unidade local de sa|uls\b|ipo\b|oncolog|sa[uú]de|"
    r"terapeuta|psicolog|nutric|radiolog|cardiopneum",
    re.I,
)


class DreScraper(BaseScraper):
    slug = "dre"
    name = "Diário da República (avisos Série II)"

    def fetch(self) -> list[JobPayload]:
        sources = _run_search()
        cutoff = datetime.now(timezone.utc).date() - timedelta(days=MAX_AGE_DAYS)
        jobs: list[JobPayload] = []
        for src in sources:
            job = _to_job(src, cutoff)
            if job:
                jobs.append(job)
        return jobs


def _run_search() -> list[dict]:
    if not SEARCH_SCRIPT.exists():
        raise FileNotFoundError(f"Script DR em falta: {SEARCH_SCRIPT}")
    proc = subprocess.run(
        ["node", str(SEARCH_SCRIPT)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=420,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"dre_search falhou ({proc.returncode}): {proc.stderr[-800:]}"
        )
    raw = proc.stdout.strip()
    if not raw:
        raise RuntimeError(f"dre_search sem output: {proc.stderr[-500:]}")
    data = json.loads(raw)
    if not isinstance(data, list):
        raise RuntimeError("dre_search: JSON inesperado")
    return data


def _to_job(src: dict, cutoff) -> JobPayload | None:
    if (src.get("serie") or "").upper() not in {"II", "2", "2.ª", "2A"}:
        # Aceitar também se o título indicar Série II.
        title = src.get("title") or ""
        if "série ii" not in title.lower() and "serie ii" not in _strip(title):
            return None

    published = _parse_date(src.get("dataPublicacao"))
    if published and published.date() < cutoff:
        return None

    designacao = html_to_text(src.get("designacao") or "")
    sumario = html_to_text(src.get("sumario") or "")
    title_raw = html_to_text(src.get("title") or "")
    blob = f"{designacao} {sumario} {title_raw} {src.get('emissor') or ''}"
    if not HEALTH_RE.search(blob):
        return None
    if CLOSED_RE.search(blob):
        return None
    if not OPEN_RE.search(blob):
        return None

    db_id = src.get("dbId") or src.get("id")
    if not db_id:
        return None
    application_url = _detail_url(src)
    company = (src.get("emissor") or "Administração Pública").strip()
    role = designacao or sumario or title_raw
    # Título legível: função + organismo
    title = role.strip()
    if len(title) > 160:
        title = title[:157].rstrip() + "…"
    district = guess_district(
        src.get("concelho") or "",
        f"{company} {role}",
    )
    profession = guess_profession(role)
    description = "\n\n".join(
        p
        for p in (
            role,
            f"Emitente: {company}",
            title_raw,
            "Consulta o aviso completo no Diário da República.",
        )
        if p
    )
    published_at = None
    if published:
        published_at = published.date().isoformat() + "T00:00:00+00:00"

    return JobPayload(
        title=title,
        company=company,
        location_district=district,
        location_concelho=src.get("concelho") or None,
        profession=profession,
        specialty=None,
        sector="publico",
        contract_type="Contrato",
        description=description,
        requirements=None,
        salary=None,
        application_url=application_url,
        source="dre",
        source_id=str(db_id),
        published_at=published_at,
    )


def _detail_url(src: dict) -> str:
    tipo_path = _tipo_path(src.get("tipo") or "aviso")
    numero = str(src.get("numero") or "")
    db_id = src.get("dbId")
    date = _parse_date(src.get("dataPublicacao"))
    key = _construct_key(numero, date, db_id)
    return f"{BASE}/dr/detalhe/{tipo_path}/{key}"


def _tipo_path(tipo: str) -> str:
    t = _strip(tipo).lower()
    for token in (
        " de ",
        " do ",
        " da ",
        " dos ",
        " das ",
        " e ",
        " o ",
        " a ",
        " os ",
        " as ",
    ):
        t = t.replace(token, " ")
    t = re.sub(r"[()]+", " ", t)
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t or "aviso"


def _construct_key(numero: str, date, identifier) -> str:
    numero = (numero or "").lower().replace(" ", "")
    year = str(date.year) if date else ""
    if "/" in numero:
        num_base, rest = numero.split("/", 1)
        for part in rest.split("/"):
            if len(part) == 4 and part.isdigit() and 1750 < int(part) <= 2100:
                year = part
                break
    else:
        num_base = numero
    parts = [p for p in (num_base, year, str(identifier)) if p]
    return "-".join(parts)


def _parse_date(value: str | None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value[:10]).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _strip(text: str) -> str:
    return "".join(
        c
        for c in unicodedata.normalize("NFKD", text or "")
        if not unicodedata.combining(c)
    )
