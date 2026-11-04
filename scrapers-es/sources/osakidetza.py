"""Osakidetza — avisos de apertura de inscripción en las listas de contratación temporal.

https://www.osakidetza.euskadi.eus/contratacion-temporal/webosk00-procon/es/
robots.txt no restringe esta ruta. La página publica avisos tipo "APERTURA PLAZO
INSCRIPCIÓN <categoría>" con resolución y fecha límite; solo se emiten los que siguen
abiertos (suelen ser pocos y puntuales). Las ofertas concretas por llamamiento no son
públicas (área privada). Las convocatorias de jefaturas llegan por BOE (fuente `boe`).
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import html_to_text, norm

from ._es_common import es_profession, is_clinical

URL = "https://www.osakidetza.euskadi.eus/contratacion-temporal/webosk00-procon/es/"
MONTHS = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7,
    "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}
_DATE = r"(\d{1,2}) de ([a-záéíóú]+) de (\d{4})"
_ANNOUNCE_RE = re.compile(r"^\s*(APERTURA[^\n]*?)\s*$\n(.*?)(?=^\s*[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ \-–/]{12,}\s*$|\Z)", re.M | re.S)
_RES_RE = re.compile(r"Resoluci[oó]n (\d+/\d{4})")
_DEADLINE_RE = re.compile(r"plazo de inscripci[oó]n hasta el " + _DATE, re.I)
_TITLE_PREFIX_RE = re.compile(r"^APERTURA\s+PLAZO\s+INSCRIPCI[OÓ]N\s+(LISTAS\s+)?(PUESTOS\s+FUNCIONALES\s+)?", re.I)


def _to_date(day: str, month: str, year: str):
    m = MONTHS.get(month.lower())
    return datetime(int(year), m, int(day), 23, 59, tzinfo=timezone.utc) if m else None


def parse_announcements(text: str, now: datetime | None = None) -> list[JobPayload]:
    now = now or datetime.now(timezone.utc)
    jobs: list[JobPayload] = []
    for match in _ANNOUNCE_RE.finditer(text):
        heading, body = match.group(1).strip(), match.group(2)
        resolution = _RES_RE.search(body)
        deadline = _DEADLINE_RE.search(body)
        if not resolution or not deadline:
            continue
        expires = _to_date(*deadline.groups())
        if not expires or expires < now:
            continue
        category = _TITLE_PREFIX_RE.sub("", heading).strip().lower().capitalize()
        if not category or not is_clinical(category):
            continue
        published = re.search(r"d[ií]a\s+" + _DATE, body, re.I)
        published_dt = _to_date(*published.groups()) if published else None
        title = f"Bolsa de contratación temporal Osakidetza: {category}"
        jobs.append(
            JobPayload(
                title=title,
                company="Osakidetza",
                location_district="País Vasco",
                location_concelho=None,
                profession=es_profession(category),
                specialty=None,
                sector="publico",
                contract_type="Temporal",
                description=re.sub(r"\s+", " ", body).strip(),
                requirements=None,
                salary=None,
                application_url=URL,
                source="osakidetza",
                source_id=f"res-{resolution.group(1).replace('/', '-')}",
                published_at=published_dt.replace(hour=0, minute=0).isoformat() if published_dt else None,
                expires_at=expires.isoformat(),
            )
        )
    return jobs


class OsakidetzaScraper(BaseScraper):
    slug = "osakidetza"
    name = "Osakidetza — Listas de contratación temporal"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        try:
            page = client.get_text(URL)
        finally:
            client.close()
        text = html_to_text(page)
        if "contratación temporal" not in norm(text).replace("contratacion", "contratación"):
            raise RuntimeError("estructura inesperada en la página de Osakidetza")
        return parse_announcements(text)
