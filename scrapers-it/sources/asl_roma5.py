"""Lazio: ASL Roma 5 — «Bandi di concorso» (WordPress; tipo de conteúdo `bandi_di_concorso`).

Lista = sitemap do Yoast (https://www.aslroma5.it/bandi_di_concorso-sitemap.xml, robots: `Disallow:` vazio) com `lastmod`;
cada bando tem página própria com «Scadenza Bando: dd/mm/yyyy», a data de publicação e os anexos. Só se abre a página
dos bandos modificados nos últimos 100 dias (os antigos já fecharam), 1 pedido por segundo e meio.
Graduatorie: se o título começar por «Graduatoria» entra como tipo graduatoria (só título, ente, data e link).
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta

from common.http import HttpClient

from . import _it_pub as P
from ._it_regional import Item, RegionalScraper, Source, collect, get_retry, parse_dmy, text_of

BASE = "https://www.aslroma5.it"
SITEMAP = BASE + "/bandi_di_concorso-sitemap.xml"
LASTMOD_DAYS = 100
MAX_DETAILS = 60

SRC = Source(
    slug="asl-roma-5",
    label="ASL Roma 5 - Bandi di concorso",
    owner="Azienda Sanitaria Locale Roma 5",
    owner_short="ASL Roma 5",
    region="Lazio",
    city="Tivoli",
    portal="ASL Roma 5, Bandi di concorso",
)

_CACHE: dict = {}
_URL_RE = re.compile(r"<url>\s*<loc>([^<]+)</loc>\s*(?:<lastmod>([^<]+)</lastmod>)?", re.S)
_MONTHS = {"gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4, "maggio": 5, "giugno": 6, "luglio": 7, "agosto": 8, "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12}
_LONG_DATE_RE = re.compile(r"(\d{1,2})\s+(" + "|".join(_MONTHS) + r")\s+(\d{4})", re.I)


def parse_sitemap(xml: str) -> list[tuple[str, str]]:
    return [(m.group(1).strip(), (m.group(2) or "")[:10]) for m in _URL_RE.finditer(xml) if "/bandi_di_concorso/" in m.group(1)]


def parse_detail(html: str, url: str) -> Item | None:
    body = re.sub(r"(?s)<(script|style|noscript)[^>]*>.*?</\1>", "", html)
    t = re.search(r"<title>(.*?)</title>", body, re.S)
    title = text_of(t.group(1)) if t else ""
    title = re.sub(r"\s*[-–|]\s*ASL\s*ROMA\s*5\s*$", "", title, flags=re.I).strip()
    if not title:
        return None
    text = text_of(re.sub(r"<a [^>]*>", "<a>", body))
    m = re.search(r"scadenza\s+bando\s*:?\s*(\d{1,2}\s*[./]\s*\d{1,2}\s*[./]\s*\d{4})", text, re.I)
    deadline = parse_dmy(m.group(1)) if m else None
    published = None
    # «Data di modifica: 6 Novembre 2026   5 Ottobre 2026»: a 2.ª data é a publicação (a 1.ª, a modificação)
    dates = []
    for dm in _LONG_DATE_RE.finditer(text[:3000]):
        dates.append(P.parse_it_date(dm.group(0)))
    dates = [d for d in dates if d]
    if len(dates) >= 2:
        published = dates[1]
    elif dates:
        published = dates[0]
    docs = []
    for h, label in re.findall(r'<a[^>]+href="([^"]+/wp-content/uploads/[^"]+)"[^>]*>(.*?)</a>', body, re.S):
        entry = (text_of(label)[:90] or "Allegato", h)
        if entry not in docs:
            docs.append(entry)
    slug = url.rstrip("/").rsplit("/", 1)[-1]
    return Item(ident=slug[:80], title=title, url=url, deadline=deadline, published=published, docs=docs[:8])


def list_items(client: HttpClient, now: datetime) -> list[Item]:
    entries = parse_sitemap(get_retry(client, SITEMAP))
    if not entries:
        raise RuntimeError("asl-roma-5: sitemap sem bandos (estrutura mudou?)")
    horizon = (now - timedelta(days=LASTMOD_DAYS)).strftime("%Y-%m-%d")
    recent = sorted((e for e in entries if e[1] >= horizon), key=lambda e: e[1], reverse=True)[:MAX_DETAILS]
    items: list[Item] = []
    for url, _ in recent:
        item = parse_detail(get_retry(client, url), url)
        if item:
            items.append(item)
    if recent and not items:
        raise RuntimeError("asl-roma-5: páginas de bando não reconhecidas (estrutura mudou?)")
    return items


def collect_calls(client: HttpClient, now: datetime | None = None, stats: dict | None = None, with_detail: bool = True) -> list[P.Call]:
    return collect(SRC, _CACHE, list_items, None, client, now, stats, with_detail)


def priority_keys(client: HttpClient, now: datetime | None = None) -> list:
    return [c.key for c in collect_calls(client, now=now, with_detail=False)]


class AslRoma5Scraper(RegionalScraper):
    slug = SRC.slug
    name = SRC.label
    module = __import__(__name__, fromlist=["x"])
