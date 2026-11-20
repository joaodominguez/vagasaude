"""Friuli-Venezia Giulia: ARCS (Azienda Regionale di Coordinamento per la Salute) — «Concorsi e avvisi».

https://arcs.sanita.fvg.it/professionisti-e-fornitori/concorsi-avvisi-incarichi/concorsi-e-avvisi (Drupal, HTML).
L'elenco predefinito mostra i bandi con stato «Aperto» (pochi: ~4); robots.txt non vieta queste pagine. Ogni voce ha
tipologia, data di inizio e di fine; il dettaglio ha la descrizione e gli allegati. La domanda si fa su un portale
con credenziali (ISON): qui si pubblica solo l'avviso e si rimanda al bando ufficiale (nessun accesso al portale).
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from html import unescape
from urllib.parse import urljoin

from common.http import HttpClient
from common.models import BaseScraper, JobPayload

from . import _it_pub as P
from ._it_regional import Item, Source, build_call

BASE = "https://arcs.sanita.fvg.it"
LIST_URL = BASE + "/professionisti-e-fornitori/concorsi-avvisi-incarichi/concorsi-e-avvisi"

SRC = Source(
    slug="arcs-fvg",
    label="ARCS Friuli-Venezia Giulia - Concorsi e avvisi",
    owner="ARCS - Azienda Regionale di Coordinamento per la Salute (FVG)",
    owner_short="ARCS FVG",
    region="Friuli-Venezia Giulia",
    city="Udine",
    portal="ARCS Friuli-Venezia Giulia, concorsi e avvisi",
)


def _text(fragment: str) -> str:
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def parse_list(html: str) -> list[Item]:
    items: list[Item] = []
    i = html.find("Risultati")
    seg = html[i:] if i >= 0 else html
    for m in re.finditer(r'<a[^>]+href="(/it/professionisti-e-fornitori/concorsi-avvisi-incarichi/[^"?#]+-\d+)"[^>]*>(.*?)</a>', seg, re.S):
        url = urljoin(BASE, m.group(1))
        if any(x.url == url for x in items):
            continue
        title = _text(m.group(2))
        block = seg[m.end(): m.end() + 1500]
        nxt = re.search(r'/it/professionisti-e-fornitori/concorsi-avvisi-incarichi/[^"?#]+-\d+', block)
        if nxt:
            block = block[: nxt.start()]
        txt = _text(block)
        kind = re.match(r"\s*(.*?)\s+Data inizio", txt)
        start = re.search(r"Data inizio\s+(\d{1,2}/\d{1,2}/\d{4})", txt)
        end = re.search(r"Data fine\s+(\d{1,2}/\d{1,2}/\d{4})", txt)
        items.append(
            Item(
                ident=m.group(1).rsplit("/", 1)[-1],
                title=title,
                url=url,
                deadline=P.parse_it_date(end.group(1)) if end else None,
                published=P.parse_it_date(start.group(1)) if start else None,
                section=kind.group(1) if kind else "",
            )
        )
    return items


def parse_detail(html: str) -> tuple[str, list[tuple[str, str]]]:
    """(descrizione, allegati) dalla pagina del bando."""
    m = re.search(r"<h[23][^>]*>\s*Descrizione\s*</h[23]>(.*?)(?:<h[23][^>]*>\s*Contatti|<h[23][^>]*>\s*Allegati)", html, re.S)
    body = _text(m.group(1)) if m else ""
    docs: list[tuple[str, str]] = []
    for a in re.finditer(r'<a[^>]+href="([^"]+\.(?:pdf|p7m))"[^>]*>(.*?)</a>', html, re.S | re.I):
        name = _text(a.group(2)) or "Allegato"
        entry = (name[:90], urljoin(BASE, a.group(1)))
        if entry not in docs:
            docs.append(entry)
    return body, docs


_LIST_CACHE: dict[str, list[Item]] = {}


def collect_calls(client: HttpClient, now: datetime | None = None, stats: dict | None = None, with_detail: bool = True) -> list[P.Call]:
    now = now or datetime.now(timezone.utc)
    stats = stats if stats is not None else {}
    if "list" not in _LIST_CACHE:
        html = client.get_text(LIST_URL)
        if "concorsi-avvisi-incarichi" not in html or "Risultati" not in html:
            raise RuntimeError("arcs-fvg: elenco non riconosciuto (struttura della pagina cambiata?)")
        _LIST_CACHE["list"] = parse_list(html)
    items = _LIST_CACHE["list"]
    stats["listed"] = len(items)
    calls: list[P.Call] = []
    for item in items:
        probe = build_call(item, SRC, now, {} if with_detail else stats, with_detail=False)
        if probe is None:
            if with_detail:
                build_call(item, SRC, now, stats, with_detail=False)
            continue
        if not with_detail:
            calls.append(probe)
            continue
        try:
            item.body, item.docs = parse_detail(client.get_text(item.url))
        except Exception:  # noqa: BLE001
            stats["errors"] = stats.get("errors", 0) + 1
            continue
        call = build_call(item, SRC, now, stats, with_detail=True)
        if call:
            calls.append(call)
    return calls


def priority_keys(client: HttpClient, now: datetime | None = None) -> list:
    return [c.key for c in collect_calls(client, now=now, with_detail=False)]


class ArcsFvgScraper(BaseScraper):
    slug = SRC.slug
    name = SRC.label
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        _LIST_CACHE.clear()
        client = HttpClient(min_interval=1.1)
        try:
            calls = collect_calls(client, stats=self.stats)
        finally:
            client.close()
        jobs = P.dedupe_titles([c.job for c in calls])
        self.stats["published"] = len(jobs)
        self.last_listings_complete = not self.stats.get("errors")
        return jobs
