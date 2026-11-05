"""Sistema Nacional de Empleo (SNE): ofertas en difusión de los servicios públicos de
empleo de todas las comunidades autónomas, sector profesional "Sanidad".

Equivalente español del IEFP portugués: empresas privadas (residencias, clínicas,
farmacias, centros de día...) publican la oferta en su servicio regional (SOC Feina
Activa, SAE, Lanbide...) y el SNE la difunde a nivel nacional.

Flujo (HTML, latin-1):
  1. GET  busquedaOfertas.do?modo=inicio&CA=NN  → campo oculto idFlujo (sesión).
  2. POST busquedaOfertas.do?modo=continuar     → primera página (40 ofertas), sector SA.
  3. GET  listadoOfertas.do?modo=pagina&idFlujo=..&CA=NN&indice=41, 81...
  4. Detalle estable sin sesión: detalleOferta.do?modo=inicio&CA=NN&id=<número>.
     Los detalles se guardan en caché (no cambian) para no repetir peticiones.

El SNE no muestra el nombre de la empresa: se usa "Empresa anunciante (vía SNE)".
La inscripción se hace en el portal del servicio regional (indicado en la descripción).
robots.txt solo declara el sitemap (sin Disallow).
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from html import unescape

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract

from ._detail_cache import DetailCache
from ._es_common import es_profession, is_clinical
from ._private_es import region_with_fallback

BASE = "https://www.sistemanacionalempleo.es/OfertaDifusionWEB/"
SECTOR_SANIDAD = "SA"
REGION_CODES = [f"{n:02d}" for n in range(1, 20)]
MAX_PAGES_PER_REGION = 15
# Tope de detalles nuevos por ejecución (1 petición/seg.): el resto entra en la siguiente.
MAX_NEW_DETAILS = 400
COMPANY = "Empresa anunciante (vía Sistema Nacional de Empleo)"

_ROW_RE = re.compile(r"<tr[^>]*>((?:(?!</tr>).)*?detalleOferta\.do\?(?:(?!</tr>).)*?)</tr>", re.S | re.I)
_ID_RE = re.compile(r"detalleOferta\.do\?[^\"']*?\bid=(\d+)")
_FLUJO_RE = re.compile(r"name=.idFlujo.\s+value=.([^\"']+)")
_INDICE_RE = re.compile(r"listadoOfertas\.do\?modo=pagina[^\"']*?indice=(\d+)")


def _text(html: str) -> str:
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<br\s*/?>|</p>|</li>|</tr>|</td>|</h\d>|</div>", "\n", html, flags=re.I)
    text = unescape(re.sub(r"<[^>]+>", " ", html))
    lines = [re.sub(r"[ \t\xa0]+", " ", line).strip() for line in text.split("\n")]
    # Restos de comentarios HTML ("-->") y cabeceras de tabla sin contenido.
    return "\n".join(line for line in lines if line and line not in ("-->", "<!--", "Requeridos/Deseables"))


def _cells(row_html: str) -> list[str]:
    cells = re.findall(r"<td[^>]*>(.*?)</td>", row_html, re.S | re.I)
    return [re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", c))).strip() for c in cells]


def _date(value: str | None) -> str | None:
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})", value or "")
    if not m:
        return None
    d, mth, y = (int(x) for x in m.groups())
    try:
        return datetime(y, mth, d, tzinfo=timezone.utc).isoformat()
    except ValueError:
        return None


def _field(text: str, label: str) -> str | None:
    m = re.search(rf"{label}\s*:\s*([^\n]+)", text, re.I)
    return m.group(1).strip() if m else None


def _section(text: str, start: str, ends: tuple[str, ...]) -> str:
    i = text.find(start)
    if i < 0:
        return ""
    body = text[i + len(start):]
    cut = min((body.find(e) for e in ends if body.find(e) >= 0), default=len(body))
    return body[:cut].strip()


def _sentence_case(text: str) -> str:
    # Muchas ofertas vienen en MAYÚSCULAS: pasarlas a texto normal.
    if sum(c.isupper() for c in text) > 0.6 * max(1, sum(c.isalpha() for c in text)):
        lowered = text.lower()
        return re.sub(r"(^|[.!?]\s+|\n)([a-zà-ÿ])", lambda m: m.group(1) + m.group(2).upper(), lowered)
    return text


def parse_detail(html: str) -> dict:
    text = _text(html)
    start = _field(text, "Fecha de inicio")
    end = _field(text, "Fecha de fin")
    province = _field(text, "Provincia")
    locality = _field(text, r"Localidad de Ubicaci[oó]n del Puesto")
    salary = _field(text, r"Salario Bruto Mensual Desde \(Euros\)")
    stop = ("Este apartado no tiene", "Información General")
    occupation = _section(text, "Descripción\n", ("Datos\n", "Datos adicionales") + stop).split("\n")[0]
    extra = _section(text, "Datos adicionales", ("Datos de contacto", "Requerimientos") + stop)
    contact = _section(text, "Datos de contacto", ("Requerimientos",) + stop)
    reqs = _section(text, "Requerimientos", stop)
    city = None
    if locality:
        city = re.sub(r"\(.*?\)", "", locality).strip()
        # "BISBAL D'EMPORDA, LA" → "La Bisbal D'emporda"
        m = re.match(r"^(.*),\s*(el|la|los|las|l'|els|les|o|a|os|as)$", city, re.I)
        if m:
            city = f"{m.group(2)} {m.group(1)}"
        city = city.title()
    parts = []
    if occupation:
        parts.append(f"Ocupación: {_sentence_case(occupation)}")
    if extra:
        parts.append(_sentence_case(extra))
    if reqs:
        parts.append("Requisitos:\n" + reqs.replace("Requeridos/Deseables\n", ""))
    if contact:
        parts.append("Cómo inscribirse:\n" + contact)
    salary_value = (salary or "").strip()
    return {
        "published_at": _date(start),
        "expires_at": _date(end),
        "province": province.title() if province else None,
        "city": city,
        "salary": f"Desde {salary_value} € brutos/mes" if salary_value and salary_value.strip("0") else None,
        "description": "\n\n".join(parts)[:8000],
    }


class SneScraper(BaseScraper):
    slug = "sne"
    name = "Sistema Nacional de Empleo — Ofertas"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(timeout=45.0, min_interval=1.0)
        cache = DetailCache(self.slug)
        complete = True
        listed: dict[str, dict] = {}
        try:
            for ca in REGION_CODES:
                try:
                    listed.update(self._list_region(client, ca))
                except Exception as exc:  # noqa: BLE001 — una región caída no tumba las demás
                    complete = False
                    print(f"[sne] región {ca}: {exc}")
            jobs: list[JobPayload] = []
            new_details = 0
            for oid, row in listed.items():
                if not is_clinical(row["title"]):
                    continue
                detail = cache.get(oid)
                if detail is None:
                    if new_details >= MAX_NEW_DETAILS:
                        continue
                    new_details += 1
                    try:
                        client._throttle()
                        detail = parse_detail(client.client.get(row["url"]).content.decode("latin-1"))
                    except Exception:  # noqa: BLE001
                        continue
                    cache.set(oid, detail)
                jobs.append(self._build(oid, row, detail))
            cache.save(prune=complete)
        finally:
            client.close()
        self.last_listings_complete = complete
        if not listed:
            raise RuntimeError("SNE: ninguna región devolvió ofertas")
        return jobs

    def _list_region(self, client: HttpClient, ca: str) -> dict[str, dict]:
        client._throttle()
        html = client.client.get(BASE + "busquedaOfertas.do", params={"modo": "inicio", "CA": ca}).content.decode("latin-1")
        m = _FLUJO_RE.search(html)
        if not m:
            raise RuntimeError("formulario sin idFlujo")
        flujo = m.group(1)
        page = client.post_form_response(
            BASE + "busquedaOfertas.do?modo=continuar",
            {
                "idFlujo": flujo,
                "CA": ca,
                "palabraBusqueda": "",
                "sectorProfesional": SECTOR_SANIDAD,
                "botonNavegacion": "Enviar",
            },
        ).content.decode("latin-1")
        rows = self._parse_rows(page, ca)
        indices = sorted({int(x) for x in _INDICE_RE.findall(page)} - {1})
        seen_pages = {1}
        while indices and len(seen_pages) < MAX_PAGES_PER_REGION:
            indice = indices.pop(0)
            if indice in seen_pages:
                continue
            seen_pages.add(indice)
            client._throttle()
            more = client.client.get(
                BASE + "listadoOfertas.do",
                params={"modo": "pagina", "idFlujo": flujo, "CA": ca, "indice": indice},
            ).content.decode("latin-1")
            rows.update(self._parse_rows(more, ca))
            # La paginación muestra un bloque de páginas: añadir las nuevas que aparezcan.
            for x in _INDICE_RE.findall(more):
                if int(x) not in seen_pages and int(x) not in indices:
                    indices.append(int(x))
            indices.sort()
        return rows

    @staticmethod
    def _parse_rows(html: str, ca: str) -> dict[str, dict]:
        rows: dict[str, dict] = {}
        for m in _ROW_RE.finditer(html):
            row_html = m.group(1)
            idm = _ID_RE.search(row_html)
            if not idm:
                continue
            cells = [c for c in _cells(row_html) if c]
            # Celdas: fecha | título | localidad | (provincia)
            date = next((c for c in cells if re.fullmatch(r"\d{2}/\d{2}/\d{4}", c)), None)
            texts = [c for c in cells if c != date]
            if not texts:
                continue
            oid = idm.group(1)
            rows[oid] = {
                "title": texts[0],
                "city": texts[1] if len(texts) > 1 else None,
                "province": texts[2].strip("() ") if len(texts) > 2 else None,
                "date": date,
                "url": f"{BASE}detalleOferta.do?modo=inicio&CA={ca}&id={oid}",
            }
        return rows

    def _build(self, oid: str, row: dict, detail: dict) -> JobPayload:
        title = row["title"].strip()
        if title.isupper():
            title = title[:1] + title[1:].lower()
        city = detail.get("city") or (row.get("city") or "").title() or None
        province = detail.get("province") or row.get("province")
        description = detail.get("description") or title
        # Títulos del SNE son ocupaciones genéricas ("Enfermeros de cuidados generales") y la
        # empresa no se publica: la localidad distingue ofertas (deduplicación) y da títulos únicos.
        if city and city.lower() not in title.lower():
            title = f"{title} — {city}"
        return JobPayload(
            title=title[:200],
            company=COMPANY,
            location_district=region_with_fallback(city, province),
            location_concelho=city,
            profession=es_profession(title),
            specialty=None,
            sector="privado",
            contract_type=guess_contract(description[:1500]),
            description=description,
            requirements=None,
            salary=detail.get("salary"),
            application_url=row["url"],
            source=self.slug,
            source_id=oid,
            published_at=detail.get("published_at") or _date(row.get("date")),
            expires_at=detail.get("expires_at"),
        )
