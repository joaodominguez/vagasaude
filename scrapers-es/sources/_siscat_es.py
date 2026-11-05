"""Utilidades compartidas por los scrapers de entidades SISCAT de Cataluña (no es una fuente).

Las webs publican en catalán (algunas también en español). Aquí: fechas, contrato,
construcción de JobPayload y recorrido con caché de detalles.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Callable

from common.models import JobPayload
from common.normalize import guess_contract, html_to_text, norm

from ._detail_cache import DetailCache
from ._es_common import es_profession
from ._private_es import is_health_role

REGION = "Cataluña"

_CA_MONTHS = {
    "gener": 1, "febrer": 2, "marc": 3, "abril": 4, "maig": 5, "juny": 6, "juliol": 7,
    "agost": 8, "setembre": 9, "octubre": 10, "novembre": 11, "desembre": 12,
}
_ES_MONTHS = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7,
    "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}


def _iso(y: int, m: int, d: int, end_of_day: bool = False) -> str | None:
    try:
        dt = datetime(y, m, d, 23 if end_of_day else 0, 59 if end_of_day else 0, 0, tzinfo=timezone.utc)
    except ValueError:
        return None
    return dt.isoformat()


def dmy_to_iso(text: str | None, end_of_day: bool = False) -> str | None:
    """'31/12/2026' o '3-11-2026' -> ISO UTC."""
    m = re.search(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", text or "")
    return _iso(int(m.group(3)), int(m.group(2)), int(m.group(1)), end_of_day) if m else None


def text_date_to_iso(text: str | None, end_of_day: bool = False, assume_past_year: bool = True) -> str | None:
    """'18 de setembre de 2026', "1 d'octubre de 2026", '29 de Octubre' (sin año -> año actual,
    o el anterior si caería en el futuro)."""
    t = re.sub(r"\bde de\b", "de", (text or "").lower())
    m = re.search(r"(\d{1,2})\s*(?:de|d['’])?\s*([a-zçéèàíòóú]+)(?:\s*(?:de|del)?\s*(\d{4}))?", t)
    if not m:
        return None
    month = _CA_MONTHS.get(m.group(2)) or _ES_MONTHS.get(m.group(2))
    if not month:
        return None
    day = int(m.group(1))
    if m.group(3):
        return _iso(int(m.group(3)), month, day, end_of_day)
    now = datetime.now(timezone.utc)
    year = now.year
    if assume_past_year and datetime(year, month, min(day, 28), tzinfo=timezone.utc) > now:
        year -= 1
    return _iso(year, month, day, end_of_day)


def contract_from(text: str) -> str | None:
    """guess_contract con términos catalanes traducidos."""
    t = (text or "")[:3000].lower()
    t = (t.replace("indefinit", "indefinido").replace("mitja jornada", "media jornada")
         .replace("substitució", "sustitución").replace("interinatge", "interinidad")
         .replace("contracte", "contrato"))
    return guess_contract(t)


_TITLE_PREFIX_RE = re.compile(
    r"^\s*(?:(?:oferta|convocat[òo]ria(?: p[úu]blica)?)(?: de treball)?\s+per(?:\s+a)?\s+(?:la\s+)?"
    r"(?:cobrir|cobertura|provisi[óo])\s+(?:de\s+|d['’])?|)"
    r"(?:un|una|dos|dues|tres)\s+(?:llocs?|places?)\s+de\s+treball\s+(?:de\s+|d['’])?",
    re.I,
)
_REF_SUFFIX_RE = re.compile(r"[.\s]*Refer[èe]ncia:\s*\S+\s*$", re.I)
_NON_HEALTH_EXTRA_RE = re.compile(r"logistic|econom|licitaci|enginyer|projectes tic|nomines|formacio profes")


def clean_title(title: str) -> str:
    t = re.sub(r"\s+", " ", (title or "").replace("\xa0", " ")).strip()
    cleaned = _TITLE_PREFIX_RE.sub("", t).strip()
    cleaned = _REF_SUFFIX_RE.sub("", cleaned).strip()
    if cleaned and cleaned != t:
        cleaned = cleaned[0].upper() + cleaned[1:]
        return cleaned
    return t


def build_job(
    *,
    slug: str,
    company: str,
    title: str,
    city: str | None,
    description: str,
    source_id: str,
    url: str,
    published_at: str | None = None,
    expires_at: str | None = None,
    sector: str = "publico",
    requirements: str | None = None,
    contract_text: str = "",
) -> JobPayload | None:
    """None si el puesto no es sanitario."""
    if not title or not is_health_role(title) or _NON_HEALTH_EXTRA_RE.search(norm(title)):
        return None
    description = description.strip() or title
    return JobPayload(
        title=title,
        company=company,
        location_district=REGION,
        location_concelho=city,
        profession=es_profession(title),
        specialty=None,
        sector=sector,
        contract_type=contract_from(contract_text or description),
        description=description,
        requirements=requirements,
        salary=None,
        application_url=url,
        source=slug,
        source_id=source_id,
        published_at=published_at,
        expires_at=expires_at,
    )


def cached_detail(cache: DetailCache, key: str, fetch: Callable[[], dict]) -> dict | None:
    """Detalle desde caché o descargado; None si falla la descarga (la oferta se omite o se degrada)."""
    hit = cache.get(key)
    if hit:
        return hit
    try:
        value = fetch()
    except Exception:  # noqa: BLE001
        return None
    cache.set(key, value)
    return value


__all__ = [
    "REGION", "dmy_to_iso", "text_date_to_iso", "contract_from", "clean_title",
    "build_job", "cached_detail", "html_to_text", "DetailCache",
]
