"""DomusVi España (Bizneo HR, empleo.domusvi.es): listado paginado /jobs?page=N + ficha (descripción y fecha).

robots.txt solo bloquea /admin. El listado trae título, subcategoría y localidad; la ficha se descarga
solo para las ofertas sanitarias y con tope (MAX_DETAILS) para no machacar el sitio.
"""
from __future__ import annotations

import html as html_lib
import re
from datetime import datetime, timezone

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text

from ._es_common import es_profession
from ._private_es import is_health_role, region_with_fallback
from sources._detail_cache import DetailCache

BASE = "https://empleo.domusvi.es"
MAX_PAGES = 45
MAX_DETAILS = 60

_CARD_SPLIT = re.compile(r'<a class="job-card"')
_HREF_RE = re.compile(r'href="(https://empleo\.domusvi\.es/jobs/[^"]+)"')
_TITLE_RE = re.compile(r'<div class="title">\s*(.*?)\s*</div>', re.S)
_DETAIL_SPANS_RE = re.compile(r'<div class="details">(.*?)</div>', re.S)
_SPAN_RE = re.compile(r"<span[^>]*>(.*?)</span>", re.S)
_ID_RE = re.compile(r"/jobs/[a-z0-9-]*?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$")
_DESC_RE = re.compile(r'<div class="general-content">(.*?)</div>\s*</div>', re.S)
_PUBLISHED_RE = re.compile(r"Publicada\s*<i>\s*(\d{1,2}) de ([A-Za-zéÉ]+)\s*</i>")
_MONTHS = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7,
           "agosto": 8, "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12}


def parse_listing(page: str) -> list[dict]:
    rows = []
    for chunk in _CARD_SPLIT.split(page)[1:]:
        href = _HREF_RE.search(chunk)
        title = _TITLE_RE.search(chunk)
        if not href or not title:
            continue
        details = _DETAIL_SPANS_RE.search(chunk)
        spans = [re.sub(r"\s+", " ", html_to_text(s)).strip() for s in _SPAN_RE.findall(details.group(1))] if details else []
        rows.append({
            "url": html_lib.unescape(href.group(1)),
            "title": html_to_text(html_lib.unescape(title.group(1))).strip(),
            "category": spans[0] if spans else None,
            "city": spans[1] if len(spans) > 1 else None,
        })
    return rows


def parse_detail(page: str, today: datetime | None = None) -> tuple[str, str | None]:
    """(descripción, fecha ISO). La ficha solo da 'Publicada 4 de Noviembre' (sin año)."""
    desc = _DESC_RE.search(page)
    description = html_to_text(desc.group(1)) if desc else ""
    published = None
    match = _PUBLISHED_RE.search(page)
    if match and match.group(2).lower() in _MONTHS:
        now = today or datetime.now(timezone.utc)
        date = datetime(now.year, _MONTHS[match.group(2).lower()], int(match.group(1)), tzinfo=timezone.utc)
        if date > now:  # diciembre visto en enero
            date = date.replace(year=now.year - 1)
        published = date.isoformat()
    return description, published


def build_job(row: dict, slug: str = "domusvi", description: str = "", published_at: str | None = None) -> JobPayload | None:
    title = row["title"]
    id_match = _ID_RE.search(row["url"])
    if not title or not id_match or not is_health_role(title):
        return None
    city = (row.get("city") or "").strip() or None
    return JobPayload(
        title=title,
        company="DomusVi",
        location_district=region_with_fallback(city, None, None, title),
        location_concelho=city,
        profession=es_profession(title),
        specialty=None,
        sector="privado",
        contract_type=guess_contract(f"{title}\n{description[:1500]}"),
        description=description or f"{title} — {city or 'España'}",
        requirements=None,
        salary=None,
        application_url=row["url"],
        source=slug,
        source_id=id_match.group(1),
        published_at=published_at,
    )


class DomusviScraper(BaseScraper):
    slug = "domusvi"
    name = "DomusVi — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        complete = True
        details = 0
        cache = DetailCache(self.slug)
        try:
            for page_no in range(1, MAX_PAGES + 1):
                try:
                    rows = parse_listing(client.get_text(f"{BASE}/jobs?page={page_no}"))
                except Exception:  # noqa: BLE001
                    if page_no == 1:
                        raise
                    complete = False
                    break
                if not rows:
                    break
                for row in rows:
                    job = build_job(row, self.slug)
                    if not job or job.source_id in seen:
                        continue
                    seen.add(job.source_id)
                    cached = cache.get(job.source_id)
                    description, published = "", None
                    if cached:
                        description = cached.get("description") or ""
                        published = cached.get("published")
                    elif details < MAX_DETAILS:
                        details += 1
                        try:
                            description, published = parse_detail(client.get_text(job.application_url))
                        except Exception:  # noqa: BLE001
                            description, published = "", None
                        if description:
                            cache.set(job.source_id, {"description": description, "published": published})
                    if description:
                        job.description = description
                        job.contract_type = guess_contract(f"{row['title']}\n{description[:1500]}")
                    job.published_at = published
                    jobs.append(job)
            else:
                complete = False
        finally:
            client.close()
            cache.save(prune=complete)
        self.last_listings_complete = complete
        return jobs
