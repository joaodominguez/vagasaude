"""eFisioterapia (bolsa de empleo de fisioterapia): https://www.efisioterapia.net/empleo?page=N.

robots.txt veta /node/, /search/, /contenido/ y varios parámetros, pero no /empleo ni las fichas
/empleo/<id>-<slug>. Se pagina hasta no encontrar ofertas nuevas (tope 15 páginas) y se descargan
las fichas con DetailCache (solo las nuevas cuentan para el tope por ejecución). Solo España: el país es
el primer nivel del campo "Provincia" de la ficha (hay ofertas de Francia, etc.).
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text, norm

from ._detail_cache import DetailCache
from ._private_es import region_with_fallback

BASE = "https://www.efisioterapia.net"
LIST_URL = BASE + "/empleo?page={page}"
MAX_PAGES = 15
MAX_NEW_DETAILS = 250
_ID_RE = re.compile(r"^/empleo/(\d+)-")
# Anuncios que no son una oferta de trabajo (alquiler de salas, traspasos, cursos...).
_JUNK_RE = re.compile(r"alquiler|traspas|venta de|se vende|curso|master|oposicion")
_NOT_PHYSIO_TITLE_RE = re.compile(r"monitor|instructor|coordinador|teleasistencia")
_JORNADA = {"completa": "Jornada completa", "parcial": "Media jornada"}


def parse_listing(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for a in soup.select("h3 a[href]"):
        m = _ID_RE.match(a["href"])
        if m:
            out.append({"id": m.group(1), "title": a.get_text(" ", strip=True), "path": a["href"]})
    return out


def is_physio_offer(title: str, description: str) -> bool:
    """Todo el portal es de fisioterapia, pero hay traspasos, monitores de pilates y títulos genéricos
    ("Oferta de empleo Móstoles"): se exige "fisio" en el título o, si es genérico, en el arranque del texto."""
    t = norm(title)
    if _JUNK_RE.search(t):
        return False
    if "fisio" in t or "kinesi" in t:
        return True
    return not _NOT_PHYSIO_TITLE_RE.search(t) and "fisioterap" in norm(description[:800])


def _field(soup: BeautifulSoup, name: str) -> str | None:
    el = soup.select_one(f".field-name-field-empleo-{name} .field-item")
    return el.get_text(" ", strip=True) if el else None


def parse_detail(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    levels = [s.get_text(" ", strip=True) for s in soup.select(".field-name-field-empleo-provincia .lineage-item")]
    body = soup.select_one(".field-name-body")
    return {
        "company": _field(soup, "empresa"),
        "country": levels[0] if levels else None,
        "province": levels[1] if len(levels) > 1 else None,
        "city": _field(soup, "ciudad"),
        "jornada": _field(soup, "jornada"),
        "description": html_to_text(str(body)) if body else "",
    }


class EfisioterapiaScraper(BaseScraper):
    slug = "efisioterapia"
    name = "eFisioterapia — Ofertas de empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        cache = DetailCache(self.slug)
        jobs: list[JobPayload] = []
        rows: dict[str, dict] = {}
        new_details = 0
        try:
            for page in range(MAX_PAGES):
                try:
                    batch = parse_listing(client.get_text(LIST_URL.format(page=page)))
                except Exception:  # noqa: BLE001
                    if page == 0:
                        raise
                    self.last_listings_complete = False
                    break
                fresh = [r for r in batch if r["id"] not in rows]
                if not fresh:
                    break
                for r in fresh:
                    rows[r["id"]] = r
            else:
                self.last_listings_complete = False  # cortado por MAX_PAGES
            if not rows:
                raise RuntimeError("eFisioterapia: listado sin ofertas")
            for row in rows.values():
                title = row["title"]
                if _JUNK_RE.search(norm(title)):
                    continue
                detail = cache.get(row["id"])
                if not detail:
                    if new_details >= MAX_NEW_DETAILS:
                        self.last_listings_complete = False
                        continue
                    new_details += 1
                    try:
                        detail = parse_detail(client.get_text(BASE + row["path"]))
                    except Exception:  # noqa: BLE001
                        self.last_listings_complete = False
                        continue
                    cache.set(row["id"], detail)
                if norm(detail.get("country") or "") != "espana":
                    continue
                if not is_physio_offer(title, detail.get("description") or ""):
                    continue
                city = detail.get("city")
                province = detail.get("province")
                description = detail.get("description") or ""
                if detail.get("company"):
                    description = f"{detail['company']}\n\n{description}".strip()
                jobs.append(JobPayload(
                    title=title,
                    company=detail.get("company") or "Clínica de fisioterapia",
                    location_district=region_with_fallback(city, province, title=title),
                    location_concelho=city.title() if city and (city.isupper() or city.islower()) else city,
                    profession="Fisioterapia",
                    specialty=None,
                    sector="privado",
                    contract_type=guess_contract(title) or guess_contract(description[:1500])
                    or _JORNADA.get(norm(detail.get("jornada") or "")),
                    description=description or title,
                    requirements=None,
                    salary=None,
                    application_url=BASE + row["path"],
                    source=self.slug,
                    source_id=row["id"],
                    published_at=None,
                ))
        finally:
            client.close()
        cache.save(prune=self.last_listings_complete)
        return jobs
