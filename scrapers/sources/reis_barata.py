"""Farmácias Grupo Reis Barata — página de recrutamento.

A página lista, por farmácia do grupo (``option`` com id), as vagas abertas
(``div.vagascontent[data-rid] li``). As vagas não têm página própria nem texto
longo: a descrição é composta a partir da farmácia, função e regime.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, slugify
from sources._farmacia_pt import PROFESSION, is_pharmacy_role, resolve_place

BASE = "https://farmaciasreisbarata.pt"
URL = f"{BASE}/recrutamento/"
COMPANY = "Farmácias Reis Barata"
CONTACT = "geral@farmaciasreisbarata.pt · 215 857 139"

_REGIME = re.compile(r"\b(full|part)[\s-]*time\b", re.I)


class ReisBarataScraper(BaseScraper):
    slug = "reis_barata"
    name = "Farmácias Grupo Reis Barata — Recrutamento"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        try:
            html = client.get_text(URL)
        finally:
            client.close()
        return parse_page(html)


def parse_page(html: str) -> list[JobPayload]:
    soup = BeautifulSoup(html, "lxml")
    pharmacies = {
        (opt.get("value") or "").strip(): opt.get_text(" ", strip=True)
        for opt in soup.select("select#agendafarmacia1 option[value]")
        if (opt.get("value") or "").strip() not in ("", "0")
    }
    jobs: list[JobPayload] = []
    seen: set[str] = set()
    for block in soup.select("div.vagascontent[data-rid]"):
        rid = (block.get("data-rid") or "").strip()
        pharmacy = pharmacies.get(rid)
        if not pharmacy:
            continue
        place = _pharmacy_place(pharmacy)
        if not place:
            continue
        district, concelho = place
        for li in block.select("li"):
            raw = re.sub(r"\s+", " ", li.get_text(" ", strip=True)).strip()
            role, regime, extra = _split_role(raw)
            if not role or not is_pharmacy_role(role):
                continue
            source_id = f"{rid}-{slugify(role)}"
            if source_id in seen:
                continue
            seen.add(source_id)
            title = f"{role} – {pharmacy}"
            description = _description(pharmacy, role, regime, extra)
            jobs.append(
                JobPayload(
                    title=title,
                    company=COMPANY,
                    location_district=district,
                    location_concelho=concelho,
                    profession=PROFESSION,
                    specialty=None,
                    sector="privado",
                    contract_type=_contract(regime),
                    description=description,
                    requirements=None,
                    salary=None,
                    application_url=URL,
                    source="reis_barata",
                    source_id=source_id,
                    published_at=None,
                )
            )
    return jobs


def _split_role(raw: str) -> tuple[str, str | None, str | None]:
    """ "Farmacêutico/a - Full-Time e Part-Time (2 vagas)" → (função, regime, extra)."""
    extra = None
    match = re.search(r"\(([^)]*vaga[^)]*)\)", raw, re.I)
    if match:
        extra = match.group(1).strip()
        raw = (raw[: match.start()] + raw[match.end() :]).strip()
    regimes = [m.group(0) for m in _REGIME.finditer(raw)]
    regime = None
    if regimes:
        regime = " e ".join(
            dict.fromkeys(re.sub(r"[\s-]+", "-", r).title() for r in regimes)
        )
        first = _REGIME.search(raw)
        raw = raw[: first.start()] if first else raw
    role = re.sub(r"\s*[-–]\s*$", "", raw.strip()).strip(" -–")
    role = re.sub(r"\s+-\s*(e\s*)?$", "", role).strip()
    return role, regime, extra


def _contract(regime: str | None) -> str | None:
    if not regime:
        return None
    key = regime.lower()
    if "full" in key and "part" in key:
        return None
    return guess_contract(regime)


def _pharmacy_place(pharmacy: str) -> tuple[str, str | None] | None:
    # "Farmácia Reis Barata - Amadora UBBO" / "Farmácia Reis Barata Lisboa - Av. República"
    parts = [p.strip() for p in re.split(r"\s+-\s+", pharmacy) if p.strip()]
    candidates: list[str] = []
    if len(parts) > 1:
        candidates.append(parts[1].split()[0] if parts[1].split() else parts[1])
        candidates.append(parts[1])
    words = parts[0].split()
    if words:
        candidates.append(words[-1])
    return resolve_place(*candidates)


def _description(
    pharmacy: str, role: str, regime: str | None, extra: str | None
) -> str:
    lines = [
        f"A {pharmacy}, do Grupo Reis Barata, tem vaga aberta para {role}.",
        "",
        f"Função: {role}",
    ]
    if regime:
        lines.append(f"Regime: {regime}")
    if extra:
        lines.append(f"Número de vagas: {extra}")
    lines += [
        f"Farmácia: {pharmacy}",
        "",
        "Candidatura: através do formulário de recrutamento do Grupo Reis Barata "
        f"({URL}), selecionando a farmácia e a função, ou pelo contacto {CONTACT}.",
    ]
    return "\n".join(lines)
