"""BOE — Sumario diario (API de datos abiertos): convocatorias sanitarias de la sección II.B.

GET https://www.boe.es/datosabiertos/api/boe/sumario/{aaaammdd} (JSON). robots.txt de
boe.es no restringe /datosabiertos. Reutilización: aviso legal del BOE (citar fuente).

Se miran los últimos WINDOW_DAYS días (sin edición los domingos -> 404). Solo se
conservan convocatorias (no listas de admitidos, nombramientos, correcciones ni libre
designación) de personal sanitario o de organismos sanitarios.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone

import httpx

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_district, norm

from ._es_common import NON_CLINICAL, es_profession
from ._pub_common import (
    ACADEMIC_RE,
    CONVOCA_RE,
    EXCLUDE_RE,
    HEALTH_EMPLOYER_RE,
    HEALTH_POSITION_RE,
    KIND_BOLSA,
    KIND_TEMPORAL,
    add_business_days,
    build_title,
    classify,
    dedupe_titles,
    deadline_for,
    extract_position,
    ingesa_place,
    plazas_from,
    refine_profession,
    short_org,
    split_workplace,
    tag_from,
)

API = "https://www.boe.es/datosabiertos/api/boe/sumario/{day}"
WINDOW_DAYS = 30


def company_from(title: str, department: str) -> str:
    head = re.split(r",?\s+por la que", title, maxsplit=1)[0]
    issuer = head.rsplit(", ", 1)[-1]
    issuer = re.sub(r"^(de la|del|de)\s+", "", issuer, flags=re.I).strip()
    if "osi" in norm(issuer).split() or "organizacion sanitaria integrada" in norm(issuer):
        m = re.search(r"Organizaci[oó]n Sanitaria Integrada\s+(.+)$", issuer, re.I)
        return f"Osakidetza — OSI {m.group(1).strip()}" if m else "Osakidetza"
    if "red de salud mental" in norm(issuer):
        return "Osakidetza — Red de Salud Mental de Bizkaia"
    if re.match(r"(subsecretar|secretar[ií]a (general|de estado)|direcci[oó]n general|presidencia|vicepresidencia|gabinete)", norm(issuer)) and department:
        dep = department.strip().capitalize()
        return f"{dep} ({issuer})"[:120]
    return issuer


def _aslist(value) -> list:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def iter_items(data: dict):
    """Rinde (seccion, departamento, item) de la sección 2B."""
    try:
        diarios = _aslist(data["data"]["sumario"]["diario"])
    except (KeyError, TypeError):
        return
    for diario in diarios:
        for seccion in _aslist(diario.get("seccion")):
            if seccion.get("codigo") != "2B":
                continue
            for dep in _aslist(seccion.get("departamento")):
                for epigrafe in _aslist(dep.get("epigrafe")):
                    for item in _aslist(epigrafe.get("item")):
                        if isinstance(item, dict):
                            yield seccion, dep.get("nombre") or "", item


def region_for(department: str, title: str) -> tuple[str, str | None]:
    dep = norm(department)
    t = norm(title)
    if "instituto nacional de gestion sanitaria" in t or "ingesa" in t:
        return ingesa_place(title)
    m = re.match(r"comunidad autonoma (?:de(?:l| la)? |foral de )?(.+)", dep)
    if m:
        region = guess_district(m.group(1), m.group(1))
        if region != "España":
            return region, None
    if "cortes generales" in dep or "senado" in t:
        return "Madrid", None
    return "España", None


def parse_sumario(data: dict, day: date, now: datetime | None = None) -> list[JobPayload]:
    now = now or datetime.now(timezone.utc)
    jobs: list[JobPayload] = []
    for _seccion, department, item in iter_items(data):
        title = (item.get("titulo") or "").strip()
        ident = item.get("identificador")
        if not title or not ident or not CONVOCA_RE.search(title) or EXCLUDE_RE.search(title):
            continue
        position = extract_position(title)
        if not position:
            continue
        position, workplace = split_workplace(position)
        health_employer = bool(HEALTH_EMPLOYER_RE.search(f"{department} {title}"))
        health_position = bool(HEALTH_POSITION_RE.search(position))
        if not (health_employer or health_position):
            continue
        if not health_employer and ACADEMIC_RE.search(title):
            continue
        profession = es_profession(position)
        profession = refine_profession(position, profession, health_employer)  # Jefe/a de Servicio/Sección = facultativo
        if profession == "Otros" and health_employer:
            profession = "Gestión y apoyo"  # lavandero, pinche... en organismos sanitarios
        # Fuera de empleadores sanitarios, solo categorías clínicas.
        if not health_employer and profession in NON_CLINICAL:
            continue
        district, place = region_for(department, title)
        company = company_from(title, department)
        kind = classify(title)
        url = ((item.get("url_html") or "").strip()) or f"https://www.boe.es/diario_boe/txt.php?id={ident}"
        published = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        expires_dt = deadline_for(day, title)
        if expires_dt < now:
            continue  # plazo de solicitud ya cerrado (estimado)
        short = build_title(kind, position, short_org(company), plazas_from(title), tag_from(title), workplace)
        fijo = "estatutario fijo" in norm(title) or "fijo" in norm(title)
        jobs.append(
            JobPayload(
                title=short,
                company=company[:120],
                location_district=district,
                location_concelho=place,
                profession=profession,
                specialty=None,
                sector="publico",
                contract_type="Indefinido" if fijo else ("Temporal" if kind in (KIND_BOLSA, KIND_TEMPORAL) else guess_contract(title)),
                description=f"{title}\n\nFuente: BOE de {day:%d/%m/%Y} ({ident}). Consulta las bases y el plazo de solicitud en la convocatoria oficial.",
                requirements=None,
                salary=None,
                application_url=url,
                source="boe",
                source_id=str(ident),
                published_at=published.isoformat(),
                expires_at=expires_dt.isoformat(),
            )
        )
    return dedupe_titles(jobs)


class BoeScraper(BaseScraper):
    slug = "boe"
    name = "BOE — Oposiciones y concursos sanitarios"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        complete = True
        today = datetime.now(timezone.utc).date()
        try:
            for offset in range(WINDOW_DAYS):
                day = today - timedelta(days=offset)
                try:
                    data = client.get_json(
                        API.format(day=day.strftime("%Y%m%d")),
                        headers={"Accept": "application/json"},
                    )
                except httpx.HTTPStatusError as exc:
                    # Sin edición los domingos (404); en otro día = lote incompleto.
                    if exc.response.status_code == 404 and day.weekday() == 6:
                        continue
                    complete = False
                    continue
                except Exception:  # noqa: BLE001
                    complete = False
                    continue
                for job in parse_sumario(data, day):
                    if job.source_id not in seen:
                        seen.add(job.source_id)
                        jobs.append(job)
        finally:
            client.close()
        jobs = dedupe_titles(jobs)
        self.last_listings_complete = complete
        return jobs
