"""Cigna Healthcare España (Workday cignacareers): solo puestos clínicos en España (enfermería/medicina).

La búsqueda "Spain" devuelve ~45 puestos de todo el grupo (corporativo, IT, EE. UU...). Se descartan los
no clínicos por título y se confirma el país con el detalle. Los títulos en inglés ("Nurse Case
Management") no los reconoce `is_clinical`, así que se mapean aquí de forma explícita.
"""
from __future__ import annotations

import re

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text, norm

from ._es_common import iso_date
from ._private_es import region_with_fallback

BASE = "https://cigna.wd5.myworkdayjobs.com"
LIST_URL = f"{BASE}/wday/cxs/cigna/cignacareers/jobs"
DETAIL_URL = f"{BASE}/wday/cxs/cigna/cignacareers{{path}}"
PUBLIC_URL = f"{BASE}/es-ES/cignacareers{{path}}"
LIMIT = 20
MAX_PAGES = 10
COMPANY = "Cigna Healthcare"

_CANDIDATE_RE = re.compile(r"nurse|enfermer|physician|doctor|medic|inspector|clinical|case manag")
_NURSE_RE = re.compile(r"nurse|enfermer")
_DOCTOR_RE = re.compile(r"physician|doctor|\bmedico\b|\bmedica\b")
# Descripción (ya normalizada: "/" -> espacio): "buscamos incorporar un/a enfermero/a", "profesional de Enfermería".
_NURSE_DESC_RE = re.compile(r"incorporar (?:a )?un(?: a)? enfermer|profesional de enfermeria|licenciad[oa] en enfermeria|grado en enfermeria")
_SUFFIX_RE = re.compile(r"\s*[-–—]\s*Cigna Healthcare\s*$", re.I)


def classify(title: str, path: str, description: str = "") -> str | None:
    """Enfermería / Medicina / None. Título y slug de la URL primero; luego el arranque de la descripción."""
    slug = path.rsplit("/", 1)[-1].replace("-", " ")
    t = norm(f"{title} {slug}")
    if _NURSE_RE.search(t):
        return "Enfermería"
    if _DOCTOR_RE.search(t):
        return "Medicina"
    if _NURSE_DESC_RE.search(norm(description[:1500])):
        return "Enfermería"
    return None


def _is_spain(info: dict) -> bool:
    country = info.get("country") or {}
    return (country.get("descriptor") or "").lower() in ("spain", "españa")


class CignaScraper(BaseScraper):
    slug = "cigna"
    name = "Cigna Healthcare — Empleo clínico"
    last_listings_complete = True

    def _listing(self, client: HttpClient) -> list[dict]:
        postings: list[dict] = []
        for page in range(MAX_PAGES):
            data = client.post_json(
                LIST_URL,
                {"appliedFacets": {}, "limit": LIMIT, "offset": page * LIMIT, "searchText": "Spain"},
            )
            batch = data.get("jobPostings") or []
            postings.extend(batch)
            if len(batch) < LIMIT:
                return postings
        self.last_listings_complete = False
        return postings

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        try:
            for posting in self._listing(client):
                path = posting.get("externalPath") or ""
                title = _SUFFIX_RE.sub("", (posting.get("title") or "").strip())
                if not path or path in seen or not _CANDIDATE_RE.search(norm(f"{title} {path.rsplit('/', 1)[-1].replace('-', ' ')}")):
                    continue
                seen.add(path)
                try:
                    info = client.get_json(DETAIL_URL.format(path=path)).get("jobPostingInfo") or {}
                except Exception:  # noqa: BLE001
                    self.last_listings_complete = False
                    continue
                if not _is_spain(info):
                    continue
                description = html_to_text(info.get("jobDescription"))
                profession = classify(title, path, description)
                if not profession:
                    continue
                location = [p.strip() for p in (info.get("location") or "").split(",") if p.strip()]
                # "ESP Madrid - 38.75 hrs" / "Madrid, Spain" -> "Madrid"
                city = re.sub(r"^ESP\s+", "", location[0]).split(" - ")[0].strip() if location else None
                if city and (norm(city) in ("spain", "espana") or re.search(r"\d", city)):
                    city = None
                req_id = str(info.get("jobReqId") or path.rsplit("_", 1)[-1])
                time_type = (info.get("timeType") or "").lower()
                jobs.append(JobPayload(
                    title=title,
                    company=COMPANY,
                    location_district=region_with_fallback(city, None, title=title) if city else "España",
                    location_concelho=city,
                    profession=profession,
                    specialty=None,
                    sector="privado",
                    contract_type=guess_contract(title) or guess_contract(description[:1500])
                    or ("Jornada completa" if time_type == "full time" else None),
                    description=description or title,
                    requirements=None,
                    salary=None,
                    application_url=PUBLIC_URL.format(path=path),
                    source=self.slug,
                    source_id=req_id,
                    published_at=iso_date(info.get("startDate")),
                ))
        finally:
            client.close()
        return jobs
