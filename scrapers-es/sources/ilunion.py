"""Ilunion (SAP SuccessFactors, empleo.ilunion.com): solo roles sanitarios / sociosanitarios.

Plantilla "tiles" (10 ofertas por página, ~450 en total, mezcla seguridad, hostelería y servicios):
se filtra con `is_health_role` (+ teleoperadores, que mencionan "médica" por la aseguradora).
robots.txt solo bloquea /applybutton/, /talentcommunity/, /services/ y similares.
La población del listado es la provincia (p. ej. "Madrid"), no el municipio.
"""
from __future__ import annotations

import re

from common.models import BaseScraper, JobPayload

from ._sf_es import fetch_sf_es

_EXCLUDE_RE = re.compile(r"teleoperador|telefonista|call center|vigilante")
_PREFIX_RE = re.compile(r"^\s*ilunion[\s_]*vida[\s_]*s[eé]nior[\s_\-–:]*", re.I)
_NOISE_RE = re.compile(r"\s*\(?\s*con\s*/\s*sin\s+(?:discapacidad|incapacidad)\s*\)?|\s*con\s+discapacidad\s*/\s*incapacidad", re.I)
_HMD_RE = re.compile(r"\s*\(\s*h\s*/\s*m\s*/\s*d\s*\)", re.I)


_SHOUT_RE = re.compile(r"[A-ZÁÉÍÓÚÑ]{4,}")
_GENDER_RE = re.compile(r"/([A-ZÁÉÍÓÚÑ])\b")


def clean_title(title: str) -> str:
    text = title.replace("_", " ")
    text = _PREFIX_RE.sub("", text)
    text = _HMD_RE.sub("", _NOISE_RE.sub("", text))
    text = re.sub(r"(\w)\(", r"\1 (", text)  # "Enfermero/a(La Solana" -> "Enfermero/a (La Solana"
    text = re.sub(r",(?=\S)", ", ", text)
    # Títulos en MAYÚSCULAS ("ENFERMERIA RESIDENCIA PARLA") -> "Enfermeria Residencia Parla".
    text = _GENDER_RE.sub(lambda m: "/" + m.group(1).lower(), _SHOUT_RE.sub(lambda m: m.group(0).capitalize(), text))
    text = re.sub(r"\b(DE|DEL|LA|LAS|EL|LOS|Y|EN)\b", lambda m: m.group(0).lower(), text)
    text = re.sub(r"\s{2,}", " ", text).strip(" -–·|")
    return text[:1].upper() + text[1:] if text else title


class IlunionScraper(BaseScraper):
    slug = "ilunion"
    name = "Ilunion — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        jobs, complete = fetch_sf_es(
            "https://empleo.ilunion.com", self.slug, "Ilunion",
            clean_title=clean_title, exclude_re=_EXCLUDE_RE, max_pages=60, max_details=80,
        )
        self.last_listings_complete = complete
        return jobs
