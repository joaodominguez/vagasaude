"""SESPA (Asturias) — convocatorias propias del Servicio de Salud del Principado de Asturias.

https://www.astursalud.es/ (Recursos Humanos · Contratación temporal · «Convocatorias Plazas Temporales» y
Procesos selectivos · «Jefaturas, Coordinaciones y Supervisiones» / «Personal estatutario»). robots.txt solo
bloquea una noticia concreta. No existe lector del BOPA, así que el portal aporta las convocatorias
temporales de plaza única de cada Gerencia de Área (FEA, enfermería, técnicos...), que no pasan por el
boletín nacional ni por otro lector. Cada listado mezcla convocatorias con anuncios de trámite (listas de
admitidos, resoluciones, correcciones): solo se emiten los que "convocan" algo (mismo filtro que los
boletines, `jobs_from_entries`). El plazo real va en un PDF escaneado: se estima como en los boletines
(20 días hábiles desde la fecha de la resolución).
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import date, datetime
from html import unescape
from urllib.parse import parse_qs, unquote, urlparse

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload

from ._es_common import NON_CLINICAL
from ._pub_common import ACADEMIC_RE, Entry, jobs_from_entries

BASE = "https://www.astursalud.es/categorias/-/categorias/profesionales/06000recursos-humanos/"
LISTS = (
    "03000contratacion-temporal/02000-convocatorias-plazas-temporales",
    "04000procesos-selectivos/02000-procesos-selectivos-jefaturas-coordinaciones-y-supervisiones",
    "04000procesos-selectivos/01000-procesos-selectivos-personal-estatutario",
)
COMPANY = "Servicio de Salud del Principado de Asturias (SESPA)"
MAX_PAGE = 2  # la 1.ª página de cada listado + la 2.ª (las siguientes ya superan el plazo estimado)

_MONTHS = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
    "septiembre": 9, "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}
_DATE_TEXT_RE = re.compile(r"\b(\d{1,2})\s+(?:de\s+)?([A-Za-zÁÉÍÓÚáéíóú]+)\s+(?:de\s+)?(\d{4})")
_DATE_NUM_RE = re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{4})")


def _strip(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c))


def parse_resolution_date(title: str) -> date | None:
    """Fecha de la resolución según el título ("Resolución de 4 de noviembre de 2026", "de 29/9/2026")."""
    head = re.sub(r"\s+", " ", title)
    m = _DATE_TEXT_RE.search(head)
    if m and _strip(m.group(2)) in _MONTHS:
        try:
            return date(int(m.group(3)), _MONTHS[_strip(m.group(2))], int(m.group(1)))
        except ValueError:
            return None
    m = _DATE_NUM_RE.search(head)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            return None
    return None


def parse_list(html: str) -> list[Entry]:
    soup = BeautifulSoup(html, "html.parser")
    entries: list[Entry] = []
    for cell in soup.select("ul.content-list li.list-cell"):
        link = cell.find("a", href=True)
        title_el = cell.select_one(".title")
        if not link or not title_el:
            continue
        title = re.sub(r"\s+", " ", unescape(title_el.get_text(" ", strip=True)))
        title = re.sub(r"^(anuncio)\s*:\s*", "", title, flags=re.I)
        published = parse_resolution_date(title)
        if not published:
            continue
        url = link["href"]
        query = parse_qs(urlparse(url).query)
        slug = next((v[0] for k, v in query.items() if k.endswith("article_uq_title")), None)
        if not slug:
            m = re.search(r"/noticias/-/noticias/([^/?#]+)", url)
            slug = m.group(1) if m else None
        if not slug:
            continue
        ident = f"sespa-{published:%Y%m%d}-" + hashlib.md5(unquote(slug).encode()).hexdigest()[:10]
        entries.append(Entry(ident=ident, title=title, url=url, published=published))
    return entries


def parse_pages(html: str) -> list[str]:
    """URLs de las páginas de paginación del listado (la 2.ª en adelante)."""
    soup = BeautifulSoup(html, "html.parser")
    pages: dict[int, str] = {}
    for a in soup.select(".pagination a[href^=http]"):
        m = re.search(r"_page=(\d+)", a["href"])
        if m:
            pages[int(m.group(1))] = unescape(a["href"])
    return [pages[n] for n in sorted(pages) if 2 <= n <= MAX_PAGE]


_JEFE_SERVICIO_RE = re.compile(r"\bdel Servicio (Facultativo|M[eé]dico|Cl[ií]nico)", re.I)


def parse_jobs(entries: list[Entry], now: datetime | None = None) -> list[JobPayload]:
    prepared = []
    for e in entries:
        if ACADEMIC_RE.search(e.title):  # profesorado de la Facultad de Enfermería: no es empleo asistencial
            continue
        # "Jefe/a del Servicio Facultativo de X" -> "Jefe/a de Servicio Facultativo de X" (el extractor de puesto corta en "del Servicio")
        e.title = _JEFE_SERVICIO_RE.sub(lambda m: "de Servicio " + m.group(1), e.title)
        prepared.append(e)
    temporal = {e.ident for e in prepared if re.search(r"\btemporal\b|interin", e.title, re.I)}
    jobs = jobs_from_entries(prepared, slug="sespa", gazette="Portal SESPA (Astursalud)", region="Asturias",
                             default_company=COMPANY, now=now)
    jobs = [j for j in jobs if j.profession not in NON_CLINICAL]  # solo puestos sanitarios (no administrativos/gestión)
    for job in jobs:
        if job.source_id in temporal and job.title.startswith("Concurso "):
            job.title = "Contratación temporal " + job.title[len("Concurso "):]
            job.contract_type = "Temporal"
        job.company = COMPANY
        job.description = job.description.replace(
            "Consulta las bases y el plazo de solicitud en la convocatoria oficial.",
            "El plazo de presentación de solicitudes figura en la convocatoria oficial (el fin del plazo mostrado es una estimación).",
        )
    return jobs


class SespaScraper(BaseScraper):
    slug = "sespa"
    name = "SESPA Asturias — Convocatorias del Servicio de Salud"
    last_listings_complete = False  # cada ejecución solo ve las páginas más recientes

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        entries: list[Entry] = []
        ok = 0
        try:
            for path in LISTS:
                try:
                    first = client.get_text(BASE + path)
                    ok += 1
                    entries.extend(parse_list(first))
                    for url in parse_pages(first):
                        entries.extend(parse_list(client.get_text(url)))
                except Exception:  # noqa: BLE001 — un listado caído no tumba los demás
                    continue
        finally:
            client.close()
        if not ok:
            raise RuntimeError("SESPA: ningún listado accesible")
        seen: set[str] = set()
        unique = [e for e in entries if not (e.ident in seen or seen.add(e.ident))]
        return parse_jobs(unique)
