"""Fresenius Medical Care / NephroCare España — clínicas de diálisis.

Mesma plataforma que o leitor do PT: sitemap público por idioma
(``/sitemap-a4072ddc-es.xml``) com os URLs ``/es/<slug>/job/<id>``; cada ficha tem JSON-LD
``JobPosting`` completo (título, datePosted, validThrough, jobLocation, descrição).
Só ofertas em Espanha (o sitemap "es" pode incluir América Latina) e só funções sanitárias
(fica de fora o que guess_profession classifica como "Otros", ex.: técnicos de campo comerciais).
Adicionado 2026-11-12 (levantamento de fontes novas). Pedidos com ≥1 s de intervalo.
"""
from __future__ import annotations

import json
import re

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_district, guess_profession, html_to_text, norm

SITEMAP = "https://jobs.freseniusmedicalcare.com/sitemap-a4072ddc-es.xml"
COMPANY = "Fresenius Medical Care (NephroCare)"
ES_COUNTRIES = {"es", "esp", "espana", "spain"}
EMPLOYMENT = {"FULL_TIME": "Jornada completa", "PART_TIME": "Media jornada"}
# A Fresenius também publica funções fabris/comerciais (fábricas de consumíveis): ficam de fora.
_NOT_CLINICAL = re.compile(
    r"ingenier|mantenimiento|operari|producci|ensambl|comercial|ventas|log[ií]stic|aprendi|almac[eé]n",
    re.I,
)
# addressRegion vem em código ISO 3166-2:ES ("EX", "AN", "CT") → comunidades do site.
ISO_REGIONS = {
    "AN": "Andalucía", "AR": "Aragón", "AS": "Asturias", "CN": "Canarias", "CB": "Cantabria",
    "CL": "Castilla y León", "CM": "Castilla-La Mancha", "CT": "Cataluña", "CE": "Ceuta",
    "EX": "Extremadura", "GA": "Galicia", "IB": "Islas Baleares", "RI": "La Rioja", "MD": "Madrid",
    "ML": "Melilla", "MC": "Murcia", "NC": "Navarra", "PV": "País Vasco", "VC": "Comunidad Valenciana",
}


class FreseniusEsScraper(BaseScraper):
    slug = "fresenius"
    name = "Fresenius Medical Care (NephroCare)"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        try:
            for url in _sitemap_urls(client.get_text(SITEMAP)):
                job_id = url.rstrip("/").split("/")[-1]
                if job_id in seen:
                    continue
                seen.add(job_id)
                try:
                    html = client.get_text(url)
                except Exception:
                    continue
                job = parse_detail(html, url, self.slug)
                if job:
                    jobs.append(job)
        finally:
            client.close()
        return jobs


def _sitemap_urls(xml: str) -> list[str]:
    out: list[str] = []
    for loc in re.findall(r"<loc>\s*([^<]+?)\s*</loc>", xml):
        if "/job/" in loc and loc not in out:
            out.append(loc)
    return out


def _job_posting(html: str) -> dict | None:
    for raw in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', html, re.S | re.I):
        try:
            data = json.loads(raw)
        except ValueError:
            continue
        for item in data if isinstance(data, list) else [data]:
            if isinstance(item, dict) and item.get("@type") == "JobPosting":
                return item
    return None


def _es_address(posting: dict) -> dict | None:
    locations = posting.get("jobLocation") or []
    if isinstance(locations, dict):
        locations = [locations]
    for loc in locations:
        address = (loc or {}).get("address") or {}
        country = address.get("addressCountry")
        if isinstance(country, dict):
            country = country.get("name")
        if norm(str(country or "")) in ES_COUNTRIES:
            return address
    return None


def parse_detail(html: str, url: str, source: str = "fresenius") -> JobPayload | None:
    posting = _job_posting(html)
    if not posting:
        return None
    address = _es_address(posting)
    if address is None:
        return None
    title = re.sub(r"\s+", " ", posting.get("title") or "").strip()
    profession = guess_profession(title)
    if not title or profession == "Otros" or _NOT_CLINICAL.search(title):
        return None
    # "Celadores/as (Granada)" — a cidade entre parênteses é mais fiável que addressLocality (rua).
    m = re.search(r"\(([^)]+)\)\s*$", title)
    city = (m.group(1).strip() if m else None) or (address.get("addressLocality") or "").strip() or None
    region = (address.get("addressRegion") or "").strip() or None
    district = ISO_REGIONS.get((region or "").upper()) or guess_district(city, region)
    if district == "España":
        district = guess_district(address.get("addressLocality"), None)
    description = html_to_text(posting.get("description")) or title
    types = posting.get("employmentType") or []
    if isinstance(types, str):
        types = [types]
    contract = next((EMPLOYMENT[t] for t in types if t in EMPLOYMENT), None) or guess_contract(description[:600])
    valid = posting.get("validThrough")
    return JobPayload(
        title=title,
        company=COMPANY,
        location_district=district,
        location_concelho=city,
        profession=profession,
        specialty="Diálisis",
        sector="privado",
        contract_type=contract,
        description=description[:8000],
        requirements=None,
        salary=None,
        application_url=posting.get("url") or url,
        source=source,
        source_id=url.rstrip("/").split("/")[-1],
        published_at=posting.get("datePosted"),
        expires_at=str(valid)[:10] if valid else None,
    )
