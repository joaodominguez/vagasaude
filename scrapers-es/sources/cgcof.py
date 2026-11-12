"""Portal de Empleo del Consejo General de Colegios Farmacéuticos (farmaceuticos.com).

Portal público (sin registro) que se nutre solo de ofertas remitidas por los Colegios Oficiales de Farmacéuticos.
La página ``/farmaceuticos/recursos-farmaceuticos/portal-de-empleo/`` carga las ofertas con el propio AJAX del
sitio (``AjaxServerJobOffers.php``, FormData ``action=get_job_offers`` + nonce público embebido en la página),
que devuelve JSON con descripción completa, provincia, fechas de alta y de caducidad. robots.txt: ``Allow: /``.
No se copian email/teléfono/persona de contacto. Muchos anunciantes son personas físicas (titulares de farmacia):
solo se muestra la empresa si parece un negocio (Farmacia X, S.L., laboratorio...). Se deduplican reenvíos
idénticos (mismo anunciante, puesto, ciudad y texto). Añadido 2026-11-12.
"""
from __future__ import annotations

import json
import re
from datetime import date

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_district, html_to_text, norm

from ._private_es import region_with_fallback

PAGE_URL = "https://www.farmaceuticos.com/farmaceuticos/recursos-farmaceuticos/portal-de-empleo/"
API_URL = "https://www.farmaceuticos.com/wp-content/themes/cgcof-website/api_client/services/job_offers/AjaxServerJobOffers.php"
OFFER_URL = PAGE_URL + "empleo/{id}/"
GENERIC_COMPANY = "Oferta vía Consejo General de Colegios Farmacéuticos"
PAGE_SIZE = 100
MAX_PAGES = 20
_NONCE_RE = re.compile(r"nonce_empleo\s*=\s*[\"']([^\"']+)")
_BUSINESS_RE = re.compile(r"\bfarma|\bfarmacia|\bs\.?l\.?u?\b|\bs\.?a\.?\b|laborator|hospital|clinica|grupo|cooperativa|\bcof\b|botica|parafarm|ortoped", re.I)
_SKIP_TYPES = {"estudiante"}
_PROFESSIONS = (
    ("tecnico", "Técnico de farmacia"), ("auxiliar", "Técnico de farmacia"), ("ayudante", "Técnico de farmacia"),
    ("farmaceutic", "Farmacia"), ("adjunt", "Farmacia"), ("titular", "Farmacia"), ("sustitut", "Farmacia"),
)
_CV_BANK_RE = re.compile(r"bolsa de (candidatos|trabajo|empleo)|deja tu (cv|curr)|autocandidatura|candidatura espontanea")


def nonce_from(html: str) -> str | None:
    m = _NONCE_RE.search(html)
    return m.group(1) if m else None


def parse_response(payload: dict) -> tuple[list[dict], int]:
    data = payload.get("data")
    rows = json.loads(data) if isinstance(data, str) else (data or [])
    return rows, int(payload.get("total_count") or 0)


def _profession(row: dict) -> str | None:
    types = [norm(t.get("name") or "") for t in row.get("job_type_ids") or []]
    if types and all(t in _SKIP_TYPES for t in types):
        return None
    hay = norm(" ".join([row.get("name") or ""] + types))
    if "estudiante" in hay or "practicas" in hay:
        return None
    for needle, label in _PROFESSIONS:
        if needle in hay:
            return label
    return "Farmacia"


def build_job(row: dict, source: str = "cgcof", today: date | None = None) -> JobPayload | None:
    today = today or date.today()
    if norm(row.get("country_name") or "espana") not in ("espana", "spain"):
        return None
    end = (row.get("end_date") or "")[:10] or None
    if end and end < today.isoformat():
        return None
    profession = _profession(row)
    if not profession:
        return None
    body = html_to_text(row.get("description"))
    offered = html_to_text(row.get("offered"))
    reqs = html_to_text(row.get("requirements"))
    if len(body) < 25 or _CV_BANK_RE.search(norm(body[:400])):
        return None
    city = (row.get("city_name") or "").strip() or None
    state = (row.get("state_name") or "").strip() or None
    district = guess_district(city, state)
    if district == "España":
        district = region_with_fallback(city, state)
    if district == "España":
        return None
    label = "Técnico/a de farmacia" if profession == "Técnico de farmacia" else "Farmacéutico/a"
    name = norm(row.get("name") or "")
    if profession == "Farmacia" and "adjunt" in name:
        label += " adjunto/a"
    if "noche" in name:
        label += " (noches)"
    title = f"{label} - {city or state}"
    company_raw = re.sub(r"\s+", " ", (row.get("company") or "")).strip()
    company = company_raw.title() if company_raw.isupper() else company_raw
    if not (company and _BUSINESS_RE.search(company) and len(company) < 80):
        company = GENERIC_COMPANY
    reqs_clean = reqs if reqs and len(norm(reqs)) > len("Experiencia mínima:") + 2 else None
    description = "\n\n".join(x for x in (body, offered, reqs_clean) if x)
    return JobPayload(
        title=title,
        company=company,
        location_district=district,
        location_concelho=city,
        profession=profession,
        specialty=None,
        sector="privado",
        contract_type=guess_contract(offered) or guess_contract(body[:600]),
        description=description[:8000],
        requirements=reqs_clean,
        salary=None,
        application_url=OFFER_URL.format(id=row["id"]),
        source=source,
        source_id=str(row["id"]),
        published_at=(row.get("start_date") or "")[:10] or None,
        expires_at=end,
    )


class CgcofScraper(BaseScraper):
    slug = "cgcof"
    name = "Consejo General de Colegios Farmacéuticos — Portal de empleo"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        seen_ids: set[str] = set()
        seen_text: set[tuple] = set()
        try:
            nonce = nonce_from(client.get_text(PAGE_URL))
            if not nonce:
                raise RuntimeError("CGCOF: nonce no encontrado")
            for page in range(1, MAX_PAGES + 1):
                resp = client.post_form_response(API_URL, {
                    "page": page, "limit": PAGE_SIZE, "offset": PAGE_SIZE * (page - 1),
                    "action": "get_job_offers", "nonce_empleo": nonce, "order": "desc",
                })
                resp.raise_for_status()
                rows, total = parse_response(resp.json())
                if not rows:
                    break
                for row in rows:
                    sid = str(row.get("id"))
                    if sid in seen_ids:
                        continue
                    seen_ids.add(sid)
                    job = build_job(row, self.slug)
                    if not job:
                        continue
                    key = (norm(job.company), norm(job.title), norm(job.location_concelho or ""), norm(job.description[:200]))
                    if key in seen_text:
                        continue
                    seen_text.add(key)
                    jobs.append(job)
                if len(seen_ids) >= total:
                    break
        finally:
            client.close()
        return jobs
