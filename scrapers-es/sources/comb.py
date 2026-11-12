"""Col·legi de Metges de Barcelona (COMB) — Borsa de treball, ofertes de treball.

El listado ``/ca/serveis/borsa-treball/ofertes`` incrusta en el HTML (DataTable) el JSON de ofertas
activas (número, especialidad y UID) y cada ficha ``/ofertes/<uid>`` es pública (solo la inscripción
requiere login). robots.txt solo veta ``/perfil/``. La ficha no indica empleador ni fecha: la empresa
se publica como "Oferta vía Col·legi de Metges de Barcelona". Todas son ofertas médicas.
Añadido 2026-11-12.
"""
from __future__ import annotations

import json
import re

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text, norm

from ._detail_cache import DetailCache
from ._private_es import region_with_fallback

BASE = "https://www.comb.cat"
LIST_URL = BASE + "/ca/serveis/borsa-treball/ofertes"
DETAIL_URL = LIST_URL + "/{uid}"
COMPANY = "Oferta vía Col·legi de Metges de Barcelona"
MAX_NEW_DETAILS = 400
_DATA_RE = re.compile(r'"data":\s*(\[\{"Oferta".*?\}\]),\s*\n', re.S)


def parse_listing(html: str) -> list[dict]:
    m = _DATA_RE.search(html)
    if not m:
        return []
    out = []
    for row in json.loads(m.group(1)):
        uid, num = row.get("OfertaUID"), row.get("Oferta")
        if uid and num:
            out.append({"id": str(num), "uid": uid, "specialty": (row.get("DOferta") or "").strip()})
    return out


def parse_detail(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    fields: dict[str, str] = {}
    for li in soup.select("ul.list-style-9 li"):
        label = li.select_one("span")
        if not label:
            continue
        name = label.get_text(" ", strip=True)
        label.extract()
        value = html_to_text(li.decode_contents()) if li.get("style", "").replace(" ", "") != "display:none" else ""
        if value:
            fields[norm(name)] = value
    h1 = soup.find("h1")
    return {"h1": h1.get_text(" ", strip=True) if h1 else "", "fields": fields}


def _contract(*texts: str | None) -> str | None:
    t = norm(" ".join(x for x in texts if x))
    if re.search(r"temporal|substituci|interin|eventual|durada determinada|\d+ (any|anys|mes|mesos)", t):
        return "Temporal"
    if re.search(r"indefinit|estable", t):
        return "Indefinido"
    return guess_contract(t)


def _specialty_label(raw: str) -> str:
    return re.sub(r"\s*\(.*?\)\s*", " ", raw).strip().capitalize()


def build_job(row: dict, detail: dict, source: str = "comb") -> JobPayload | None:
    f = detail.get("fields") or {}
    title = f.get("nom del lloc de treball") or detail.get("h1")
    functions = f.get("funcions del lloc de treball")
    if not title or not functions:
        return None
    place = f.get("ubicacio geografica")
    parts = [functions]
    for key, label in (("jornada", "Jornada"), ("durada", "Durada"), ("regim de contractacio", "Règim de contractació"),
                       ("idiomes", "Idiomes"), ("altres dades", "Altres dades"), ("activitat", "Activitat")):
        if f.get(key):
            parts.append(f"{label}: {f[key]}")
    if place:
        parts.append(f"Ubicació: {place}")
    description = "\n\n".join(parts)
    district = region_with_fallback(place, None, title=row.get("specialty"))
    if district == "España":
        district = region_with_fallback(None, None, title=row.get("specialty") or "")
    if district == "España":
        district = "Cataluña"  # el COMB es colegio catalán: sin otra indicación, la oferta es de Cataluña
    specialty = _specialty_label(f.get("especialitat") or row.get("specialty") or "")
    return JobPayload(
        title=title if place is None or norm(place) in norm(title) else f"{title} - {place}",
        company=COMPANY,
        location_district=district,
        location_concelho=place,
        profession="Medicina",
        specialty=specialty or None,
        sector="privado",
        contract_type=_contract(f.get("durada"), f.get("jornada"), f.get("regim de contractacio")),
        description=description[:8000],
        requirements=None,
        salary=None,
        application_url=DETAIL_URL.format(uid=row["uid"]),
        source=source,
        source_id=row["id"],
        published_at=None,
    )


class CombScraper(BaseScraper):
    slug = "comb"
    name = "Col·legi de Metges de Barcelona — Borsa de treball"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        cache = DetailCache(self.slug)
        jobs: list[JobPayload] = []
        new_details = 0
        try:
            rows = parse_listing(client.get_text(LIST_URL))
            if not rows:
                raise RuntimeError("COMB: listado sin ofertas")
            for row in rows:
                detail = cache.get(row["id"])
                if not detail:
                    if new_details >= MAX_NEW_DETAILS:
                        self.last_listings_complete = False
                        continue
                    new_details += 1
                    try:
                        detail = parse_detail(client.get_text(DETAIL_URL.format(uid=row["uid"])))
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
