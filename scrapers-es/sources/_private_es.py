"""Filtros y ajustes comunes para los scrapers del sector privado/concertado (no es una fuente).

- `is_health_role`: is_clinical + exclusión de puestos no sanitarios que el normalizador
  confunde (limpiador de laboratorios, comercial veterinaria, conductor...).
- `region_with_fallback`: región por ciudad/CP y, si no se conoce, por el diccionario de municipios del INE (_municipios_es.json).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from common.normalize import norm

from ._es_common import is_clinical, region_from

_NON_HEALTH_RE = re.compile(
    r"\b(limpiador|limpieza|cocin|pinche|mantenimiento|carretill|conductor|chofer|vigilante|"
    r"seguridad|comercial|asesor|recepcion|administrativ|contable|marketing|jardiner|lavander|"
    r"almacen|reponedor|electricista|fontaner|abogado|informatic|programador|ingenier)"
)

# Municipio (normalizado con common.normalize.norm) -> comunidad autónoma, solo nombres
# inequívocos. Generado a partir del diccionario de municipios del INE (1-ene-2026,
# https://www.ine.es/daco/daco42/codmun/diccionario26.xlsx). Cubre los municipios que
# common/normalize.py aún no resuelve.
_MUNICIPIOS_PATH = Path(__file__).with_name("_municipios_es.json")


class _CityRegion:
    def __init__(self) -> None:
        self._data: dict[str, str] | None = None

    def get(self, name: str, default: str = "España") -> str:
        if self._data is None:
            try:
                self._data = json.loads(_MUNICIPIOS_PATH.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                self._data = {}
        key = norm(name)
        if key in self._data:
            return self._data[key]
        for part in re.split(r"\s*[/(]\s*|\)", name):  # "Sant Vicent del Raspeig/San Vicente ..."
            if part and norm(part) in self._data:
                return self._data[norm(part)]
        return default


EXTRA_CITY_REGION = _CityRegion()


def is_health_role(title: str) -> bool:
    return is_clinical(title) and not _NON_HEALTH_RE.search(norm(title))


def region_with_fallback(city: str | None, region: str | None, postal: str | None = None, title: str | None = None) -> str:
    district = region_from(city, region, postal)
    if district == "España" and city:
        district = EXTRA_CITY_REGION.get(city)
    if district == "España" and title:
        district = region_from(title, None)
    return district


def fetch_teamtailor_private(base_url: str, slug: str, company: str, sector: str = "privado",
                             default_region: str | None = None):
    """fetch_teamtailor_es + filtro de puestos no sanitarios + sector + región por defecto
    (para entidades de una sola comunidad cuyas ofertas no traen dirección)."""
    from ._teamtailor_es import fetch_teamtailor_es

    jobs, complete = fetch_teamtailor_es(base_url, slug, company)
    out = []
    for job in jobs:
        if not is_health_role(job.title):
            continue
        job.sector = sector
        if job.location_district == "España":
            job.location_district = EXTRA_CITY_REGION.get(job.location_concelho or "", default_region or "España")
        out.append(job)
    return out, complete
