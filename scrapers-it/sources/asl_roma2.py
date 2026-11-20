"""Lazio: ASL Roma 2 — «Concorsi» (https://www.aslroma2.it/external/concorsi/, PHP legado).

Tabela HTML paginada (20 páginas, mais recente primeiro; a paginação é um formulário POST normal do próprio site). Colunas:
inserimento/ultima modifica, oggetto (título + delibera/BURL/GU), documenti (`allegato.php?id=N`), scadenza («Ore 23:59 del
dd/mm/yyyy») e stato («In Corso»...). robots.txt só proíbe pastas técnicas do Joomla (/administrator, /cache...).
Só lemos as primeiras páginas enquanto houver bandos «In Corso». O link oficial é o primeiro anexo (bando/delibera).
"""
from __future__ import annotations

import re
from datetime import datetime
from urllib.parse import urljoin

from common.http import HttpClient

from . import _it_pub as P
from ._it_regional import Item, RegionalScraper, Source, collect, get_retry, gu_deadline, parse_dmy, text_of

BASE = "https://www.aslroma2.it"
LIST_URL = BASE + "/external/concorsi/"
FORM_URL = BASE + "/external/concorsi/index.php"
MAX_PAGES = 5

SRC = Source(
    slug="asl-roma-2",
    label="ASL Roma 2 - Concorsi",
    owner="Azienda Sanitaria Locale Roma 2",
    owner_short="ASL Roma 2",
    region="Lazio",
    city="Roma",
    portal="ASL Roma 2, Concorsi",
)

_CACHE: dict = {}
_ROW_RE = re.compile(r"<tr onMouseover=.*?(?=<tr onMouseover=|</table>\s*(?:</div>)?\s*$|$)", re.S)
_TD_RE = re.compile(r"<td\b[^>]*>(.*?)</td>\s*(?=<td\b|</tr>|<tr\b|$)", re.S)


def parse_page(html: str) -> list[tuple[Item, bool]]:
    """[(item, in_corso)] da uma página da tabela. Levanta erro se a tabela não existir."""
    if 'class="elenco"' not in html:
        raise RuntimeError("asl-roma-2: tabela de concursos não reconhecida (estrutura mudou?)")
    out: list[tuple[Item, bool]] = []
    for row in re.split(r"(?=<tr onMouseover=)", html)[1:]:
        cells = re.findall(r"<td\b[^>]*>(.*?)</td>", row, re.S)
        if len(cells) < 4:
            continue
        # cells[0]=inserimento, [1]=oggetto, [2]=documenti (contém tabela interna: ver abaixo), restantes
        meta = text_of(cells[0])
        published = parse_dmy(meta)
        oggetto = cells[1]
        paras = [text_of(p) for p in re.findall(r"<p\b[^>]*>(.*?)</p>", oggetto, re.S)]
        paras = [p for p in paras if p and p.replace("\xa0", "").strip()]
        title = paras[0] if paras else text_of(oggetto)
        docs = [(text_of(n)[:90] or "Allegato", urljoin(LIST_URL, h)) for h, n in re.findall(r"<a href='([^']+)'[^>]*>(.*?)</a>", row, re.S)]
        deadline = None
        for c in cells:
            if re.search(r"Ore\s+[\d:.]+\s+del", c):
                deadline = parse_dmy(text_of(c))
        in_corso = bool(re.search(r"title='In Corso'", row))
        ident_m = re.search(r"allegato\.php\?id=(\d+)", row)
        ident = ident_m.group(1) if ident_m else re.sub(r"\W+", "-", title.lower())[:40]
        if deadline is None:
            deadline = gu_deadline(" ".join(paras[1:]), *[n for n, _ in docs])
        item = Item(
            ident=ident, title=title, url=docs[0][1] if docs else LIST_URL, deadline=deadline, published=published,
            extra=[p for p in paras[1:4] if len(p) < 140], docs=docs[:6],
        )
        out.append((item, in_corso))
    return out


def list_items(client: HttpClient, now: datetime) -> list[Item]:
    items: list[Item] = []
    for page in range(1, MAX_PAGES + 1):
        html = get_retry(client, LIST_URL) if page == 1 else get_retry(client, FORM_URL, post={"Q": "", "NOM": "", "P": str(page), "BO": ">"})
        rows = parse_page(html)
        if page == 1 and not rows:
            raise RuntimeError("asl-roma-2: 0 linhas na primeira página (estrutura mudou?)")
        items.extend(i for i, _ in rows)
        if not any(open_ for _, open_ in rows):
            break
    return items


def collect_calls(client: HttpClient, now: datetime | None = None, stats: dict | None = None, with_detail: bool = True) -> list[P.Call]:
    return collect(SRC, _CACHE, list_items, None, client, now, stats, with_detail)


def priority_keys(client: HttpClient, now: datetime | None = None) -> list:
    return [c.key for c in collect_calls(client, now=now, with_detail=False)]


class AslRoma2Scraper(RegionalScraper):
    slug = SRC.slug
    name = SRC.label
    module = __import__(__name__, fromlist=["x"])
