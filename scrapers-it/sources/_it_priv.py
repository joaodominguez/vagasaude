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

from common.normalize import guess_district, guess_profession, norm

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
