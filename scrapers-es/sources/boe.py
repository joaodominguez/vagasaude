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

API = "https://www.boe.es/datosabiertos/api/boe/sumario/{day}"
WINDOW_DAYS = 30
APPLICATION_BUSINESS_DAYS = 20  # plazo habitual de solicitudes de procesos selectivos AGE

# Convocatoria "viva" (la resolución convoca algo) frente a trámites posteriores.
_EXCLUDE_RE = re.compile(
    r"libre designaci|se modific|se corrig|correcci[oó]n de errores|relaci[oó]n (provisional |definitiva )?de (personas|aspirantes)|"
    r"han superado|aprobad|admitid|excluid|desiert|se nombra|se resuelve|se adjudic|tribunal|"
    r"se declara|se anula|se aprueba la lista|cuerpos docentes|plazas vinculadas|comisi[oó]n de servicios",
    re.I,
)
_CONVOCA_RE = re.compile(r"por la que se convoca", re.I)
_POSITION_RES = [
    re.compile(r"en plazas de la categor[ií]a de (.+?)\.?$", re.I),
    re.compile(r"(?:en|a) la categor[ií]a de (.+?)\.?$", re.I),
    re.compile(r"provisi[oó]n de(?: la)? plaza de (.+?)\.?$", re.I),
    re.compile(r"provisi[oó]n de(?: un)? puesto de trabajo de (.+?)\.?$", re.I),
    re.compile(r"plazas? de (.+?)\.?$", re.I),
    re.compile(r"(?:ingreso|acceso)[^.]*? en el (Cuerpo .+?)\.?$", re.I),
]
_HEALTH_EMPLOYER_RE = re.compile(
    r"instituto nacional de gesti[oó]n sanitaria|ingesa|servicio (andaluz|gallego|catal[aá]n|madrile[nñ]o|vasco|canario|"
    r"murciano|arag[oó]n|extreme[nñ]o|cántabro|cantabro|riojano) de salud|servicio de salud|osakidetza|"
    r"organizaci[oó]n sanitaria|red de salud mental|red hospitalaria|instituto catal[aá]n de la salud|hospital",
    re.I,
)
_HEALTH_POSITION_RE = re.compile(
    r"sanitari|sanidad|salud|hospital|enfermer|m[eé]dic|farmac|fisioterap|odontolog|veterinar|cuidados auxiliares|"
    r"celador|facultativ[oa] especialista|matron|logoped|optic[oa]|podolog|psicolog[ií]a cl|laboratorio|"
    r"diagn[oó]stico|radi[oó]log|terapeuta|nutrici|dietista|trabajador[a]? social",
    re.I,
)


_JEFE_SANITARIO_RE = re.compile(r"jef[ae]/?a? de (servicio|secci[oó]n) sanitari", re.I)


def company_from(title: str, department: str) -> str:
    head = re.split(r",?\s+por la que", title, maxsplit=1)[0]
    issuer = head.rsplit(", ", 1)[-1]
    issuer = re.sub(r"^(de la|del|de)\s+", "", issuer, flags=re.I).strip()
    if "osi" in norm(issuer).split() or "organizacion sanitaria integrada" in norm(issuer):
        m = re.search(r"Organizaci[oó]n Sanitaria Integrada\s+(.+)$", issuer, re.I)
        return f"Osakidetza — OSI {m.group(1).strip()}" if m else "Osakidetza"
    if "red de salud mental" in norm(issuer):
        return "Osakidetza — Red de Salud Mental de Bizkaia"
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


def extract_position(title: str) -> str | None:
    for rx in _POSITION_RES:
        match = rx.search(title.strip())
        if match:
            return re.sub(r"\s+", " ", match.group(1)).strip(" .")
    return None


def add_business_days(start: date, days: int) -> date:
    current = start
    while days > 0:
        current += timedelta(days=1)
        if current.weekday() < 5:
            days -= 1
    return current


def region_for(department: str, title: str) -> tuple[str, str | None]:
    dep = norm(department)
    t = norm(title)
    if "instituto nacional de gestion sanitaria" in t or "ingesa" in t:
        return "Ceuta", "Ceuta y Melilla (INGESA)"
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
        if not title or not ident or not _CONVOCA_RE.search(title) or _EXCLUDE_RE.search(title):
            continue
        position = extract_position(title)
        if not position:
            continue
        health_employer = bool(_HEALTH_EMPLOYER_RE.search(f"{department} {title}"))
        health_position = bool(_HEALTH_POSITION_RE.search(position))
        if not (health_employer or health_position):
            continue
        profession = es_profession(position)
        if profession in NON_CLINICAL and _JEFE_SANITARIO_RE.search(position):
            profession = "Medicina"  # Jefe/a de Servicio/Sección Sanitario/a = puesto facultativo
        elif profession == "Otros" and health_employer:
            profession = "Gestión y apoyo"  # lavandero, pinche... en organismos sanitarios
        # Fuera de empleadores sanitarios, solo categorías clínicas.
        if not health_employer and profession in NON_CLINICAL:
            continue
        district, place = region_for(department, title)
        company = company_from(title, department)
        selective = "proceso selectivo" in norm(title) or "pruebas selectivas" in norm(title)
        label = "Oposición" if selective else "Concurso"
        url = ((item.get("url_html") or "").strip()) or f"https://www.boe.es/diario_boe/txt.php?id={ident}"
        published = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        expires = None
        if selective:
            end = add_business_days(day, APPLICATION_BUSINESS_DAYS)
            expires_dt = datetime(end.year, end.month, end.day, 23, 59, tzinfo=timezone.utc)
            if expires_dt < now:
                continue  # plazo de solicitud ya cerrado
            expires = expires_dt.isoformat()
        jobs.append(
            JobPayload(
                title=f"{label}: {position}",
                company=company[:120],
                location_district=district,
                location_concelho=place,
                profession=profession,
                specialty=None,
                sector="publico",
                contract_type="Indefinido" if "estatutario fijo" in norm(title) or "fijo" in norm(title) else guess_contract(title),
                description=f"{title}\n\nFuente: BOE de {day:%d/%m/%Y} ({ident}). Consulta las bases y el plazo de solicitud en la convocatoria oficial.",
                requirements=None,
                salary=None,
                application_url=url,
                source="boe",
                source_id=str(ident),
                published_at=published.isoformat(),
                expires_at=expires,
            )
        )
    return jobs


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
        self.last_listings_complete = complete
        return jobs
