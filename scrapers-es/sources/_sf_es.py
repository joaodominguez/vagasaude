"""SAP SuccessFactors Career Site Builder (Jobs2Web) para España: listado /search/ + ficha.

Sirve para sitios tipo empleo.vithas.es, empleo.cofares.es o canaldeempleo.es/CLECE.
El listado (50 filas por página, `startrow`) ya trae título, localidad y fecha; la ficha solo se
descarga para las ofertas clínicas (tope `max_details`) para obtener la descripción.
"""
from __future__ import annotations

import html as html_lib
import re
from datetime import datetime, timezone

from common.http import HttpClient
from common.models import JobPayload
from common.normalize import guess_contract, html_to_text

from ._es_common import es_profession
from ._private_es import is_health_role, region_with_fallback
from sources._detail_cache import DetailCache

PAGE_SIZE = 50
MAX_PAGES = 12
_MONTHS = {"ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6, "jul": 7, "ago": 8,
           "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dic": 12}
_ROW_SPLIT = re.compile(r'<tr class="data-row"')
_LINK_RE = re.compile(r'<a href="([^"]+)" class="jobTitle-link">([^<]*)</a>')
_LOC_RE = re.compile(r'class="colLocation[^"]*"[^>]*>\s*<span class="jobLocation">\s*(.*?)\s*</span>', re.S)
_DATE_RE = re.compile(r'<span class="jobDate">\s*([^<]*?)\s*</span>')
_TOTAL_RE = re.compile(r"resultados \d+ a \d+ de (\d+)")
_DESC_RE = re.compile(r'itemprop="description"[^>]*>(.*?)</span>\s*</div>\s*</div>', re.S)
_ID_RE = re.compile(r"/(\d{6,})/?$")
_NOT_ES = {"portugal", "pt", "francia", "fr", "italia", "it", "alemania", "de", "reino unido", "uk", "gb",
           "méxico", "mexico", "mx", "chile", "cl", "colombia", "co", "perú", "peru", "pe", "brasil", "br"}
_COUNTRY_TOKENS = {"es", "españa", "spain", "esp"}


def parse_date(value: str | None) -> str | None:
    """'4 nov 2026' -> ISO UTC."""
    match = re.match(r"(\d{1,2})\s+([a-záéíóú]+)\.?\s+(\d{4})", (value or "").strip().lower())
    if not match:
        return None
    month = _MONTHS.get(match.group(2)[:4]) or _MONTHS.get(match.group(2)[:3])
    if not month:
        return None
    return datetime(int(match.group(3)), month, int(match.group(1)), tzinfo=timezone.utc).isoformat()


def parse_location(raw: str) -> tuple[str | None, str | None, str | None, bool]:
    """'Arnedo, La Rioja , España, 28580' -> (ciudad, región, cp, es_españa)."""
    tokens = [t.strip() for t in html_lib.unescape(raw or "").split(",") if t.strip()]
    if any(t.lower() in _NOT_ES for t in tokens):
        return None, None, None, False
    postal = next((t for t in tokens if re.fullmatch(r"\d{4,5}", t)), None)
    words = [t for t in tokens if t != postal and t.lower() not in _COUNTRY_TOKENS]
    city = words[0] if words else None
    region = words[1] if len(words) > 1 else None
    return city, region, postal, True


def parse_listing(page: str) -> tuple[list[dict], int | None]:
    rows = []
    for chunk in _ROW_SPLIT.split(page)[1:]:
        link = _LINK_RE.search(chunk)
        if not link:
            continue
        loc = _LOC_RE.search(chunk)
        date = _DATE_RE.search(chunk)
        rows.append({
            "path": html_lib.unescape(link.group(1)),
            "title": html_to_text(html_lib.unescape(link.group(2))).strip(),
            "location": re.sub(r"\s+", " ", html_to_text(loc.group(1))).strip() if loc else "",
            "date": date.group(1) if date else None,
        })
    total = _TOTAL_RE.search(page)
    return rows, int(total.group(1)) if total else None


def parse_description(page: str) -> str:
    match = _DESC_RE.search(page)
    return html_to_text(match.group(1)) if match else ""


def build_job(row: dict, base: str, slug: str, company: str, sector: str = "privado",
              description: str = "", clean_title=None) -> JobPayload | None:
    title = row["title"]
    if not title or not is_health_role(title):
        return None
    city, region, postal, is_es = parse_location(row["location"])
    if not is_es:
        return None
    id_match = _ID_RE.search(row["path"])
    if not id_match:
        return None
    district = region_with_fallback(city, region, postal, title)
    shown_title = clean_title(title) if clean_title else title
    url = row["path"] if row["path"].startswith("http") else base.rstrip("/") + row["path"]
    return JobPayload(
        title=shown_title,
        company=company,
        location_district=district,
        location_concelho=city.title() if city else None,
        profession=es_profession(title),
        specialty=None,
        sector=sector,
        contract_type=guess_contract(f"{title}\n{description[:1500]}"),
        description=description or f"{shown_title} — {row['location']}".strip(" —"),
        requirements=None,
        salary=None,
        application_url=url,
        source=slug,
        source_id=id_match.group(1),
        published_at=parse_date(row["date"]),
    )


def fetch_sf_es(base: str, slug: str, company: str, sector: str = "privado",
                search_prefix: str = "", max_details: int = 60,
                clean_title=None) -> tuple[list[JobPayload], bool]:
    """Devuelve (ofertas clínicas de España, completo)."""
    client = HttpClient()
    jobs: list[JobPayload] = []
    seen: set[str] = set()
    complete = True
    details = 0
    cache = DetailCache(slug)
    try:
        start = 0
        for page_no in range(MAX_PAGES):
            url = f"{base.rstrip('/')}{search_prefix}/search/?q=&startrow={start}"
            try:
                rows, total = parse_listing(client.get_text(url))
            except Exception:  # noqa: BLE001
                if page_no == 0:
                    raise
                complete = False
                break
            if not rows:
                break
            for row in rows:
                job = build_job(row, base, slug, company, sector, clean_title=clean_title)
                if not job or job.source_id in seen:
                    continue
                seen.add(job.source_id)
                cached = cache.get(job.source_id)
                description = (cached or {}).get("description") or ""
                if not cached and details < max_details:
                    details += 1
                    try:
                        description = parse_description(client.get_text(job.application_url))
                    except Exception:  # noqa: BLE001
                        description = ""
                    if description:
                        cache.set(job.source_id, {"description": description})
                if description:
                    job.description = description
                    job.contract_type = guess_contract(f"{row['title']}\n{description[:1500]}")
                jobs.append(job)
            start += PAGE_SIZE
            if total is not None and start >= total:
                break
        else:
            complete = False
    finally:
        client.close()
        cache.save(prune=complete)
    return jobs, complete
