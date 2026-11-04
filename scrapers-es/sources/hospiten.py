"""Hospiten (SAP SuccessFactors / Jobs2Web): sitemap.xml -> microdatos schema.org de cada oferta."""
from __future__ import annotations

import html as html_lib
import re
from datetime import datetime, timezone

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text

from ._es_common import es_profession, is_clinical, region_from

BASE = "https://jobs.hospiten.com"
MAX_JOBS = 400  # tope de seguridad (el sitio publica ~50)

_LOC_RE = re.compile(r"<loc>([^<]+)</loc>")
_META_RE = re.compile(r'<meta itemprop="([^"]+)" content="([^"]*)"')
_TITLE_RE = re.compile(r'itemprop="title"[^>]*>(.*?)</span>', re.S)
_DESC_RE = re.compile(
    r'itemprop="description"[^>]*>(.*?)</span>\s*</div>\s*</div>', re.S
)
_ID_RE = re.compile(r"/(\d{6,})/?$")


def sitemap_job_urls(xml: str) -> list[str]:
    urls = [html_lib.unescape(u) for u in _LOC_RE.findall(xml)]
    return [u for u in urls if "/job/" in u]


def _date(value: str | None) -> str | None:
    # "Wed Oct 07 00:00:00 UTC 2026"
    if not value:
        return None
    try:
        dt = datetime.strptime(value.replace(" UTC", ""), "%a %b %d %H:%M:%S %Y")
    except ValueError:
        return None
    return dt.replace(tzinfo=timezone.utc).isoformat()


def parse_job(page: str, url: str, slug: str = "hospiten") -> JobPayload | None:
    meta: dict[str, str] = {}
    for key, value in _META_RE.findall(page):
        meta.setdefault(key, html_lib.unescape(value))
    if (meta.get("addressCountry") or "ES").upper() != "ES":
        return None
    title_match = _TITLE_RE.search(page)
    title = html_to_text(title_match.group(1)).strip() if title_match else ""
    if not title or not is_clinical(title):
        return None
    id_match = _ID_RE.search(url)
    if not id_match:
        return None
    city = (meta.get("addressLocality") or "").strip() or None
    district = region_from(city, meta.get("addressRegion"), meta.get("postalCode"))
    desc_match = _DESC_RE.search(page)
    description = html_to_text(desc_match.group(1)) if desc_match else ""
    # Los títulos llevan "_Centro - Hospiten": se dejan tal cual salvo el sufijo de marca.
    clean_title = re.sub(r"\s*-\s*Hospiten\s*$", "", title).replace("_", " - ", 1) if "_" in title else title
    return JobPayload(
        title=clean_title,
        company="Hospiten",
        location_district=district,
        location_concelho=city.title() if city else None,
        profession=es_profession(title),
        specialty=None,
        sector="privado",
        contract_type=guess_contract(f"{title}\n{description[:1500]}"),
        description=description or title,
        requirements=None,
        salary=None,
        application_url=url,
        source=slug,
        source_id=id_match.group(1),
        published_at=_date(meta.get("datePosted")),
    )


class HospitenScraper(BaseScraper):
    slug = "hospiten"
    name = "Hospiten — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        complete = True
        try:
            urls = sitemap_job_urls(client.get_text(f"{BASE}/sitemap.xml"))[:MAX_JOBS]
            if not urls:
                raise RuntimeError("sitemap de Hospiten sin ofertas")
            for url in urls:
                try:
                    page = client.get_text(url)
                except Exception:  # noqa: BLE001
                    complete = False
                    continue
                job = parse_job(page, url, self.slug)
                if job and job.source_id not in seen:
                    seen.add(job.source_id)
                    jobs.append(job)
        finally:
            client.close()
        self.last_listings_complete = complete
        return jobs
