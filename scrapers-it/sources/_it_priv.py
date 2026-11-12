"""Helper condivisi dai lettori del settore PRIVATO (Humanitas, Clariane, AniCura, Cerba, NephroCare).

- filtro clinico (solo professioni sanitarie: niente amministrativo, IT, commerciale, HR, ...);
- pulizia del testo libero (email e telefoni personali escono dal testo);
- esclusione di talent pool / candidature spontanee;
- lettura del JobPosting JSON-LD.

Le fonti private non sono mai "concorso": il tipo "offerta" lo decide la app (settore != Pubblico).
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from common.normalize import (
    CITY_TO_REGION, PROVINCE_TO_REGION, REGION_ALIASES, SIGLA_TO_REGION,
    guess_district, guess_profession, norm,
)

SECTOR = "privato"
MIN_BODY = 60
MAX_DESCRIPTION = 8000

# Categorie dell'app che consideriamo "clinico/sanitario" per le fonti private.
CLINICAL_PROFESSIONS = {
    "Medicina", "Infermieristica", "OSS", "Fisioterapia", "Tecnici sanitari", "Ostetricia",
    "Farmacia", "Psicologia", "Odontoiatria", "Veterinaria", "Servizio sociale",
    "Nutrizione e dietistica", "Logopedia e riabilitazione", "Ottica e audiometria",
}

# Titoli che non sono mai una posizione concreta.
_TALENT_POOL_RE = re.compile(
    r"candidatura spontanea|autocandidatura|auto-candidatura|talent pool|talent community|"
    r"bacheca candidature|invia il tuo cv|open application|spontaneous application|"
    r"banca (dei )?cv|ricerca continuativa",
    re.I,
)

# Contatti dentro il testo libero (email, telefoni IT, WhatsApp): l'intera riga esce.
_CONTACT_RE = re.compile(
    r"[\w.+-]+@[\w-]+\.[\w.]+"
    r"|(?<![\d/])(?:\+39[\s.-]?|0039[\s.-]?)?(?:3\d{2}(?:[\s.]?\d){7}|0\d{1,3}(?:[\s.]?\d){6,9})(?!\d)"
    r"|whats?app",
    re.I,
)


def clean_text(text: str) -> str:
    lines = [ln.strip() for ln in (text or "").splitlines()]
    kept = [ln for ln in lines if not _CONTACT_RE.search(ln)]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(kept)).strip()


def is_talent_pool(title: str, text: str = "") -> bool:
    return bool(_TALENT_POOL_RE.search(title or "")) or bool(_TALENT_POOL_RE.search((text or "")[:300]))


def classify(title: str, title_map: tuple[tuple[str, str], ...] = ()) -> str | None:
    """Categoria dell'app per un titolo, oppure None se il ruolo non e' clinico.

    `title_map`: coppie (regex, categoria) provate PRIMA di guess_profession, per i titoli
    che quest'ultimo non riconosce (es. "Internship Rotazionale" in una clinica veterinaria).
    """
    for pattern, label in title_map:
        if re.search(pattern, title or "", re.I):
            return label
    profession = guess_profession(title)
    return profession if profession in CLINICAL_PROFESSIONS else None


def iso_datetime(value: str | None) -> str | None:
    """ISO (anche senza fuso) -> ISO UTC; stringa non valida -> None."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def job_posting(html: str) -> dict | None:
    """Primo JobPosting JSON-LD della pagina (anche dentro @graph)."""
    for raw in re.findall(r"<script[^>]*application/ld\+json[^>]*>(.*?)</script>", html, re.S | re.I):
        try:
            data = json.loads(raw, strict=False)
        except ValueError:
            continue
        items = data if isinstance(data, list) else (data.get("@graph") or [data]) if isinstance(data, dict) else []
        for item in items:
            if isinstance(item, dict) and item.get("@type") == "JobPosting":
                return item
    return None


def region_label(city: str | None, region: str | None) -> str:
    """Regione (etichetta dell'app) da citta' e/o regione grezza; "Italia" se non riconosciuta."""
    return guess_district(city, region)


def is_italy(country) -> bool:
    if isinstance(country, dict):
        country = country.get("name")
    return norm(str(country or "it")) in {"it", "ita", "italy", "italia"}


_LOWER_WORDS = {"di", "da", "e", "ed", "in", "per", "a", "il", "la", "lo", "le", "dei", "del", "della", "dell", "delle",
                "degli", "al", "alla", "con", "o", "su", "nel", "nella", "nelle", "ai", "alle"}
_ACRONYMS = {"oss", "tsrm", "rsa", "asa", "ecg", "tac", "rm", "uo", "utic", "icu", "nsl", "cdc", "hse"}


def pretty_title(title: str) -> str:
    """Titolo MAIUSCOLO (frequente negli ATS italiani) -> Maiuscola Iniziale; gli altri restano com'erano."""
    title = re.sub(r"\s+", " ", (title or "").replace("\\", "/")).strip()
    letters = [c for c in title if c.isalpha()]
    if not letters or sum(c.isupper() for c in letters) / len(letters) < 0.7:
        return title

    def word(match: re.Match) -> str:
        w = match.group(0)
        low = w.lower()
        if low in _ACRONYMS:
            return w.upper()
        if match.start() > 0 and (low in _LOWER_WORDS or title[match.start() - 1] in "'\u2019"):
            return low
        return low[:1].upper() + low[1:]

    return re.sub(r"[^\W\d_]+", word, title)


_PLACE_NOISE = re.compile(
    r"\b(affidea|asst|cdc|nsl|medical center|medicenter|centro|polidiagnostico|italia|sede( di lavoro)?|"
    r"id( ricerca)?|n|numero|in libera professione|libera professione)\b|\bn\s*°.*$|\bid\b.*$|\d+|[°º]",
    re.I,
)


def locate_in_segments(
    segments: list[str], api_city: str | None = None, api_region: str | None = None
) -> tuple[str | None, str]:
    """(citta', regione) cercando in pezzi di testo (titolo, "Sede: ...") prima dei dati grezzi dell'ATS.

    Per ogni pezzo: sigla di provincia tra parentesi, oppure nome esatto di citta'/provincia nelle tabelle
    di normalize. Poi i dati dell'ATS (citta' scartata se contraddice la regione). Regione "Italia" se ignota.
    """
    if api_city and len(api_city) > 2 and not api_city.isdigit():
        hit = norm(api_city)
        if any(re.search(rf"\b{re.escape(hit)}\b", norm(seg)) for seg in segments) and api_region:
            region = guess_district(None, api_region)
            if region != "Italia":
                return (api_city.title() if api_city.isupper() or api_city.islower() else api_city), region
    for seg in segments:
        sig = re.findall(r"\(([A-Z]{2})\)", seg)
        name = re.sub(r"\([^)]*\)", " ", seg)
        name = re.sub(r"\s+", " ", _PLACE_NOISE.sub(" ", name)).strip(" -,;:.")
        key = norm(name)
        if sig and sig[0] in SIGLA_TO_REGION:
            return (name.title() if name else None), SIGLA_TO_REGION[sig[0]]
        region = CITY_TO_REGION.get(key) or PROVINCE_TO_REGION.get(key)
        if name and region:
            return name, region
    region = guess_district(None, api_region) if api_region else "Italia"
    city = (api_city or "").strip() or None
    if city and (city.isdigit() or len(city) < 3):
        city = None
    if city:
        city_region = guess_district(city, None)
        if region == "Italia":
            region = city_region
        elif city_region not in ("Italia", region):
            city = None
        if city and (city.islower() or city.isupper()):
            city = city.title()
    return city, region


_CITY_LOWER = {"al", "del", "della", "di", "da", "sul", "sulla", "sui", "in", "nel", "nell", "e", "ed", "le", "la", "lo"}


def tidy_city(city: str | None) -> str | None:
    """"San Colombano Al Lambro" -> "San Colombano al Lambro"; "Romano D'ezzelino" -> "Romano d'Ezzelino"."""
    city = re.sub(r"\s+", " ", city or "").strip()
    if not city:
        return None

    def fix(match: re.Match) -> str:
        w = match.group(0)
        return w.lower() if match.start() > 0 and w.lower() in _CITY_LOWER else w[:1].upper() + w[1:].lower()

    city = re.sub(r"[^\W\d_]+", fix, city)
    return re.sub(r"(?<=\s)D'", "d'", city)
