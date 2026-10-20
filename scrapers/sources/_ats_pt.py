"""Utilitários partilhados pelos scrapers de ATS (Teamtailor, Recruitee, ...)."""

from __future__ import annotations

import re

from common.http import HttpClient
from common.models import JobPayload
from common.normalize import (
    CITY_TO_DISTRICT,
    guess_contract,
    guess_district,
    guess_profession,
    html_to_text,
    norm,
)

# Localidades que os ATS devolvem e o normalize não conhece (ou em inglês).
# chave normalizada → (distrito, concelho)
EXTRA_PLACES: dict[str, tuple[str, str | None]] = {
    "lisbon": ("Lisboa", "Lisboa"),
    "lisboa": ("Lisboa", "Lisboa"),
    "oporto": ("Porto", "Porto"),
    "setubal": ("Setúbal", "Setúbal"),
    "guimaraes": ("Braga", "Guimarães"),
    "evora": ("Évora", "Évora"),
    "alcabideche": ("Lisboa", "Cascais"),
    "estoril": ("Lisboa", "Cascais"),
    "parede": ("Lisboa", "Cascais"),
    "alges": ("Lisboa", "Oeiras"),
    "queluz": ("Lisboa", "Sintra"),
    "cacem": ("Lisboa", "Sintra"),
    "agualva cacem": ("Lisboa", "Sintra"),
    "moscavide": ("Lisboa", "Loures"),
    "povoa de varzim": ("Porto", "Póvoa de Varzim"),
    "vila do conde": ("Porto", "Vila do Conde"),
    "santo tirso": ("Porto", "Santo Tirso"),
    "penafiel": ("Porto", "Penafiel"),
    "paredes": ("Porto", "Paredes"),
    "amarante": ("Porto", "Amarante"),
    "felgueiras": ("Porto", "Felgueiras"),
    "espinho": ("Aveiro", "Espinho"),
    "ovar": ("Aveiro", "Ovar"),
    "ilhavo": ("Aveiro", "Ílhavo"),
    "santa maria da feira": ("Aveiro", "Santa Maria da Feira"),
    "oliveira de azemeis": ("Aveiro", "Oliveira de Azeméis"),
    "barcelos": ("Braga", "Barcelos"),
    "figueira da foz": ("Coimbra", "Figueira da Foz"),
    "marinha grande": ("Leiria", "Marinha Grande"),
    "pombal": ("Leiria", "Pombal"),
    "torres novas": ("Santarém", "Torres Novas"),
    "entroncamento": ("Santarém", "Entroncamento"),
    "ourem": ("Santarém", "Ourém"),
    "palmela": ("Setúbal", "Palmela"),
    "sesimbra": ("Setúbal", "Sesimbra"),
    "angra do heroismo": ("Açores", "Angra do Heroísmo"),
    "algarve": ("Faro", None),
}

# Valores que não identificam uma localidade.
_NOT_A_PLACE = {"", "portugal", "pt", "remote", "remoto", "portugal continental"}

CLINICAL_RE = re.compile(
    r"veterin|enfermeir|auxiliar|tecnic|medic|cirurgi|anestes|radiolog|fisioterap"
)
# Palavras que confirmam função clínica mesmo com termos administrativos no título.
_CORE_CLINICAL_RE = re.compile(
    r"enfermeir|auxiliar|medic|cirurgi|anestes|radiolog|fisioterap"
)
# "veterin"/"tecnic" sozinhos podem ser só o nome do hospital ou uma função de suporte
# (ex.: "Rececionista AniCura Restelo Hospital Veterinário").
_NON_CLINICAL_RE = re.compile(
    r"rececion|recepcion|administrativ|admin|manager|marketing|payroll|talent"
    r"|facilities|planning|contabil|financ|recursos humanos|comercial|vendas|sales"
    r"|limpeza|manutencao|informatic|director|diretor|gestor"
)


def is_clinical_title(title: str) -> bool:
    t = norm(title)
    if not CLINICAL_RE.search(t):
        return False
    if _NON_CLINICAL_RE.search(t) and not _CORE_CLINICAL_RE.search(t):
        return False
    return True


def vet_profession(title: str) -> str:
    # Veterinário (sem enfermeiro/auxiliar) → Medicina, como "Médico Veterinário".
    t = norm(title)
    if "veterin" in t and not re.search(r"enfermeir|auxiliar|tecnic|enfermagem", t):
        return "Medicina"
    return guess_profession(title)


def contract_from(title: str, description: str) -> str | None:
    # "prestação de cuidados" (veterinários) não é prestação de serviços.
    intro = re.sub(r"(?i)presta[cç][aã]o de cuidados", "", description[:400])
    return guess_contract(title) or guess_contract(intro)


def resolve_pt_place(
    locality: str | None, region: str | None = None
) -> tuple[str, str | None] | None:
    """Localidade PT → (distrito, concelho); None se não der para resolver."""
    for value in (locality, region):
        key = norm(value or "")
        if key in _NOT_A_PLACE:
            continue
        if key in EXTRA_PLACES:
            return EXTRA_PLACES[key]
        district = guess_district(value)
        if district != "Portugal":
            return district, (value or "").strip() or None
    return None


def place_from_text(text: str | None) -> tuple[str, str | None] | None:
    """Procura uma localidade conhecida (palavra inteira) num título."""
    t = f" {norm(text or '')} "
    candidates = list(EXTRA_PLACES.items()) + [
        (k, (v, None)) for k, v in CITY_TO_DISTRICT.items()
    ]
    for key, place in candidates:
        key = norm(key)
        if key and f" {key} " in t:
            district, concelho = place
            return district, concelho or key.title()
    return None


def _is_pt_country(value: str | None) -> bool:
    return norm(value or "") in {"pt", "portugal", "prt"}


def fetch_teamtailor(
    url: str,
    slug: str,
    company: str,
    title_filter=is_clinical_title,
) -> list[JobPayload]:
    """Feed jobs.json do Teamtailor (mesma abordagem do cuf.py), só vagas em PT."""
    client = HttpClient()
    jobs: list[JobPayload] = []
    seen: set[str] = set()
    try:
        while url:
            data = client.get_json(url)
            for item in data.get("items", []):
                job = _teamtailor_item(item, slug, company, title_filter)
                if job and job.source_id not in seen:
                    seen.add(job.source_id)
                    jobs.append(job)
            url = data.get("next_url")
    finally:
        client.close()
    return jobs


def _teamtailor_item(item: dict, slug: str, company: str, title_filter) -> JobPayload | None:
    posting = item.get("_jobposting") or {}
    title = (item.get("title") or posting.get("title") or "").strip()
    if not title or (title_filter and not title_filter(title)):
        return None

    # Só moradas em Portugal (o feed da IVC mistura Espanha); país primeiro.
    addresses = [
        (loc or {}).get("address") or {} for loc in posting.get("jobLocation") or []
    ]
    pt_addresses = [a for a in addresses if _is_pt_country(a.get("addressCountry"))]
    if not pt_addresses:
        return None
    place = None
    for address in pt_addresses:
        place = resolve_pt_place(address.get("addressLocality"), address.get("addressRegion"))
        if place:
            break
    # Morada genérica ("Portugal") → tenta a localidade no título.
    place = place or place_from_text(title)
    if not place:
        return None
    district, concelho = place

    description = html_to_text(posting.get("description") or item.get("content_html"))
    source_id = str(((posting.get("identifier") or {}).get("value")) or item.get("id"))
    return JobPayload(
        title=title,
        company=company,
        location_district=district,
        location_concelho=concelho,
        profession=vet_profession(title),
        specialty=None,
        sector="privado",
        contract_type=contract_from(title, description),
        description=description or title,
        requirements=None,
        salary=None,
        application_url=item.get("url") or "",
        source=slug,
        source_id=source_id,
        published_at=item.get("date_published") or posting.get("datePosted"),
    )
