"""Ballesol (residencias de mayores, ~55 centros) — careers site Viterbit (empleo.ballesol.es).

Sitemap público (``/sitemap.xml``, robots.txt ``Allow: /``) con una URL por oferta; cada ficha
trae JSON-LD ``JobPosting`` (título, fecha, localidad + provincia, descripción HTML).
Solo funciones sanitarias/sociosanitarias (se descarta lo que guess_profession deja en ``Otros``)
y se saltan bolsas/candidaturas espontáneas y páginas informativas. Añadido 2026-11-12.
"""
from __future__ import annotations

import json
import re

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_district, guess_profession, html_to_text, norm

BASE = "https://empleo.ballesol.es"
SITEMAP = f"{BASE}/sitemap.xml"
COMPANY = "Ballesol"
ES_COUNTRIES = {"es", "esp", "espana", "spain"}
_POOL = re.compile(r"espont[aá]ne|bolsa de (empleo|trabajo)|banco de talento|formaci[oó]n y empleo|talent pool", re.I)
_NOT_CLINICAL = re.compile(r"mantenimiento|limpieza|recepci[oó]n|recepcionista|cocin|lavander|administrativ|supervisor|conductor|jardin", re.I)
# Títulos propios del sector residencial que guess_profession puede no reconocer.
_EXTRA = (
    (re.compile(r"gerocultor|auxiliar de geriatr|auxiliar de enfermer|cuidador", re.I), "TCAE"),
    (re.compile(r"terapeuta ocupacional", re.I), "Terapia ocupacional"),
    (re.compile(r"m[eé]dic[oa]|geriatra", re.I), "Medicina"),
    (re.compile(r"fisioterapeuta", re.I), "Fisioterapia"),
    (re.compile(r"psic[oó]log", re.I), "Psicología"),
    (re.compile(r"trabajador[a]? social|animador[a]? sociocultural|educador[a]? social", re.I), "Gestión y apoyo"),
)


def _profession(title: str) -> str:
    profession = guess_profession(title)
    if profession != "Otros":
        return profession
    for pattern, category in _EXTRA:
        if pattern.search(title):
            return category
    return "Otros"


def sitemap_urls(xml: str) -> list[str]:
    out: list[str] = []
    for loc in re.findall(r"<loc>\s*([^<]+?)\s*</loc>", xml):
        if loc.rstrip("/") != BASE and loc not in out:
            out.append(loc)
    return out


def job_posting(html: str) -> dict | None:
    for raw in re.findall(r"<script[^>]*ld\+json[^>]*>(.*?)</script>", html, re.S | re.I):
        try:
            data = json.loads(raw)
        except ValueError:
            continue
        for item in data if isinstance(data, list) else [data]:
            if isinstance(item, dict) and item.get("@type") == "JobPosting":
                return item
    return None


def parse_detail(html: str, url: str, source: str = "ballesol") -> JobPayload | None:
    posting = job_posting(html)
    if not posting:
        return None
    title = re.sub(r"\s+", " ", posting.get("title") or "").strip()
    if not title or _POOL.search(title) or _NOT_CLINICAL.search(title):
        return None
    location = posting.get("jobLocation") or {}
    if isinstance(location, list):
        location = location[0] if location else {}
    address = (location or {}).get("address") or {}
    country = address.get("addressCountry")
    if isinstance(country, dict):
        country = country.get("name")
    if norm(str(country or "ES")) not in ES_COUNTRIES:
        return None
    profession = _profession(title)
    if profession == "Otros":
        return None
    city = (address.get("addressLocality") or "").strip() or None
    province = (address.get("addressRegion") or "").strip() or None
    district = guess_district(city, province)
    description = html_to_text(posting.get("description")) or title
    ident = (posting.get("identifier") or {}).get("value") or url.rstrip("/").split("/")[-1]
    valid = posting.get("validThrough")
    return JobPayload(
        title=title,
        company=COMPANY,
        location_district=district,
        location_concelho=city,
        profession=profession,
        specialty="Geriatría",
        sector="privado",
        contract_type=guess_contract(title) or guess_contract(description[:800]),
        description=description[:8000],
        requirements=None,
        salary=None,
        application_url=posting.get("url") or url,
        source=source,
        source_id=str(ident),
        published_at=posting.get("datePosted"),
        expires_at=str(valid)[:10] if valid else None,
    )


class BallesolScraper(BaseScraper):
    slug = "ballesol"
    name = "Ballesol — Empleo"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        try:
            for url in sitemap_urls(client.get_text(SITEMAP)):
                try:
                    job = parse_detail(client.get_text(url), url, self.slug)
                except Exception:  # noqa: BLE001 - una ficha rota no tumba el resto
                    continue
                if job and job.source_id not in seen:
                    seen.add(job.source_id)
                    jobs.append(job)
        finally:
            client.close()
        return jobs
