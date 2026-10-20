"""Utilitários partilhados pelos scrapers de grupos/redes de farmácias PT.

- Filtro estrito de funções: farmacêutico(a) (incl. diretor técnico, adjunto,
  substituto, hospitalar) e técnico(a) / técnico(a) auxiliar de farmácia.
- Resolução de localidades → (distrito, concelho) com localidades que o
  ``guess_district`` não conhece.
"""

from __future__ import annotations

import re

from common.normalize import guess_district, norm

PROFESSION = "Farmácia"

_INCLUDE = re.compile(
    r"farmaceut"
    r"|pharmacist"
    r"|\btecnic[oa]s?\s+(?:auxiliar(?:es)?\s+)?de\s+farmacia"
    r"|\bauxiliar(?:es)?\s+de\s+farmacia"
    r"|\btaf\b"
    r"|\bdiret(?:or|ora)\s+tecnic"
    r"|\bdirect(?:or|ora)\s+tecnic"
    r"|\bresponsavel\s+tecnic"
)

_EXCLUDE = re.compile(
    r"vendedor|operador|operadora|\bcaixa\b|repositor|gestor[a]?\s+de\s+loja"
    r"|estetic|esteticista|otica|optometr|ortoptist|perfumaria|beleza"
    r"|back\s*office|estagi|delegad|informacao\s+medica|comercial|marketing"
    r"|motorista|limpeza|rececionist|recepcionist|enfermeir|nutricion"
    r"|fisiologist|analista|programador|logistic|armazem|dermocosmetic"
)


def _role_key(title: str) -> str:
    # "Diretor(a) Técnico(a)" → "diretor tecnico"; "Técnico/a" → "tecnico".
    t = re.sub(r"\(\s*[ao]s?\s*\)|/\s*[ao]s?\b", "", title or "", flags=re.I)
    return norm(t)


def is_pharmacy_role(title: str) -> bool:
    key = _role_key(title)
    if not key or _EXCLUDE.search(key):
        return False
    return bool(_INCLUDE.search(key))


# chave normalizada → (distrito, concelho)
EXTRA_PLACES: dict[str, tuple[str, str | None]] = {
    "alcochete": ("Setúbal", "Alcochete"),
    "corroios": ("Setúbal", "Seixal"),
    "amora": ("Setúbal", "Seixal"),
    "sobreda": ("Setúbal", "Almada"),
    "aroeira": ("Setúbal", "Almada"),
    "lavradio": ("Setúbal", "Barreiro"),
    "mirandela": ("Bragança", "Mirandela"),
    "torre de d chama": ("Bragança", "Mirandela"),
    "barcelos": ("Braga", "Barcelos"),
    "ponte de lima": ("Viana do Castelo", "Ponte de Lima"),
    "rio maior": ("Santarém", "Rio Maior"),
    "arazede": ("Coimbra", "Montemor-o-Velho"),
    "cinfaes": ("Viseu", "Cinfães"),
    "vouzela": ("Viseu", "Vouzela"),
    "trancoso": ("Guarda", "Trancoso"),
    "castanheira de pera": ("Leiria", "Castanheira de Pera"),
    "peso da regua": ("Vila Real", "Peso da Régua"),
    "venda nova": ("Lisboa", "Amadora"),
    "rio de mouro": ("Lisboa", "Sintra"),
    "carnaxide": ("Lisboa", "Oeiras"),
    "alges": ("Lisboa", "Oeiras"),
    "algarve": ("Faro", None),
}

_NOT_PLACE = {"", "portugal", "pt", "varias localizacoes", "remoto"}


def resolve_place(*candidates: str | None) -> tuple[str, str | None] | None:
    """Primeira localidade reconhecida → (distrito, concelho); None se nenhuma."""
    for raw in candidates:
        if not raw:
            continue
        value = re.sub(r",\s*portugal\s*$", "", raw.strip(), flags=re.I).strip(" .,-")
        key = norm(value)
        if key in _NOT_PLACE:
            continue
        for alias, (district, concelho) in EXTRA_PLACES.items():
            if re.search(rf"\b{re.escape(alias)}\b", key):
                return district, concelho
        district = guess_district(value)
        if district != "Portugal":
            return district, value.split(",")[0].strip() or district
    return None
