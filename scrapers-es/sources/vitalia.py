"""Vitalia (residencias de mayores, neurorrehabilitación y salud mental) — web WordPress propia.

Sitemap público ``/vitaliaempleo-sitemap.xml`` (Yoast; robots.txt no bloquea ``/vitaliaempleo/``) con
una URL por oferta; cada ficha incluye JSON-LD ``JobPosting`` dentro de un ``@graph``.
Solo funciones sanitarias/sociosanitarias; se descartan mantenimiento, cocina, limpieza,
servicios centrales y bolsas/candidaturas espontáneas. Añadido 2026-11-12.
"""
from __future__ import annotations

import json
import re

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_district, html_to_text, norm

from ._es_common import region_from
from .ballesol import _NOT_CLINICAL, _POOL, _profession

SITEMAP = "https://www.vitaliahome.es/vitaliaempleo-sitemap.xml"
LISTING = "https://www.vitaliahome.es/vitaliaempleo/"
COMPANY = "Vitalia"
EMPLOYMENT = {"FULL_TIME": "Jornada completa", "PART_TIME": "Media jornada", "TEMPORARY": "Temporal"}
_CORPORATE = re.compile(r"servicios centrales|arquitect|ingenier|comercial|marketing|\bit\b|inform[aá]tic|cocinero|auxiliar de servicios", re.I)


def sitemap_urls(xml: str) -> list[str]:
    out: list[str] = []
    for loc in re.findall(r"<loc>\s*([^<]+?)\s*</loc>", xml):
        if loc.rstrip("/") != LISTING.rstrip("/") and loc not in out:
            out.append(loc)
    return out


def job_posting(html: str) -> dict | None:
    for raw in re.findall(r"<script[^>]*ld\+json[^>]*>(.*?)</script>", html, re.S | re.I):
        try:
            data = json.loads(raw)
        except ValueError:
            continue
        items = data if isinstance(data, list) else (data.get("@graph") or [data])
        for item in items:
            if isinstance(item, dict) and item.get("@type") == "JobPosting":
                return item
    return None


def parse_detail(html: str, url: str, source: str = "vitalia") -> JobPayload | None:
    posting = job_posting(html)
    if not posting:
        return None
    base_title = re.sub(r"\s+", " ", posting.get("title") or "").strip()
    if not base_title or _POOL.search(base_title) or _NOT_CLINICAL.search(base_title) or _CORPORATE.search(base_title):
        return None
    location = posting.get("jobLocation") or {}
    if isinstance(location, list):
        location = location[0] if location else {}
    address = (location or {}).get("address") or {}
    if norm(str(address.get("addressCountry") or "ES")) not in {"es", "esp", "espana", "spain"}:
        return None
    profession = _profession(base_title)
    if profession == "Otros":
        return None
    city = (address.get("addressLocality") or "").strip() or None
    province = (address.get("addressRegion") or "").strip() or None
    district = guess_district(city, province)
    if district == "España":
        district = region_from(city, province, address.get("postalCode"))
        if district == "España":
            district = guess_district(location.get("name"), None)
    if district == "España":
        return None  # sin centro/localidad: ficha genérica "en España" (bolsa), no una vacante concreta
    center = (location.get("name") or "").strip()
    title = f"{base_title} - {center}" if center and norm(center) not in norm(base_title) else base_title
    description = html_to_text(posting.get("description")) or title
    types = posting.get("employmentType") or []
    if isinstance(types, str):
        types = [types]
    contract = guess_contract(description[:800]) or next((EMPLOYMENT[t] for t in types if t in EMPLOYMENT), None)
    valid = posting.get("validThrough")
    ident = (posting.get("identifier") or {}).get("value") or url.rstrip("/").split("/")[-1]
    return JobPayload(
        title=title,
        company=COMPANY,
        location_district=district,
        location_concelho=city,
        profession=profession,
        specialty="Geriatría",
        sector="privado",
        contract_type=contract,
        description=description[:8000],
        requirements=None,
        salary=None,
        application_url=posting.get("url") or url,
        source=source,
        source_id=str(ident),
        published_at=(posting.get("datePosted") or "")[:10] or None,
        expires_at=str(valid)[:10] if valid else None,
    )


class VitaliaScraper(BaseScraper):
    slug = "vitalia"
    name = "Vitalia — Empleo"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        try:
            for url in sitemap_urls(client.get_text(SITEMAP)):
                try:
                    job = parse_detail(client.get_text(url), url, self.slug)
                except Exception:  # noqa: BLE001
                    continue
                if job and job.source_id not in seen:
                    seen.add(job.source_id)
                    jobs.append(job)
        finally:
            client.close()
        return jobs
