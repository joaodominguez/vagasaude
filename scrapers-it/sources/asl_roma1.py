"""Lazio: ASL Roma 1 — «Concorsi e Avvisi» (https://www.aslroma1.it/concorsi-e-avvisi).

Uma única página HTML (Symfony) com a lista inteira em texto livre, do mais recente para o mais antigo (desde 2016):
`<p><strong>Título</strong></p>`, ligações a PDF («Avviso», «Domanda», «Bando BURL»...), «Scadenza il dd/mm/yyyy»,
«Pubblicato il dd/mm/yyyy». Não há URL por item (o link oficial é o primeiro PDF, ou a própria página).
robots.txt: 404 (nada proibido). Só lemos itens abertos (scadenza futura) e graduatorie dos últimos 12 meses.
Se a página mudar de estrutura (0 títulos reconhecidos) levanta erro, para o scraper_health avisar.
"""
from __future__ import annotations

import hashlib
import re
from datetime import datetime, timedelta, timezone
from html import unescape
from urllib.parse import urljoin

from common.http import HttpClient

from . import _it_pub as P
from ._it_regional import Item, RegionalScraper, Source, collect, get_retry, gu_deadline, parse_dmy, text_of

BASE = "https://www.aslroma1.it"
LIST_URL = BASE + "/concorsi-e-avvisi"

SRC = Source(
    slug="asl-roma-1",
    label="ASL Roma 1 - Concorsi e Avvisi",
    owner="Azienda Sanitaria Locale Roma 1",
    owner_short="ASL Roma 1",
    region="Lazio",
    city="Roma",
    portal="ASL Roma 1, Albo Pretorio - Concorsi e Avvisi",
)

_CACHE: dict = {}
_P_RE = re.compile(r"<p\b[^>]*>(.*?)</p>", re.S | re.I)
_A_RE = re.compile(r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', re.S | re.I)
_STRONG_RE = re.compile(r"<(?:strong|b)\b[^>]*>(.*?)</(?:strong|b)>", re.S | re.I)
_DEADLINE_RE = re.compile(r"scadenza\s*[:\-]?\s*(?:il\s+|del\s+)?(?:ore\s+[\d.:]+\s+del\s+)?(\d{1,2}\s*[./]\s*\d{1,2}\s*[./]\s*\d{4})", re.I)
_PUBLISHED_RE = re.compile(r"\(?\s*pubblicat[oa]\s*(?:il\s+)?(\d{1,2}\s*[./]\s*\d{1,2}\s*[./]\s*\d{4})", re.I)


def _ident(title: str) -> str:
    return hashlib.sha1(re.sub(r"\W+", " ", title.lower()).strip().encode()).hexdigest()[:12]


def parse_list(html: str) -> list[Item]:
    start = html.find('<div class="intern-text">')
    if start < 0:
        raise RuntimeError("asl-roma-1: lista não reconhecida (estrutura da página mudou?)")
    end = html.find("intern-content", start + 30)
    seg = html[start: end if end > 0 else len(html)]
    items: list[Item] = []
    cur: Item | None = None
    for raw in _P_RE.findall(seg):
        txt = text_of(raw)
        if not txt:
            continue
        links = [(text_of(t), urljoin(BASE + "/", h.strip())) for h, t in ((m.group(1), m.group(2)) for m in _A_RE.finditer(raw))]
        strong = _STRONG_RE.search(raw)
        strong_txt = text_of(strong.group(1)) if strong else ""
        is_title = bool(strong_txt) and len(strong_txt) >= 25 and not _DEADLINE_RE.search(strong_txt) and not links
        if is_title and re.match(r"(?i)(avviso|concors|selezion|manifestazion|graduatori|mobilit|bando|procedura|pubblica|incarico|riapertura|proroga|rettifica|convocazion)", strong_txt):
            cur = Item(ident=_ident(strong_txt), title=strong_txt, url=LIST_URL, deadline=None)
            items.append(cur)
            continue
        if cur is None:
            continue
        if links and not strong_txt:
            for name, url in links:
                if name:
                    cur.docs.append((name[:90], url))
            continue
        m = _DEADLINE_RE.search(txt)
        if m and cur.deadline is None:
            cur.deadline = parse_dmy(m.group(1))
        m = _PUBLISHED_RE.search(txt)
        if m and cur.published is None:
            cur.published = parse_dmy(m.group(1))
    for it in items:
        if it.docs:
            it.url = it.docs[0][1]
        if it.deadline is None:
            it.deadline = gu_deadline(*[name for name, _ in it.docs])
    return items


def list_items(client: HttpClient, now: datetime) -> list[Item]:
    items = parse_list(get_retry(client, LIST_URL))
    if not items:
        raise RuntimeError("asl-roma-1: 0 títulos reconhecidos na lista (estrutura da página mudou?)")
    # Só o que ainda interessa: abertos, ou graduatorie dos últimos 12 meses (a página guarda 10 anos de histórico).
    horizon = (now - timedelta(days=370)).date()
    return [i for i in items if (i.deadline and i.deadline >= now.date()) or (i.published and i.published >= horizon)]


def collect_calls(client: HttpClient, now: datetime | None = None, stats: dict | None = None, with_detail: bool = True) -> list[P.Call]:
    return collect(SRC, _CACHE, list_items, None, client, now, stats, with_detail)


def priority_keys(client: HttpClient, now: datetime | None = None) -> list:
    return [c.key for c in collect_calls(client, now=now, with_detail=False)]


class AslRoma1Scraper(RegionalScraper):
    slug = SRC.slug
    name = SRC.label
    module = __import__(__name__, fromlist=["x"])
