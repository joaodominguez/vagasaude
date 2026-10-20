"""Rede Elo Farma — "Vagas em aberto nas Farmácias da Rede Elo Farma".

Página Webflow (rich text) com, por farmácia (``h4``), a linha "Vaga:" (uma ou
várias funções separadas por "I"/"|"), "Email:" e "Contacto:". Gera uma vaga
por farmácia × função (farmacêutico / técnico / técnico auxiliar).
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup, Tag

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, norm, slugify
from sources._farmacia_pt import PROFESSION, is_pharmacy_role, resolve_place

URL = "https://www.elofarma.com/destaques-page/vagas-em-aberto"
COMPANY_FALLBACK = "Rede Elo Farma"
CENTRAL_EMAIL = "recrutamento@elofarma.com"

ROLES = (
    ("tecnico-auxiliar", "Técnico(a) Auxiliar de Farmácia"),
    ("tecnico", "Técnico(a) de Farmácia"),
    ("farmaceutico", "Farmacêutico(a)"),
)


class EloFarmaScraper(BaseScraper):
    slug = "elo_farma"
    name = "Rede Elo Farma — Vagas em aberto"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        try:
            html = client.get_text(URL)
        finally:
            client.close()
        return parse_page(html)


def parse_page(html: str) -> list[JobPayload]:
    soup = BeautifulSoup(html, "lxml")
    body = soup.select_one(".w-richtext") or soup
    jobs: list[JobPayload] = []
    seen: set[str] = set()
    region = ""
    current: dict | None = None
    entries: list[dict] = []
    for el in body.find_all(["h2", "h3", "h4", "h5", "h6", "p"]):
        if not isinstance(el, Tag):
            continue
        text = _clean(el.get_text(" ", strip=True))
        if not text:
            continue
        if el.name == "h3":
            region = text
            current = None
            continue
        if el.name == "h4":
            current = {"pharmacy": text, "region": region, "fields": {}}
            entries.append(current)
            continue
        if current is None:
            continue
        match = re.match(
            r"^(Vaga|Email|E-mail|Contacto|Telefone)\s*:\s*(.*)$", text, re.I
        )
        if match:
            key = norm(match.group(1)).replace("e mail", "email")
            current["fields"][key] = match.group(2).strip()

    for entry in entries:
        vaga = entry["fields"].get("vaga") or ""
        if not vaga:
            continue
        name, place_text, paren = _split_pharmacy(entry["pharmacy"])
        place = resolve_place(place_text, paren)
        if not place:
            continue
        district, concelho = place
        for key, role in _roles(vaga):
            source_id = f"{slugify(name)}-{key}"
            if source_id in seen:
                continue
            seen.add(source_id)
            location_label = place_text or concelho or district
            jobs.append(
                JobPayload(
                    title=f"{role} – {name} ({location_label})",
                    company=name or COMPANY_FALLBACK,
                    location_district=district,
                    location_concelho=concelho,
                    profession=PROFESSION,
                    specialty=None,
                    sector="privado",
                    contract_type=guess_contract(vaga),
                    description=_description(entry, name, role, vaga),
                    requirements=None,
                    salary=None,
                    application_url=URL,
                    source="elo_farma",
                    source_id=source_id,
                    published_at=None,
                )
            )
    return jobs


def _clean(text: str) -> str:
    text = text.replace("‍", " ").replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def _split_pharmacy(header: str) -> tuple[str, str, str]:
    """ "Farmácia Central - Peso da Régua (Vila Real)" → (nome, local, parêntesis)."""
    paren = ""
    match = re.search(r"\(([^)]+)\)\s*$", header)
    if match:
        paren = match.group(1).strip()
        header = header[: match.start()].strip()
    parts = [p.strip() for p in re.split(r"\s+[-–]\s+|\s{2,}-\s*", header) if p.strip()]
    name = parts[0] if parts else header
    place = parts[-1] if len(parts) > 1 else ""
    return name, place, paren


def _roles(vaga: str) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    for chunk in re.split(r"\s+[I|]\s+|\|", vaga):
        chunk = chunk.strip()
        if not chunk or not is_pharmacy_role(chunk):
            continue
        key = norm(re.sub(r"\(\s*[ao]\s*\)", "", chunk))
        if "auxiliar" in key:
            role = ROLES[0]
        elif "tecnic" in key:
            role = ROLES[1]
        elif "farmaceut" in key:
            role = ROLES[2]
        else:
            continue
        if role not in found:
            found.append(role)
    return found


def _description(entry: dict, name: str, role: str, vaga: str) -> str:
    fields = entry["fields"]
    lines = [
        f"A {name}, farmácia da Rede Elo Farma, está a recrutar {role}.",
        "",
        f"Farmácia: {entry['pharmacy']}",
    ]
    if entry.get("region"):
        lines.append(f"Zona: {entry['region'].replace('Vagas a ', '')}")
    lines.append(f"Vaga(s) anunciada(s): {vaga}")
    if fields.get("email"):
        lines.append(f"Email: {fields['email']}")
    if fields.get("contacto"):
        lines.append(f"Contacto: {fields['contacto']}")
    lines += [
        "",
        "Candidaturas diretamente para a farmácia (email/contacto acima) ou para "
        f"{CENTRAL_EMAIL}.",
    ]
    return "\n".join(lines)
