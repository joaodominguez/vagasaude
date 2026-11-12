"""CODEM — Ilustre Colegio Oficial de Enfermería de Madrid: ofertas de empleo (tablón público).

``https://www.codem.es/tablon-de-anuncios-empleo`` lista ~70 ofertas de empresas sanitarias (hospitales
privados, residencias, clínicas, ETT sanitarias) sin login; la paginación es un postback ASP.NET (se reenvían
los campos ocultos con ``btnSiguiente``). Cada ficha ``/Canales/Ficha.aspx?IdMenu=...&Cod=...`` indica empresa,
puesto, centro, duración, jornada, turno y convenio. No se copian persona/teléfono/email de contacto.
robots.txt inexistente (404). Se descartan ofertas con más de 60 días. Añadido 2026-11-12.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_profession, norm

from ._detail_cache import DetailCache
from ._private_es import EXTRA_CITY_REGION

BASE = "https://www.codem.es"
LIST_URL = BASE + "/tablon-de-anuncios-empleo"
DETAIL_URL = BASE + "/Canales/Ficha.aspx?IdMenu=25eb8979-1381-40f2-b238-b699a188eccf&Cod={cod}&Idioma=es-ES"
NEXT_BUTTON = "ctl00$ch$wcuPaginacion$btnSiguiente"
MAX_PAGES = 15
MAX_AGE_DAYS = 60
MAX_NEW_DETAILS = 150
_CONTACT_KEYS = ("persona contacto", "telefono", "email", "e-mail", "contacto", "mail")
_PROF_FALLBACKS = (("matron", "Enfermería"), ("fisioterap", "Fisioterapia"), ("tcae", "Técnico de enfermería"))


def _hidden(soup: BeautifulSoup) -> dict[str, str]:
    form = soup.find("form")
    if not form:
        return {}
    return {i["name"]: i.get("value", "") for i in form.find_all("input", attrs={"type": "hidden"}) if i.get("name")}


def parse_listing(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for li in soup.select("#ctl00_ch_ulResultados li"):
        a = li.find("a", href=True)
        fecha = li.select_one(".Fecha")
        if not a:
            continue
        cod = (parse_qs(urlparse(a["href"].replace("&amp;", "&")).query).get("Cod") or [None])[0]
        if not cod:
            continue
        published = None
        if fecha:
            try:
                published = datetime.strptime(fecha.get_text(strip=True), "%d/%m/%Y").date().isoformat()
            except ValueError:
                pass
        out.append({"id": cod.lower(), "title": a.get_text(" ", strip=True), "published": published})
    return out


def parse_detail(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    box = soup.select_one(".CanalFicha")
    fields: dict[str, str] = {}
    free: list[str] = []
    if box:
        for br in box.find_all("br"):
            br.replace_with("\n")
        for line in box.get_text().replace("\xa0", " ").split("\n"):
            line = re.sub(r"\s+", " ", line).strip()
            if not line:
                continue
            k, sep, v = line.partition(":")
            if sep and len(k) < 60 and v.strip():
                fields[norm(k)] = v.strip()
            else:
                free.append(line)
    return {"fields": fields, "free": free}


def build_job(row: dict, detail: dict, source: str = "codem") -> JobPayload | None:
    f = detail.get("fields") or {}
    title = row["title"].strip()
    puesto = f.get("puesto requerido")
    if not f and not detail.get("free"):
        return None
    profession = guess_profession(title)
    if puesto and re.search(r"enferm|matron|fisioterap|tcae", norm(puesto)) and profession in ("Otros", "Gestión y apoyo"):
        profession = guess_profession(puesto)  # "Coordinador/a quirófano" con puesto requerido Enfermera/o
    if profession == "Otros" and puesto:
        profession = guess_profession(puesto)
    if profession == "Otros":
        for needle, label in _PROF_FALLBACKS:
            if needle in norm(title + " " + (puesto or "")):
                profession = label
    if profession == "Otros":
        return None
    place = f.get("lugar fisico del centro de trabajo")
    # Comunidad solo por coincidencia exacta de municipio (una búsqueda por palabra confunde "Barrio Salamanca"
    # o "Arturo Soria" con Castilla y León); el tablón es del colegio de Madrid, así que ese es el valor por defecto.
    district = "Madrid"
    for piece in re.split(r",| y ", place or ""):
        region = EXTRA_CITY_REGION.get(piece.strip(), "España")
        if region != "España" and norm(piece.strip()) not in ("madrid",):
            district = region
            break
    lines = list(detail.get("free") or [])
    labels = {
        "empresa": "Empresa", "actividad de la empresa": "Actividad de la empresa", "puesto requerido": "Puesto requerido",
        "numero de plazas": "Número de plazas", "lugar fisico del centro de trabajo": "Centro de trabajo",
        "duracion del contrato": "Duración del contrato", "jornada laboral": "Jornada laboral",
        "turno de trabajo": "Turno de trabajo", "convenio aplicado": "Convenio aplicado", "mejora de convenio": "Mejora de convenio",
    }
    structured = []
    for key, value in f.items():
        if any(key.startswith(c) for c in _CONTACT_KEYS):
            continue
        structured.append(f"{labels.get(key, key.capitalize())}: {value}")
    description = "\n".join(lines + structured) if lines else "\n".join(structured)
    company = f.get("empresa") or "Oferta vía Colegio Oficial de Enfermería de Madrid"
    if len(company) > 120 or norm(company) in ("confidencial", "no consta", "-"):
        company = "Oferta vía Colegio Oficial de Enfermería de Madrid"
    contract_src = " ".join([f.get("duracion del contrato") or "", f.get("jornada laboral") or "", f.get("turno de trabajo") or ""])
    return JobPayload(
        title=title,
        company=company,
        location_district=district,
        location_concelho=place if place and len(place) < 60 else None,
        profession=profession,
        specialty=None,
        sector="privado",
        contract_type=guess_contract(f.get("duracion del contrato")) or guess_contract(contract_src),
        description=description[:8000],
        requirements=None,
        salary=None,
        application_url=DETAIL_URL.format(cod=row["id"]),
        source=source,
        source_id=row["id"],
        published_at=row.get("published"),
    )


class CodemScraper(BaseScraper):
    slug = "codem"
    name = "CODEM — Ofertas de empleo de enfermería"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        cache = DetailCache(self.slug)
        jobs: list[JobPayload] = []
        rows: dict[str, dict] = {}
        cutoff = (date.today() - timedelta(days=MAX_AGE_DAYS)).isoformat()
        new_details = 0
        try:
            html = client.get_text(LIST_URL)
            for page in range(MAX_PAGES):
                batch = parse_listing(html)
                fresh = [r for r in batch if r["id"] not in rows]
                if not fresh:
                    break
                for r in fresh:
                    rows[r["id"]] = r
                if all((r["published"] or "9") < cutoff for r in fresh):
                    break
                form = _hidden(BeautifulSoup(html, "html.parser"))
                if not form or "Siguiente" not in html:
                    break
                form[NEXT_BUTTON] = "Siguiente"
                try:
                    resp = client.post_form_response(LIST_URL, form)
                    resp.raise_for_status()
                    html = resp.text
                except Exception:  # noqa: BLE001
                    self.last_listings_complete = False
                    break
            else:
                self.last_listings_complete = False
            if not rows:
                raise RuntimeError("CODEM: listado sin ofertas")
            for row in rows.values():
                if (row["published"] or "9") < cutoff:
                    continue
                detail = cache.get(row["id"])
                if not detail:
                    if new_details >= MAX_NEW_DETAILS:
                        self.last_listings_complete = False
                        continue
                    new_details += 1
                    try:
                        detail = parse_detail(client.get_text(DETAIL_URL.format(cod=row["id"])))
                    except Exception:  # noqa: BLE001
                        self.last_listings_complete = False
                        continue
                    cache.set(row["id"], detail)
                job = build_job(row, detail, self.slug)
                if job:
                    jobs.append(job)
            cache.save(prune=self.last_listings_complete)
        finally:
            client.close()
        return jobs
