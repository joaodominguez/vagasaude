"""Normalización para fuentes españolas (es-ES).

Los resultados deben coincidir con las taxonomías de la app:
  - comunidad autónoma  -> apps/web-es/src/lib/spain-map.ts   (campo `location_district`)
  - profesión           -> apps/web-es/src/lib/taxonomies.ts  (`professions`)
La clasificación por título está duplicada en
apps/web-es/src/lib/job-store.ts (guessProfession): mantener ambas sincronizadas.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
from html import unescape as html_unescape

# Comunidades autónomas válidas (labels exactos de spain-map.ts).
REGIONS = [
    "Andalucía", "Aragón", "Asturias", "Islas Baleares", "Canarias", "Cantabria",
    "Castilla y León", "Castilla-La Mancha", "Cataluña", "Comunidad Valenciana",
    "Extremadura", "Galicia", "La Rioja", "Madrid", "Murcia", "Navarra",
    "País Vasco", "Ceuta", "Melilla",
]

# Provincia -> comunidad autónoma (claves sin tildes, en minúsculas).
PROVINCE_TO_REGION = {
    "almeria": "Andalucía", "cadiz": "Andalucía", "cordoba": "Andalucía",
    "granada": "Andalucía", "huelva": "Andalucía", "jaen": "Andalucía",
    "malaga": "Andalucía", "sevilla": "Andalucía",
    "huesca": "Aragón", "teruel": "Aragón", "zaragoza": "Aragón",
    "asturias": "Asturias", "oviedo": "Asturias", "gijon": "Asturias",
    "baleares": "Islas Baleares", "illes balears": "Islas Baleares",
    "islas baleares": "Islas Baleares", "palma": "Islas Baleares",
    "mallorca": "Islas Baleares", "palma de mallorca": "Islas Baleares",
    "menorca": "Islas Baleares", "ibiza": "Islas Baleares", "eivissa": "Islas Baleares",
    "las palmas": "Canarias", "santa cruz de tenerife": "Canarias",
    "tenerife": "Canarias", "gran canaria": "Canarias", "lanzarote": "Canarias",
    "fuerteventura": "Canarias", "la palma": "Canarias", "canarias": "Canarias",
    "cantabria": "Cantabria", "santander": "Cantabria",
    "avila": "Castilla y León", "burgos": "Castilla y León", "leon": "Castilla y León",
    "palencia": "Castilla y León", "salamanca": "Castilla y León",
    "segovia": "Castilla y León", "soria": "Castilla y León",
    "valladolid": "Castilla y León", "zamora": "Castilla y León",
    "albacete": "Castilla-La Mancha", "ciudad real": "Castilla-La Mancha",
    "cuenca": "Castilla-La Mancha", "guadalajara": "Castilla-La Mancha",
    "toledo": "Castilla-La Mancha",
    "barcelona": "Cataluña", "girona": "Cataluña", "gerona": "Cataluña",
    "lleida": "Cataluña", "lerida": "Cataluña", "tarragona": "Cataluña",
    "alicante": "Comunidad Valenciana", "alacant": "Comunidad Valenciana",
    "castellon": "Comunidad Valenciana", "castello": "Comunidad Valenciana",
    "valencia": "Comunidad Valenciana",
    "badajoz": "Extremadura", "caceres": "Extremadura",
    "a coruna": "Galicia", "la coruna": "Galicia", "coruna": "Galicia",
    "lugo": "Galicia", "ourense": "Galicia", "orense": "Galicia",
    "pontevedra": "Galicia", "vigo": "Galicia", "santiago de compostela": "Galicia",
    "la rioja": "La Rioja", "rioja": "La Rioja", "logrono": "La Rioja",
    "madrid": "Madrid", "comunidad de madrid": "Madrid",
    "murcia": "Murcia", "region de murcia": "Murcia", "cartagena": "Murcia",
    "navarra": "Navarra", "pamplona": "Navarra", "nafarroa": "Navarra",
    "alava": "País Vasco", "araba": "País Vasco", "gipuzkoa": "País Vasco",
    "guipuzcoa": "País Vasco", "bizkaia": "País Vasco", "vizcaya": "País Vasco",
    "pais vasco": "País Vasco", "euskadi": "País Vasco", "bilbao": "País Vasco",
    "san sebastian": "País Vasco", "donostia": "País Vasco", "vitoria": "País Vasco",
    "vitoria gasteiz": "País Vasco",
    "ceuta": "Ceuta", "melilla": "Melilla",
}

# Comunidades por nombre (incluye variantes oficiales y cooficiales).
REGION_ALIASES = {
    "andalucia": "Andalucía", "aragon": "Aragón",
    "principado de asturias": "Asturias", "asturias": "Asturias",
    "illes balears": "Islas Baleares", "cantabria": "Cantabria",
    "castilla y leon": "Castilla y León", "castilla la mancha": "Castilla-La Mancha",
    "cataluna": "Cataluña", "catalunya": "Cataluña",
    "comunidad valenciana": "Comunidad Valenciana", "comunitat valenciana": "Comunidad Valenciana",
    "valenciana": "Comunidad Valenciana", "extremadura": "Extremadura",
    "galicia": "Galicia", "la rioja": "La Rioja",
    "comunidad de madrid": "Madrid", "region de murcia": "Murcia",
    "comunidad foral de navarra": "Navarra", "pais vasco": "País Vasco",
    "ciudad autonoma de ceuta": "Ceuta", "ciudad autonoma de melilla": "Melilla",
}

# Ciudades grandes / municipios frecuentes en ofertas sanitarias -> comunidad.
# (Ampliar a medida que aparezcan casos; guess_district devuelve "España" si no hay match.)
CITY_TO_REGION = {
    "getafe": "Madrid", "alcala de henares": "Madrid", "alcorcon": "Madrid",
    "leganes": "Madrid", "mostoles": "Madrid", "fuenlabrada": "Madrid",
    "pozuelo de alarcon": "Madrid", "majadahonda": "Madrid", "boadilla del monte": "Madrid",
    "torrejon de ardoz": "Madrid", "alcobendas": "Madrid", "san sebastian de los reyes": "Madrid",
    "hospitalet de llobregat": "Cataluña", "l hospitalet de llobregat": "Cataluña",
    "badalona": "Cataluña", "sabadell": "Cataluña", "terrassa": "Cataluña",
    "mataro": "Cataluña", "reus": "Cataluña", "manresa": "Cataluña",
    "elche": "Comunidad Valenciana", "elx": "Comunidad Valenciana", "benidorm": "Comunidad Valenciana",
    "torrevieja": "Comunidad Valenciana", "gandia": "Comunidad Valenciana", "denia": "Comunidad Valenciana",
    "marbella": "Andalucía", "jerez de la frontera": "Andalucía", "algeciras": "Andalucía",
    "dos hermanas": "Andalucía", "estepona": "Andalucía", "fuengirola": "Andalucía",
    "torremolinos": "Andalucía", "roquetas de mar": "Andalucía",
    "san cristobal de la laguna": "Canarias", "arona": "Canarias", "maspalomas": "Canarias",
    "ferrol": "Galicia", "lalin": "Galicia",
    "talavera de la reina": "Castilla-La Mancha", "puertollano": "Castilla-La Mancha",
    "ponferrada": "Castilla y León", "aranda de duero": "Castilla y León",
    "merida": "Extremadura", "plasencia": "Extremadura",
    "getxo": "País Vasco", "barakaldo": "País Vasco", "irun": "País Vasco",
}

def strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )


def norm(text: str) -> str:
    text = strip_accents(text or "")
    text = re.sub(r"[^a-zA-Z0-9\s]", " ", text).lower()
    return re.sub(r"\s+", " ", text).strip()


def dedupe_hash(title: str, company: str, district: str) -> str:
    key = f"{norm(title)}|{norm(company)}|{norm(district)}"
    return hashlib.sha256(key.encode()).hexdigest()


def slugify(text: str) -> str:
    text = norm(text).replace(" ", "-")
    return re.sub(r"-+", "-", text).strip("-")[:80]


def html_to_text(html: str | None) -> str:
    if not html:
        return ""

    text = re.sub(r"(?is)<(script|style|head|title).*?>.*?</\1>", " ", html)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</(p|div|h[1-6]|tr)>", "\n", text)
    text = re.sub(r"(?i)</li>", "\n", text)
    text = re.sub(r"(?i)<li[^>]*>", "- ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html_unescape(text)

    def is_list_item(line: str) -> bool:
        return bool(re.match(r"^[-•*]\s+\S", line) or re.match(r"^\d+[.)]\s+\S", line))

    raw_lines: list[str] = []
    for raw_line in text.splitlines():
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        if not line:
            raw_lines.append("")
            continue
        # Remove residual CSS / boilerplate from ATS HTML wrappers.
        if (
            line.startswith(".")
            or "{" in line
            or "}" in line
            or line.lower().startswith("a document with")
            or line.lower() in {"html", "body"}
        ):
            continue
        raw_lines.append(line)

    lines: list[str] = []
    for i, line in enumerate(raw_lines):
        if not line:
            prev = next((l for l in reversed(lines) if l), "")
            nxt = next((l for l in raw_lines[i + 1 :] if l), "")
            if not prev or not nxt:
                continue
            # Keep list blocks tight; no blank between intro/title and list.
            if is_list_item(prev) and is_list_item(nxt):
                continue
            if not is_list_item(prev) and is_list_item(nxt):
                continue
            if lines and lines[-1] == "":
                continue
            lines.append("")
            continue
        lines.append(line)

    cleaned = "\n".join(lines)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def guess_district(city: str | None, region: str | None = None) -> str:
    """Devuelve la comunidad autónoma (label de spain-map.ts) o "España" si no se reconoce."""
    for value in (region, city):
        if not value:
            continue
        cleaned = value.strip("[]\"' ").replace('"', "").replace("[", "").replace("]", "")
        # "Getafe, Madrid, España" -> probar cada fragmento (de derecha a izquierda,
        # el más genérico suele ir al final).
        pieces = [p.strip() for p in cleaned.split(",") if p.strip()]
        for piece in reversed(pieces) if len(pieces) > 1 else pieces:
            key = norm(piece)
            if key in ("espana", "spain", "es"):
                continue
            for table in (REGION_ALIASES, PROVINCE_TO_REGION, CITY_TO_REGION):
                if key in table:
                    return table[key]
        key = norm(cleaned)
        for table in (REGION_ALIASES, PROVINCE_TO_REGION, CITY_TO_REGION):
            for alias, region_name in table.items():
                # match por palabra completa, no por subcadena ("leon" no debe casar con "napoleon")
                if re.search(rf"\b{re.escape(alias)}\b", key):
                    return region_name
    return "España"


RULES: list[tuple[tuple[str, ...], str]] = [
    (
      (
        "formador",
        "formadora",
        "docente",
        "tecnico de formacion",
        "responsable de formacion",
        "coordinador de formacion",
        "coordinadora de formacion",
        "instructor",
        "e-learning",
        "elearning",
        "educacion clinica",
      ),
      "Formación",
    ),
    # Comercial/farma antes de Medicina/Farmacia (visitador médico, DIM…).
    (
      (
        "delegado de informacion medica",
        "delegada de informacion medica",
        "informador tecnico",
        "visitador medico",
        "visitadora medica",
        "medical science liaison",
        "msl",
        "key account",
        "comercial",
        "sales",
        "business development",
        "account manager",
        "product specialist",
        "especialista de producto",
      ),
      "Comercial / Farma",
    ),
    (
      (
        "tecnico de farmacia",
        "tecnico en farmacia",
        "tecnica en farmacia",
        "tecnica de farmacia",
        "auxiliar de farmacia",
        "tecnico medio sanitario farmacia",
        "tecnica media sanitaria farmacia",
        "parafarmacia",
      ),
      "Técnico de farmacia",
    ),
    (("farmaceutic", "farmacia", "pharmacist",), "Farmacia"),
    (
      (
        "odontolog",
        "dentista",
        "estomatolog",
        "ortodoncist",
        "higienista dental",
        "auxiliar dental",
        "protesico dental",
      ),
      "Odontología",
    ),
    # TCAE antes de Enfermería ("auxiliar de enfermería" contiene "enfermer").
    (
      (
        "tcae",
        "auxiliar de enfermeria",
        "tecnico en cuidados auxiliares",
        "tecnica en cuidados auxiliares",
        "tecnico de cuidados auxiliares",
        "cuidados auxiliares de enfermeria",
        "tecnico auxiliar de enfermeria",
        "gerocultor",
        "gerocultora",
        "auxiliar de geriatria",
        "auxiliar sociosanitario",
        "atencion sociosanitaria",
        "cuidador",
        "cuidadora",
        "auxiliar de clinica",
        "auxiliar de ayuda a domicilio",
      ),
      "TCAE",
    ),
    (("celador", "celadora", "camillero", "camillera",), "Celador"),
    (("enfermer", "matron", "nurse", "nursing",), "Enfermería"),
    # Técnicos con título explícito (antes de Medicina: "técnico en radiodiagnóstico").
    (
      (
        "tecnico superior",
        "tecnica superior",
        "tecnico especialista",
        "tecnico de laboratorio",
        "tecnico en laboratorio",
        "tecnico de rayos",
        "tecnico en radio",
        "tecnico en imagen",
        "tecnico de imagen",
        "tecnico en emergencias",
        "tecnico de emergencias",
        "tecnico sanitario",
        "tecnico en anatomia",
        "terapeuta ocupacional",
        "logoped",
        "audioprotes",
        "ortoprotes",
        "podolog",
        "optometr",
        "ortoptist",
      ),
      "Técnico sanitario",
    ),
    (
      (
        "medico",
        "medica ",
        "facultativo",
        "medicina",
        "cirujano",
        "pediatra",
        "anestesi",
        "dermatolog",
        "traumatolog",
        "urolog",
        "oftalmolog",
        "psiquiatr",
        "radiologo",
        "geriatra",
        "internista",
        "ginecolog",
        "obstetr",
        "neurolog",
        "cardiolog",
        "patologo",
        "forense",
        "physician",
        "medico residente",
        "reumatolog",
        "endocrin",
        "dermatolog",
        "traumatolog",
        "otorrino",
        "urolog",
        "oftalmolog",
        "neumolog",
        "nefrolog",
        "hematolog",
        "oncolog",
        "anestesiolog",
        "psiquiatra",
      ),
      "Medicina",
    ),
    (("fisioterap", "physiotherap", "osteopat",), "Fisioterapia"),
    (
      (
        "radiologia",
        "radiodiagnostico",
        "laboratorio",
        "laboratory",
        "diagnostico por imagen",
        "analisis clinicos",
        "anatomia patologica",
        "biolog",
        "bioquim",
        "microbiolog",
        "biomedic",
        "dietetica",
      ),
      "Técnico sanitario",
    ),
    (("psicolog", "psychologist",), "Psicología"),
    (("nutric", "dietista",), "Nutrición"),
    (
      (
        "trabajador social",
        "trabajadora social",
        "trabajo social",
        "integrador social",
        "educador social",
      ),
      "Trabajo social",
    ),
    (
      (
        "coordinador",
        "coordinadora",
        "director",
        "directora",
        "subdirector",
        "gerente",
        "gestor",
        "gestora",
        "jefe de",
        "jefa de",
        "supervisor",
        "supervisora",
        "responsable de",
        "recursos humanos",
        "calidad",
        "compliance",
        "logistica",
        "almacen",
        "compras",
        "mantenimiento",
        "financier",
        "contab",
        "controller",
        "limpieza",
        "cocinero",
        "cocina",
        "seguridad",
      ),
      "Gestión y apoyo",
    ),
    (
      (
        "administrativ",
        "recepcion",
        "secretari",
        "atencion al cliente",
        "atencion al paciente",
        "contact center",
        "call center",
        "telefonista",
        "admision",
        "documentacion clinica",
      ),
      "Administrativo",
    ),
]


_GENDER_SUFFIX_RE = re.compile(r"/(?:a|as|os|o)\b", re.I)


def guess_profession(title: str, fallback: str | None = None) -> str:
    # "Técnico/a Superior", "Trabajador/a social" -> sin la marca de género.
    t = norm(_GENDER_SUFFIX_RE.sub("", title or ""))
    if "veterin" in t:
        return "Veterinaria"
    # Profesiones sanitarias reguladas: óptico-optometrista y técnico en audiología protésica.
    if re.search(r"optometr|optico optometrista|audioprotesi|audiologia protesica", t):
        return "Óptica y audiología"
    # Solo títulos que empiezan por "Formación ..." (no texto de descripción).
    if len(t) < 70 and t.startswith("formacion "):
        return "Formación"
    for needles, label in RULES:
        if any(norm(n) in t for n in needles):
            return label
    if any(n in t for n in OTHER_HINTS):
        return "Otros"
    if fallback:
        return guess_profession(fallback) if fallback != title else "Otros"
    return "Otros"


OTHER_HINTS = (
    "conductor", "chofer", "helpdesk", "informatica", "sistemas", "data analytics",
    "ingenier", "postdoc", "investigador", "researcher", "desarrollador",
)


def guess_contract(text: str | None) -> str | None:
    """Etiqueta de contrato en español (la app la agrupa en filtros: contracts.ts)."""
    if not text:
        return None
    t = norm(text)
    if "media jornada" in t or "jornada parcial" in t or "tiempo parcial" in t or "part time" in t or "parttime" in t:
        return "Media jornada"
    if "turno" in t or "guardia" in t:
        return "Turnos"
    if "autonomo" in t or "prestacion de servicios" in t or "freelance" in t:
        return "Autónomo"
    if "indefinid" in t or re.search(r"\bfijo\b", t) or "plaza en propiedad" in t:
        return "Indefinido"
    if any(k in t for k in ("temporal", "interin", "eventual", "sustitu", "obra y servicio", "duracion determinada")):
        return "Temporal"
    if "jornada completa" in t or "tiempo completo" in t or "full time" in t or "fulltime" in t:
        return "Jornada completa"
    if "contrato" in t:
        return "Contrato"
    return None
