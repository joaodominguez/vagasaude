"""Utilidades comunes de los scrapers del sector PÚBLICO (BOE, boletines autonómicos, Osakidetza).

- Clasificación del tipo de proceso (primera palabra(s) del título corto, para poder filtrar
  oposiciones en la web): "Oposición" | "Concurso de traslados" | "Concurso" | "Bolsa de empleo"
  | "Contratación temporal".
- Título corto legible: "<Tipo> <Puesto> — <Organismo> (<n> plazas)". El título oficial completo va al
  principio de la descripción.
- Filtro de convocatorias vivas, sanitarias, y fecha límite estimada.
- Constructor genérico `jobs_from_entries` para boletines con feed (DOG, BORM, DOE, BOC, BOCYL, BOJA, BOCM...).

Nota sobre el hash de deduplicación de la web (título|empresa|comunidad): dos convocatorias distintas con
el mismo puesto y organismo colisionarían; `dedupe_titles` añade un sufijo (fecha) cuando eso pasa en un lote.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from common.models import JobPayload
from common.normalize import guess_contract, norm

from ._es_common import NON_CLINICAL, es_profession

APPLICATION_BUSINESS_DAYS = 20  # plazo habitual de solicitudes (se usa si el título no dice otro)

KIND_OPOSICION = "Oposición"
KIND_TRASLADOS = "Concurso de traslados"
KIND_CONCURSO = "Concurso"
KIND_BOLSA = "Bolsa de empleo"
KIND_TEMPORAL = "Contratación temporal"
KINDS = (KIND_OPOSICION, KIND_TRASLADOS, KIND_CONCURSO, KIND_BOLSA, KIND_TEMPORAL)

# --- filtros -----------------------------------------------------------------------------------

# Trámites posteriores o que no son una convocatoria viva.
EXCLUDE_RE = re.compile(
    r"libre designaci|se modific|se corrig|correcci[oó]n de errores|correcci[oó]n de erratas|"
    r"relaci[oó]n (provisional |definitiva )?de (personas|aspirantes)|lista (provisional |definitiva )?de (personas|aspirantes|admitid)|"
    r"han superado|aprobad|admitid|excluid|desiert|se nombra|se resuelve|se adjudic|tribunal|"
    r"se declara|se anula|se aprueba la lista|cuerpos docentes|plazas vinculadas|comisi[oó]n de servicios|"
    r"se amplia|se amplía|se prorroga|se suspende|se deja sin efecto|calendario|fecha, hora y lugar|"
    r"hace p[uú]blic[ao]|se publica|toma de posesi[oó]n|resoluci[oó]n definitiva|"
    r"adjudicaci[oó]n de destino|elecci[oó]n de destino|oferta de empleo p[uú]blico|subvenci|convenio|premio|beca",
    re.I,
)
# La resolución convoca algo (singular/plural, "se abre", "se aprueba la convocatoria").
CONVOCA_RE = re.compile(
    r"por la que se (convoca|convocan|abre|abren|aprueba la convocatoria|aprueban las bases|anuncia la convocatoria|"
    r"efect[uú]a convocatoria)|se convoca[n]? |se abre la convocatoria|convocatoria (p[uú]blica )?(de|para)",
    re.I,
)
ACADEMIC_RE = re.compile(r"profesor|docente|catedr[aá]tic|investigador|contratado doctor|ayudante doctor|universitari", re.I)

HEALTH_EMPLOYER_RE = re.compile(
    r"instituto nacional de gesti[oó]n sanitaria|ingesa|servicio (andaluz|gallego|catal[aá]n|madrile[nñ]o|vasco|canario|"
    r"murciano|arag[oó]n[eé]s|extreme[nñ]o|c[aá]ntabro|riojano|navarro|de salud|de la salud)|osakidetza|sergas|sescam|sacyl|"
    r"sespa|ib-salut|servei de salut|gerencia regional de salud|gerencia (de )?(atenci[oó]n|asistencia)|"
    r"organizaci[oó]n sanitaria|red de salud mental|red hospitalaria|instituto catal[aá]n de la salud|"
    r"consejer[ií]a de sanidad|presidencia, sanidad|conselleria de sanitat|departamento de salud|hospital|summa 112|"
    r"agencia valenciana de salud|osasunbidea|[aá]rea (de )?salud|complejo hospitalario",
    re.I,
)
HEALTH_POSITION_RE = re.compile(
    r"sanitari|sanidad|salud|hospital|enfermer|m[eé]dic|farmac|fisioterap|odontolog|veterinar|cuidados auxiliares|"
    r"celador|facultativ[oa]|matron|logoped|optic[oa]|podolog|psicolog[ií]a cl|laboratorio|"
    r"diagn[oó]stico|radi[oó]log|terapeuta|nutrici|dietista|trabajador[a]? social|t[eé]cnic[oa] (superior|medio) (sanitari|en)|"
    r"pediatr|anestesi|urgencias|t\.?c\.?a\.?e|\bats\b|\bdue\b|\bfea\b",
    re.I,
)
JEFE_SANITARIO_RE = re.compile(r"jef[ae]/?a? de (servicio|secci[oó]n|unidad)[^,]*?(sanitari|facultativ|cl[ií]nic)", re.I)

_BOLSA_RE = re.compile(r"bolsa|lista[s]? (de espera|de contrataci[oó]n|de aspirantes|de sustituci)|listas? de empleo|sustituciones?|interinidad|interinos?", re.I)
_TEMPORAL_RE = re.compile(r"contrataci[oó]n temporal|nombramiento[s]? (de )?(personal )?(estatutario )?(temporal|interino|eventual)|oferta[s]? de (empleo|contrataci[oó]n)", re.I)
_TRASLADOS_RE = re.compile(r"concurso de traslados|concurso de movilidad|movilidad interna|traslado", re.I)
_SELECTIVE_RE = re.compile(r"proceso[s]? selectivo|pruebas? selectiv|oposici[oó]n|concurso[- ]oposici[oó]n|acceso a la condici[oó]n de personal estatutario fijo|estabilizaci[oó]n|ingreso en el cuerpo|ingreso en la escala", re.I)


def classify(title: str) -> str:
    """Tipo de proceso (ver KINDS) a partir del título oficial."""
    t = title
    if _TRASLADOS_RE.search(t):
        return KIND_TRASLADOS
    selective = bool(_SELECTIVE_RE.search(t))
    if selective and re.search(r"fij[oa]|escala|cuerpo|plazas", t, re.I) and not _BOLSA_RE.search(t):
        return KIND_OPOSICION
    if _BOLSA_RE.search(t):
        return KIND_BOLSA
    if _TEMPORAL_RE.search(t):
        return KIND_TEMPORAL
    if selective:
        return KIND_OPOSICION
    return KIND_CONCURSO


POSITION_RES = [
    re.compile(r"puestos? de cargo intermedio de (.+?)\.?$", re.I),
    re.compile(r"cobertura (?:provisional )?del? puesto de (?!cargo)(.+?)\.?$", re.I),
    re.compile(r"en plazas de la categor[ií]a de (.+?)\.?$", re.I),
    re.compile(r"(?:en|a) la categor[ií]a de (.+?)\.?$", re.I),
    re.compile(r"categor[ií]a (?:profesional )?de (.+?)\.?$", re.I),
    re.compile(r"provisi[oó]n de(?: la)? plaza de (.+?)\.?$", re.I),
    re.compile(r"provisi[oó]n de(?: un)? puesto de trabajo de (.+?)\.?$", re.I),
    re.compile(r"puestos? de (?:trabajo )?(?:de )?(Jef[ae].+?)\.?$", re.I),
    re.compile(r"puestos? de trabajo de (.+?)\.?$", re.I),
    re.compile(r"plazas? de (.+?)\.?$", re.I),
    re.compile(r"(?:ingreso|acceso)[^.]*? en el (Cuerpo .+?)\.?$", re.I),
    re.compile(r"(?:ingreso|acceso)[^.]*? en la (Escala .+?)\.?$", re.I),
    re.compile(r"(?:bolsa|lista)s? (?:de empleo |de trabajo |de contrataci[oó]n |de espera )?(?:temporal )?(?:de|para|en la categor[ií]a de) (.+?)\.?$", re.I),
]
_POSITION_TAIL_RE = re.compile(
    r"(?:,|;|\.)?\s+(?:convocad[oa]s?|a cubrir|de la plantilla|en este centro|para su (?:cobertura|provisi)|por el sistema|por turno|mediante (?:el )?(?:sistema|concurso|procedimiento)|"
    r"en el (?:[aá]mbito|marco)|dependientes?|del (?:servicio|instituto)|de la (?:consejer|gerencia|direcci)|"
    r"con (?:destino|car[aá]cter)|adscrit|para el (?:turno|ejercicio)|correspondientes?|incluid|en el [aá]rea|de las? instituciones).*$",
    re.I,
)
_PLAZAS_RE = re.compile(r"(\d{1,5})\s+plazas?\b", re.I)
_NUMBER_WORDS = {"dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10,
                 "once": 11, "doce": 12}
_PLAZAS_WORD_RE = re.compile(r"\b(" + "|".join(_NUMBER_WORDS) + r")\s+(?:plazas|puestos)\b", re.I)
_WORKPLACE_RE = re.compile(
    r"\s+(?:en\s+(?:(?:el|la|los|las)\s+)?|del\s+|de\s+(?:la|las|los)\s+)((?:Hospital|Complejo|[AÁ]rea|Distrito|Centro|Agencia|Unidad|Gerencia|OSI|Organizaci[oó]n)\b[^,]*?)\s*$",
    re.I,
)
_TAG_RES = [
    (re.compile(r"promoci[oó]n interna", re.I), "promoción interna"),
    (re.compile(r"discapacidad", re.I), "discapacidad"),
    (re.compile(r"estabilizaci[oó]n", re.I), "estabilización"),
]


def extract_position(title: str) -> str | None:
    text = re.sub(r"\s+", " ", title.strip())
    for rx in POSITION_RES:
        match = rx.search(text)
        if match:
            return clean_position(match.group(1))
    return None


def clean_position(position: str) -> str:
    position = re.sub(r"\s+", " ", position).strip(" .;,")
    position = _POSITION_TAIL_RE.sub("", position).strip(" .;,")
    position = re.sub(r"^(?:la|el|las|los)\s+", "", position, flags=re.I)
    return position


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(" ,;:-")
    if cut.count("(") > cut.count(")"):
        cut = cut[: cut.rfind("(")].rstrip(" ,;:-") or cut
    return cut + "…"


def plazas_from(title: str) -> int | None:
    found = _PLAZAS_RE.search(title)
    if found:
        return int(found.group(1))
    word = _PLAZAS_WORD_RE.search(title)
    return _NUMBER_WORDS[word.group(1).lower()] if word else None


def split_workplace(position: str) -> tuple[str, str | None]:
    """"Jefe/a de Sección en el Hospital Universitario de Jaén" -> ("Jefe/a de Sección", "Hospital Universitario de Jaén")."""
    m = _WORKPLACE_RE.search(position)
    if m and m.start() > 6:
        return position[: m.start()].strip(" ,;"), m.group(1).strip()
    return position, None


def tag_from(title: str) -> str | None:
    """Etiqueta de turno si es inequívoca (promoción interna sola, discapacidad, estabilización)."""
    for rx, label in _TAG_RES:
        if rx.search(title):
            if label == "promoción interna" and re.search(r"\blibre\b|acceso general", title, re.I):
                continue  # libre + promoción interna: no es un turno concreto
            return label
    return None


def short_org(company: str) -> str:
    """Nombre corto del organismo para el título."""
    c = company.strip()
    low = norm(c)
    for key, short in (
        ("osakidetza", "Osakidetza"), ("ingesa", "INGESA"), ("sergas", "Sergas"), ("gallego de salud", "Sergas"),
        ("andaluz de salud", "SAS"), ("madrileno de salud", "SERMAS"), ("murciano de salud", "SMS"),
        ("extremeno de salud", "SES"), ("canario de la salud", "SCS Canarias"), ("canario de salud", "SCS Canarias"),
        ("castilla la mancha", "SESCAM"), ("castilla-la mancha", "SESCAM"), ("conselleria de sanidad", "Sanidad C. Valenciana"), ("gerencia regional de salud", "SACYL"), ("principado de asturias", "SESPA"),
        ("cantabro de salud", "SCS Cantabria"), ("illes balears", "IB-Salut"), ("aragones de salud", "Salud Aragón"),
        ("navarro de salud", "Osasunbidea"), ("riojano de salud", "SERIS"), ("instituto catalan de la salud", "ICS"),
        ("sanitat", "Sanidad C. Valenciana"), ("instituto nacional de gestion sanitaria", "INGESA"),
    ):
        if key in low:
            return short
    acronym = re.search(r"\(([A-ZÁÉÍÓÚ][A-Za-zÁÉÍÓÚ\-]{1,11})\)\s*$", c)
    if acronym:
        return acronym.group(1)
    c = re.sub(r"\s*\([^)]*\)\s*$", "", c)
    return _truncate(c, 40)


def build_title(
    kind: str, position: str, org_short: str, plazas: int | None = None, tag: str | None = None, place: str | None = None
) -> str:
    """"Oposición Enfermero/a — INGESA (12 plazas, promoción interna)"."""
    pos = _truncate(position[:1].upper() + position[1:], 90)
    extras = []
    if place:
        extras.append(_truncate(place, 62))
    if plazas:
        extras.append(f"{plazas} plaza" + ("" if plazas == 1 else "s"))
    if tag:
        extras.append(tag)
    suffix = f" ({', '.join(extras)})" if extras else ""
    return f"{kind} {pos} — {org_short}{suffix}"


def dedupe_titles(jobs: list[JobPayload]) -> list[JobPayload]:
    """Evita que dos convocatorias distintas con igual título/empresa/comunidad se marquen duplicadas en la web."""
    seen: dict[tuple[str, str, str], int] = {}
    for job in jobs:
        key = (norm(job.title), norm(job.company), norm(job.location_district))
        if key in seen:
            stamp = (job.published_at or "")[:10]
            suffix = f"{stamp[8:10]}/{stamp[5:7]}" if len(stamp) == 10 else job.source_id[-6:]
            job.title = f"{job.title} · {suffix}"
            key = (norm(job.title), key[1], key[2])
            if key in seen:
                job.title = f"{job.title} · {job.source_id[-6:]}"
        seen[(norm(job.title), norm(job.company), norm(job.location_district))] = 1
    return jobs


# --- plazos ------------------------------------------------------------------------------------

def add_business_days(start: date, days: int) -> date:
    current = start
    while days > 0:
        current += timedelta(days=1)
        if current.weekday() < 5:
            days -= 1
    return current


_DAYS_RE = re.compile(r"plazo de (\d{1,3}) d[ií]as (h[aá]biles|naturales)", re.I)


def deadline_for(published: date, title: str = "") -> datetime:
    """Fin estimado del plazo de solicitudes: el que diga el título o 20 días hábiles desde la publicación."""
    m = _DAYS_RE.search(title)
    if m:
        n = int(m.group(1))
        end = add_business_days(published, n) if m.group(2).lower().startswith("h") else published + timedelta(days=n)
    else:
        end = add_business_days(published, APPLICATION_BUSINESS_DAYS)
    return datetime(end.year, end.month, end.day, 23, 59, tzinfo=timezone.utc)


# --- INGESA ------------------------------------------------------------------------------------

def ingesa_place(text: str) -> tuple[str, str]:
    """(location_district, location_concelho) para INGESA según mención explícita de Ceuta/Melilla.

    Solo Melilla -> ("Melilla", "Melilla"); solo Ceuta -> ("Ceuta", "Ceuta"); ambas o ninguna ->
    ("Ceuta", "Ceuta y Melilla"). El distrito es parte del hash de deduplicación (título|empresa|distrito).
    """
    t = norm(text)
    ceuta = "ceuta" in t
    melilla = "melilla" in t
    if melilla and not ceuta:
        return "Melilla", "Melilla"
    if ceuta and not melilla:
        return "Ceuta", "Ceuta"
    return "Ceuta", "Ceuta y Melilla"


# --- empleadores sanitarios (nombre oficial por Servicio de Salud) -----------------------------

HEALTH_SERVICES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"servicio gallego de salud|sergas", re.I), "Servicio Gallego de Salud (Sergas)"),
    (re.compile(r"servicio andaluz de salud", re.I), "Servicio Andaluz de Salud (SAS)"),
    (re.compile(r"servicio madrile[nñ]o de salud|sermas|summa 112", re.I), "Servicio Madrileño de Salud (SERMAS)"),
    (re.compile(r"servicio murciano de salud", re.I), "Servicio Murciano de Salud (SMS)"),
    (re.compile(r"servicio extreme[nñ]o de salud", re.I), "Servicio Extremeño de Salud (SES)"),
    (re.compile(r"servicio canario de (la )?salud", re.I), "Servicio Canario de la Salud (SCS)"),
    (re.compile(r"servicio de salud de castilla-la mancha|sescam", re.I), "Servicio de Salud de Castilla-La Mancha (SESCAM)"),
    (re.compile(r"gerencia regional de salud|sacyl", re.I), "Gerencia Regional de Salud de Castilla y León (SACYL)"),
    (re.compile(r"servicio de salud del principado|sespa", re.I), "Servicio de Salud del Principado de Asturias (SESPA)"),
    (re.compile(r"servicio c[aá]ntabro de salud", re.I), "Servicio Cántabro de Salud (SCS)"),
    (re.compile(r"ib-salut|servei de salut de les illes balears|servicio de salud de las illes balears", re.I), "Servicio de Salud de las Illes Balears (IB-Salut)"),
    (re.compile(r"servicio arag[oó]n[eé]s de salud", re.I), "Servicio Aragonés de Salud (Salud Aragón)"),
    (re.compile(r"servicio navarro de salud|osasunbidea", re.I), "Servicio Navarro de Salud (Osasunbidea)"),
    (re.compile(r"servicio riojano de salud|seris", re.I), "Servicio Riojano de Salud (SERIS)"),
    (re.compile(r"instituto catal[aá]n de la salud", re.I), "Institut Català de la Salut (ICS)"),
    (re.compile(r"conselleria de sanitat|agencia valenciana de salud|conselleria de sanidad", re.I), "Conselleria de Sanidad (Comunitat Valenciana)"),
    (re.compile(r"osakidetza|organizaci[oó]n sanitaria integrada|red de salud mental de bizkaia", re.I), "Osakidetza"),
    (re.compile(r"instituto nacional de gesti[oó]n sanitaria|ingesa", re.I), "INGESA — Instituto Nacional de Gestión Sanitaria"),
]


def health_service_name(text: str) -> str | None:
    for rx, name in HEALTH_SERVICES:
        if rx.search(text):
            return name
    return None


def issuer_from_title(title: str) -> str | None:
    head = re.split(r",?\s+por la que", title, maxsplit=1)[0]
    if head == title:
        return None
    issuer = head.rsplit(", ", 1)[-1]
    issuer = re.sub(r"^(de la|del|de)\s+", "", issuer, flags=re.I).strip()
    return issuer or None


# --- entradas de boletines con feed ------------------------------------------------------------

@dataclass
class Entry:
    ident: str
    title: str
    url: str
    published: date
    department: str = ""
    section: str = ""


_JEFATURA_RE = re.compile(r"^jef[ae]/?a? de (servicio|secci[oó]n|unidad|[aá]rea|equipo)\b", re.I)
_JEFATURA_ADMIN_RE = re.compile(
    r"gesti[oó]n|admisi[oó]n|documentaci[oó]n|compras|econ[oó]mic|administrativ|inform[aá]tic|celador|cocina|mantenimiento|"
    r"log[ií]stic|hosteler|personal|contrataci[oó]n|suministro|limpieza|calidad|servicios generales|atenci[oó]n al (usuario|paciente)|"
    r"recursos humanos|sistemas|arquitectura|ingenier|lavander|seguridad",
    re.I,
)


def refine_profession(position: str, profession: str, health_employer: bool) -> str:
    """Las jefaturas clínicas (Jefe/a de Servicio/Sección de <especialidad>) son puestos facultativos."""
    if not health_employer or not _JEFATURA_RE.match(position):
        return profession
    if _JEFATURA_ADMIN_RE.search(position):
        return "Gestión y apoyo"
    if profession in NON_CLINICAL or profession in ("Técnico sanitario", "Otros"):
        return "Medicina"
    return profession


def _nice_case(text: str) -> str:
    text = text.strip()
    if not text.isupper():
        return text
    text = text.title()
    for word in ("De", "Del", "La", "Y", "El", "Los", "Las"):
        text = re.sub(rf" {word}\b", f" {word.lower()}", text)
    return text


def jobs_from_entries(
    entries: list[Entry],
    *,
    slug: str,
    gazette: str,
    region: str,
    now: datetime | None = None,
    default_company: str | None = None,
) -> list[JobPayload]:
    """Convocatorias abiertas y sanitarias de un boletín autonómico -> JobPayload (sector público)."""
    now = now or datetime.now(timezone.utc)
    jobs: list[JobPayload] = []
    for e in entries:
        title = re.sub(r"\s+", " ", e.title).strip()
        if not title or not e.ident:
            continue
        if not CONVOCA_RE.search(title) or EXCLUDE_RE.search(title):
            continue
        context = f"{e.department} {title}"
        health_employer = bool(HEALTH_EMPLOYER_RE.search(context))
        position = extract_position(title)
        if not position:
            continue
        position, workplace = split_workplace(position)
        if not (health_employer or HEALTH_POSITION_RE.search(position)):
            continue
        if not health_employer and ACADEMIC_RE.search(title):
            continue
        profession = es_profession(position)
        profession = refine_profession(position, profession, health_employer)
        if profession == "Otros" and health_employer:
            profession = "Gestión y apoyo"
        if not health_employer and profession in NON_CLINICAL:
            continue
        kind = classify(title)
        expires_dt = deadline_for(e.published, title)
        if expires_dt < now:
            continue
        company = health_service_name(context) or issuer_from_title(title) or default_company or e.department or "Administración autonómica"
        if company == "INGESA — Instituto Nacional de Gestión Sanitaria":
            district, place = ingesa_place(title)
        else:
            district, place = region, None
        published_dt = datetime(e.published.year, e.published.month, e.published.day, tzinfo=timezone.utc)
        if not workplace and re.match(r"(?i)hospital|complejo|gerencia|centro|[aá]rea", e.department or ""):
            workplace = _nice_case(e.department)
        short = build_title(kind, position, short_org(company), plazas_from(title), tag_from(title), workplace)
        fijo = "estatutario fijo" in norm(title) or "personal fijo" in norm(title)
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
                description=f"{title}\n\nFuente: {gazette} de {e.published:%d/%m/%Y} ({e.ident}). Consulta las bases y el plazo de solicitud en la convocatoria oficial.",
                requirements=None,
                salary=None,
                application_url=e.url,
                source=slug,
                source_id=e.ident,
                published_at=published_dt.isoformat(),
                expires_at=expires_dt.isoformat(),
            )
        )
    return dedupe_titles(jobs)
