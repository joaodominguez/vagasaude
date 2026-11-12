"""Grupo OralMED Saúde — clínicas dentárias (recrutamento.oralmed.pt, plataforma CVGuard/Harpoon).

* Lista: ``POST /GetOffersFiltered`` (form: SortColumn, SortOrderAsc, PageNumber, PageSize) devolve
  ``{count, list: [{Id, Title, Location: "Distrito: X, Concelho: Y", Code, ...}]}`` — a mesma
  chamada que a página /Offers faz.
* Detalhe (e link de candidatura): ``/OfferDetails?id=<Id>`` — descrição em ``.harpoon-offer-desc``.

Só funções de saúde e de clínica (médico dentista, higienista, assistência dentária, prótese,
coordenação clínica, receção/gestão de pacientes). Ficam de fora funções de escritório
(contabilidade, area manager, contact center, marketing…) e as candidaturas espontâneas com local
"Nacional" (bolsa de talentos, não vaga concreta — o Google for Jobs desaconselha-as).
Adicionado 2026-11-12. robots.txt: 404 (sem regras). Pedidos com ≥1 s de intervalo.
"""
from __future__ import annotations

import re

import httpx
from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_district, guess_profession, html_to_text

BASE = "https://recrutamento.oralmed.pt"
COMPANY = "Grupo OralMED Saúde"

_NOT_CLINICAL = re.compile(
    r"contabil|area manager|contact cent|call cent|marketing|inform[aá]tic|\bTI\b|financeir|"
    r"jur[ií]dic|recursos humanos|comercial|compras|log[ií]stic",
    re.I,
)
# Títulos da OralMED → categorias do site (o guess genérico deixava 2/3 em "Outros").
_PROFESSIONS = [
    (re.compile(r"m[eé]dic[oa] dentista|dentista|ortodont", re.I), "Medicina"),
    (re.compile(r"higienista|pr[oó]tese dent", re.I), "Técnico de Saúde"),
    (re.compile(r"assist[eê]ncia dent|assistente dent", re.I), "Auxiliares"),
    (re.compile(r"gest[aã]o de unidade|coordena[cç][aã]o", re.I), "Gestão & suporte"),
    (re.compile(r"rece[cç][aã]o|rececion|gest[aã]o de pacientes", re.I), "Administrativo"),
]


def profession_for(title: str) -> str:
    for pattern, profession in _PROFESSIONS:
        if pattern.search(title):
            return profession
    return guess_profession(title, "Outros")


_LOCATION = re.compile(r"Distrito:\s*([^,]+),\s*Concelho:\s*(.+)", re.I)


def parse_location(raw: str | None) -> tuple[str, str | None] | None:
    """"Distrito: Lisboa, Concelho: Oeiras" → ("Lisboa", "Oeiras"); "Nacional" → None."""
    m = _LOCATION.search(raw or "")
    if not m:
        return None
    district, concelho = m.group(1).strip(), m.group(2).strip()
    if district.lower() == "nacional":
        return None
    district = guess_district(concelho if concelho not in ("*", "") else district, district) or district
    return district, (None if concelho in ("*", "") else concelho)


def clean_title(title: str) -> str:
    """'HIGIENISTA ORAL |  Grupo OralMED Saúde' → 'Higienista oral'; mantém a clínica se for local."""
    parts = [p.strip() for p in re.split(r"\s+[|I]\s+", title) if p.strip()]
    head = parts[0] if parts else title.strip()
    if head.isupper():
        head = head.capitalize()
    tail = [p for p in parts[1:] if not re.search(r"grupo oralmed", p, re.I)]
    return " – ".join([head, *tail]) if tail else head


class OralmedScraper(BaseScraper):
    slug = "oralmed"
    name = "Grupo OralMED Saúde (clínicas dentárias)"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        try:
            response = client.post_form_response(
                f"{BASE}/GetOffersFiltered",
                {"SortColumn": "UpdateDate", "SortOrderAsc": "false", "PageNumber": "1", "PageSize": "200"},
            )
            response.raise_for_status()
            offers = (response.json() or {}).get("list") or []
            for offer in offers:
                title = (offer.get("Title") or "").strip()
                offer_id = (offer.get("Id") or "").strip()
                place = parse_location(offer.get("Location"))
                if not title or not offer_id or not place or _NOT_CLINICAL.search(title):
                    continue
                url = f"{BASE}/OfferDetails?id={offer_id}"
                try:
                    detail = client.get_text(url)
                except httpx.HTTPError:
                    detail = ""
                description = _description(detail)
                district, concelho = place
                clean = clean_title(title)
                jobs.append(
                    JobPayload(
                        title=clean,
                        company=COMPANY,
                        location_district=district,
                        location_concelho=concelho,
                        profession=profession_for(clean),
                        specialty=None,
                        sector="privado",
                        contract_type=guess_contract(f"{title} {description[:600]}"),
                        description=(description or clean)[:8000],
                        requirements=None,
                        salary=None,
                        application_url=url,
                        source=self.slug,
                        source_id=offer.get("Code") or offer_id,
                        published_at=None,
                    )
                )
        finally:
            client.close()
        return jobs


def _description(html: str) -> str:
    if not html:
        return ""
    node = BeautifulSoup(html, "html.parser").select_one(".harpoon-offer-desc")
    return html_to_text(str(node)).strip() if node else ""
