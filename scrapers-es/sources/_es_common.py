"""Utilidades compartidas por los scrapers ES (no es una fuente)."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from common.normalize import guess_district, guess_profession, norm

# Código postal (2 primeros dígitos) -> comunidad autónoma. Útil cuando el ATS
# solo da una región abreviada ("Madr") o una localidad que el normalizador no conoce.
POSTAL_PREFIX_TO_REGION = {
    **{p: "Andalucía" for p in ("04", "11", "14", "18", "21", "23", "29", "41")},
    **{p: "Aragón" for p in ("22", "44", "50")},
    "33": "Asturias", "07": "Islas Baleares", "35": "Canarias", "38": "Canarias",
    "39": "Cantabria",
    **{p: "Castilla y León" for p in ("05", "09", "24", "34", "37", "40", "42", "47", "49")},
    **{p: "Castilla-La Mancha" for p in ("02", "13", "16", "19", "45")},
    **{p: "Cataluña" for p in ("08", "17", "25", "43")},
    **{p: "Comunidad Valenciana" for p in ("03", "12", "46")},
    "06": "Extremadura", "10": "Extremadura",
    **{p: "Galicia" for p in ("15", "27", "32", "36")},
    "26": "La Rioja", "28": "Madrid", "30": "Murcia", "31": "Navarra",
    **{p: "País Vasco" for p in ("01", "20", "48")},
    "51": "Ceuta", "52": "Melilla",
}

# Profesiones que no son clínicas / no encajan en un portal de empleo sanitario.
NON_CLINICAL = {"Otros", "Gestión y apoyo", "Administrativo", "Comercial / Farma", "Formación"}

_DENTAL_RE = re.compile(r"higiene bucodental|higienista|auxiliar (de )?clinica dental|asistente dental|protesico dental")


def es_profession(title: str) -> str:
    """guess_profession + ajuste dental (el normalizador devuelve 'Otros' para higienista/auxiliar dental)."""
    t = norm(title)
    prof = guess_profession(title)
    if prof in ("Otros", "Técnico sanitario") and _DENTAL_RE.search(t):
        return "Odontología"
    return prof


_EXTRA_CLINICAL_RE = re.compile(r"radiofisic|podolog|terapeuta ocupacional|logoped")


def is_clinical(title: str) -> bool:
    if es_profession(title) not in NON_CLINICAL:
        return True
    return bool(_EXTRA_CLINICAL_RE.search(norm(title)))


def region_from(city: str | None, region: str | None, postal: str | None = None) -> str:
    """Comunidad autónoma: región/ciudad conocidas primero, código postal como respaldo."""
    district = guess_district(city, region)
    if district != "España":
        return district
    code = re.sub(r"\D", "", postal or "")
    if len(code) >= 4:
        code = code.zfill(5)
        return POSTAL_PREFIX_TO_REGION.get(code[:2], "España")
    return "España"


def iso_date(value: str | None) -> str | None:
    """Normaliza fechas ISO / RFC 822 a ISO UTC. None si no se entiende."""
    if not value:
        return None
    value = value.strip()
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            dt = parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()
