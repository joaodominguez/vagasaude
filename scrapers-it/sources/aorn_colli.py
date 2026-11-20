"""Campania: AORN Ospedali dei Colli (Monaldi, Cotugno, CTO) — «Concorsi» (WordPress, tipo `borsa`).

https://www.ospedalideicolli.it/concorsi : uma página com os cartões `bando-box-template`: título (h3 com ligação /borsa/<slug>/),
«Pubblicato il: dd/mm/yyyy», anexos e «scade il dd/mm/yyyy alle ore hh:mm» (só os abertos têm scadenza). robots.txt só proíbe
/wp-admin, /pubblicazioni e XML de transparência. A página é grande (~1,5 MB): 1 pedido por execução.
Exclui docências/tutor clínicos universitários (filtro comum) e graduatorie sem data recente.
"""
from __future__ import annotations

import re
from datetime import datetime

from common.http import HttpClient

from . import _it_pub as P
from ._it_regional import Item, RegionalScraper, Source, collect, get_retry, parse_dmy, text_of

BASE = "https://www.ospedalideicolli.it"
LIST_URL = BASE + "/concorsi"

SRC = Source(
    slug="aorn-colli",
    label="AORN Ospedali dei Colli - Concorsi",
    owner="Azienda Ospedaliera dei Colli",
    owner_short="AORN dei Colli",
    region="Campania",
    city="Napoli",
    portal="AORN Ospedali dei Colli, Concorsi",
)

_CACHE: dict = {}


def _clean(title: str) -> str:
    title = re.sub(r"\bDir\.?\s*Med\.?", "Dirigente Medico", title, flags=re.I)
    title = re.sub(r"\bDir\.?\s*Veterinari[oa]\b", "Dirigente Veterinario", title, flags=re.I)
    return re.sub(r"\bT\.I\.", "tempo indeterminato", title).strip()


def parse_cards(html: str) -> list[Item]:
    if "bando-box-template" not in html:
        raise RuntimeError("aorn-colli: cartões de concurso não reconhecidos (estrutura mudou?)")
    items: list[Item] = []
    for card in html.split('<div class="box-template bando-box-template">')[1:]:
        a = re.search(r'<a href="([^"]+/borsa/[^"]+)"[^>]*class="permalink-bandi">\s*<h3>(.*?)</h3>', card, re.S)
        if not a:
            continue
        url, title = a.group(1), _clean(text_of(a.group(2)))
        pub = re.search(r"Pubblicato il:\s*(\d{1,2}/\d{1,2}/\d{4})", card)
        exp = re.search(r"scade\s+il\s+(\d{1,2}/\d{1,2}/\d{4})", card)
        docs = [(text_of(n)[:90] or "Allegato", h) for h, n in re.findall(r'<a href="([^"]+/wp-content/uploads/[^"]+)">(.*?)</a>', card, re.S)]
        items.append(Item(
            ident=url.rstrip("/").rsplit("/", 1)[-1][:80], title=title, url=url,
            deadline=parse_dmy(exp.group(1)) if exp else None, published=parse_dmy(pub.group(1)) if pub else None, docs=docs[:6],
        ))
    return items


def list_items(client: HttpClient, now: datetime) -> list[Item]:
    return parse_cards(get_retry(client, LIST_URL))


def collect_calls(client: HttpClient, now: datetime | None = None, stats: dict | None = None, with_detail: bool = True) -> list[P.Call]:
    return collect(SRC, _CACHE, list_items, None, client, now, stats, with_detail)


def priority_keys(client: HttpClient, now: datetime | None = None) -> list:
    return [c.key for c in collect_calls(client, now=now, with_detail=False)]


class AornColliScraper(RegionalScraper):
    slug = SRC.slug
    name = SRC.label
    module = __import__(__name__, fromlist=["x"])
