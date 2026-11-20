"""Lazio: ASL Roma 3 — «Concorsi e Avvisi» (WordPress/Elementor, tipo de conteúdo `comunicato`).

https://www.aslroma3.it/concorsi-e-avvisi/ . A lista é um widget Elementor; o mesmo conteúdo está na API REST pública do
WordPress (`/wp-json/wp/v2/comunicato`, JSON). robots.txt: `Disallow:` vazio (tudo permitido, wp-json incluído).
O prazo está no corpo: «Invio domande dal 19.11.2026 al 28.11.2026 ore 23:59» ou, nos concursos, 30 dias depois do extracto
na Gazzetta Ufficiale («GURI 71 del 15.09.2026»). Sem nenhum dos dois só se aceita se publicado há <= 45 dias.
Avvisos internos (específicos ambulatoriais, selezione interna) são excluídos pelo filtro comum.
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta, timezone
from html import unescape

from common.http import HttpClient

from . import _it_pub as P
from ._it_regional import Item, RegionalScraper, Source, all_dmy, collect, get_retry, gu_deadline, parse_dmy, text_of

BASE = "https://www.aslroma3.it"
API = BASE + "/wp-json/wp/v2/comunicato?per_page=100&_fields=id,date,title,link,content"
LIST_PAGE = BASE + "/concorsi-e-avvisi/"
MAX_AGE_DAYS = 150

SRC = Source(
    slug="asl-roma-3",
    label="ASL Roma 3 - Concorsi e Avvisi",
    owner="Azienda Sanitaria Locale Roma 3",
    owner_short="ASL Roma 3",
    region="Lazio",
    city="Roma",
    portal="ASL Roma 3, Concorsi e Avvisi",
)

_CACHE: dict = {}
_SEND_RE = re.compile(r"invio\s+domande\s+dal\s+(\d{1,2}[./]\d{1,2}[./]\d{4})\s+al\s+(\d{1,2}[./]\d{1,2}[./]\d{4})", re.I)
_SCAD_RE = re.compile(r"scadenza[^0-9]{0,60}(\d{1,2}\s*[./]\s*\d{1,2}\s*[./]\s*\d{4})", re.I)


def _body(rendered: str) -> tuple[str, list[tuple[str, str]]]:
    rendered = re.sub(r"(?s)<style.*?</style>", "", rendered or "")
    docs = [(text_of(t)[:90] or "Allegato", h) for h, t in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', rendered, re.S)]
    return text_of(rendered), docs


def parse_posts(data: list[dict]) -> list[Item]:
    items: list[Item] = []
    for post in data:
        title = text_of(post.get("title", {}).get("rendered", ""))
        raw_date = (post.get("date") or "")[:10]
        try:
            published = date.fromisoformat(raw_date)
        except ValueError:
            published = None
        body, docs = _body(post.get("content", {}).get("rendered", ""))
        deadline = None
        m = _SEND_RE.search(body)
        if m:
            deadline = parse_dmy(m.group(2))
        if deadline is None:
            m = _SCAD_RE.search(body)
            deadline = parse_dmy(m.group(1)) if m else None
        if deadline is None:
            deadline = gu_deadline(body, *[n for n, _ in docs])
        items.append(Item(ident=str(post.get("id")), title=title, url=post.get("link") or LIST_PAGE, deadline=deadline, published=published, docs=docs[:8]))
    return items


def list_items(client: HttpClient, now: datetime) -> list[Item]:
    text = get_retry(client, API)
    try:
        data = json.loads(text)
    except ValueError as exc:
        raise RuntimeError("asl-roma-3: resposta da API não é JSON (estrutura mudou ou bloqueio?)") from exc
    if not isinstance(data, list) or not data:
        raise RuntimeError("asl-roma-3: lista vazia na API (estrutura mudou?)")
    horizon = (now - timedelta(days=MAX_AGE_DAYS)).date()
    return [i for i in parse_posts(data) if i.published is None or i.published >= horizon]


def collect_calls(client: HttpClient, now: datetime | None = None, stats: dict | None = None, with_detail: bool = True) -> list[P.Call]:
    return collect(SRC, _CACHE, list_items, None, client, now, stats, with_detail)


def priority_keys(client: HttpClient, now: datetime | None = None) -> list:
    return [c.key for c in collect_calls(client, now=now, with_detail=False)]


class AslRoma3Scraper(RegionalScraper):
    slug = SRC.slug
    name = SRC.label
    module = __import__(__name__, fromlist=["x"])
