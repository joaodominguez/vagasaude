"""Campania: ASL Napoli 3 Sud — «Concorsi» (Liferay, lista de registos DDL).

https://www.aslnapoli3sud.it/concorsi : uma tabela HTML com TODOS os registos (histórico, ~850) paginada só no browser
(JS) — basta um pedido. Colunas: título (inclui, no fim, o estado do procedimento: «CONVOCAZIONE PROVA», «ELENCO CANDIDATI
AMMESSI», «ESITO...»), data (publicação) e data scadenza. robots.txt do site: `Disallow:` vazio.
O link por item é a vista do registo (mesmo URL de lista com o recordId, como faz o JS da página).
- bando aberto = título sem marcadores de fase e scadenza futura;
- «GRADUATORIA ...» no início do título = graduatoria (só título, ente, data e link).
"""
from __future__ import annotations

import re
from datetime import datetime

from common.http import HttpClient

from . import _it_pub as P
from ._it_regional import Item, RegionalScraper, Source, collect, get_retry, parse_dmy, text_of

BASE = "https://www.aslnapoli3sud.it"
LIST_URL = BASE + "/concorsi"
_INSTANCE = "com_liferay_dynamic_data_lists_web_portlet_DDLDisplayPortlet_INSTANCE_BwnGmKfBS86n"

SRC = Source(
    slug="asl-napoli-3-sud",
    label="ASL Napoli 3 Sud - Concorsi",
    owner="Azienda Sanitaria Locale Napoli 3 Sud",
    owner_short="ASL Napoli 3 Sud",
    region="Campania",
    city="Torre del Greco",
    portal="ASL Napoli 3 Sud, Concorsi",
)

_CACHE: dict = {}
_ROW_RE = re.compile(
    r'<tr data-record-id="(\d+)"[^>]*>\s*<td data-label="Titolo">(.*?)</td>\s*<td data-label="Data">\s*(.*?)\s*</td>\s*'
    r'<td data-label="Data Scadenza">\s*(.*?)\s*</td>', re.S)
# Fase do procedimento escrita no titulo: ja nao e um bando aberto a candidaturas.
_STAGE_RE = re.compile(
    r"\b(?:esit[oi]|risultati|convocazion\w*|ammess\w*|esclus\w*|candidati|candidato|sorteggio|diario|calendario|rettifica|sospensione|"
    r"revoca|proroga|nomina|verbale|idone[oi]|vincitor\w*|scorrimento|graduatori[ae])\b",
    re.I,
)


def record_url(record_id: str) -> str:
    p = f"{_INSTANCE}"
    return (
        f"{LIST_URL}?p_p_id={p}&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view"
        f"&_{p}_mvcPath=/view_record.jsp&_{p}_recordId={record_id}&_{p}_version=1.0"
    )


def _clean(title: str) -> str:
    """Erros de escrita frequentes nos titulos da ASL e disciplina colada a «Area medica...»."""
    title = re.sub(r"\bdirigemte\b", "dirigente", title, flags=re.I)
    title = re.sub(r"\bdirig\.?\s*medic[oi]\b", "dirigente medico", title, flags=re.I)
    title = re.sub(r"\s*[-–]\s*(?=area\b)", " – ", title, flags=re.I)
    return title.replace("SPECIALITA'", "SPECIALITÀ").replace("Specialita'", "Specialità").replace("SANITA'", "SANITÀ").strip()


def parse_rows(html: str) -> list[Item]:
    rows = _ROW_RE.findall(html)
    if "tableBody" not in html or not rows:
        raise RuntimeError("asl-napoli-3-sud: tabela de concursos não reconhecida (estrutura mudou?)")
    items: list[Item] = []
    for rid, title_html, date_txt, scad_txt in rows:
        title = _clean(text_of(title_html))
        items.append(Item(ident=rid, title=title, url=record_url(rid), deadline=parse_dmy(scad_txt), published=parse_dmy(date_txt)))
    return items


def list_items(client: HttpClient, now: datetime) -> list[Item]:
    return parse_rows(get_retry(client, LIST_URL))


def _filter(items: list[Item], stats: dict) -> list[Item]:
    out = []
    for it in items:
        if _STAGE_RE.search(it.title) and not P.is_graduatoria_act(it.title):
            stats["stage"] = stats.get("stage", 0) + 1
            continue
        if P.is_graduatoria_act(it.title):
            it.deadline = None  # a «scadenza» da graduatoria é só um prazo de afixação
        out.append(it)
    return out


def collect_calls(client: HttpClient, now: datetime | None = None, stats: dict | None = None, with_detail: bool = True) -> list[P.Call]:
    stats = stats if stats is not None else {}
    if "list" not in _CACHE:
        _CACHE["list"] = _filter(list_items(client, now or datetime.now()), stats)
    return collect(SRC, _CACHE, list_items, None, client, now, stats, with_detail)


def priority_keys(client: HttpClient, now: datetime | None = None) -> list:
    return [c.key for c in collect_calls(client, now=now, with_detail=False)]


class AslNapoli3SudScraper(RegionalScraper):
    slug = SRC.slug
    name = SRC.label
    module = __import__(__name__, fromlist=["x"])
