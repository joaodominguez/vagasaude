"""Toscana: ESTAR (Ente di supporto tecnico-amministrativo regionale) — concorsi e selezioni unificati.

https://www.estar.toscana.it/index.php/concorsi/ (+ /selezioni-a-tempo-determinato/ e /strutture-complesse-e-altri-incarichi-aziendali/,
stesse sezioni «Bandi aperti» del menu). WordPress/Elementor, HTML; robots.txt vieta solo /wp-admin/, /wp-includes/, /wp-content/.
Gli elenchi mostrano SOLO bandi aperti (categoria bandi-aperti-concorsi); la scadenza sta nel titolo
(«... - Scadenza ore 12.00 del 3/12/2026»); il dettaglio ha l'allegato (delibera/bando in PDF, non si scarica).
L'ente che assume (AOU Careggi, Azienda USL Toscana Sud Est, ...) e' nel titolo; senza ente chiaro, ESTAR.
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

BASE = "https://www.estar.toscana.it"
LIST_PAGES = (
    BASE + "/index.php/concorsi/",
    BASE + "/index.php/selezioni-a-tempo-determinato/",
    BASE + "/index.php/strutture-complesse-e-altri-incarichi-aziendali/",
)

SRC = Source(
    slug="estar-toscana",
    label="ESTAR Toscana - Concorsi e selezioni",
    owner="ESTAR - Ente di supporto tecnico-amministrativo regionale (Toscana)",
    owner_short="ESTAR Toscana",
    region="Toscana",
    city="Firenze",
    portal="ESTAR Toscana, bandi aperti (concorsi e selezioni unificati delle aziende sanitarie toscane)",
)

# (regex sul titolo, nome ufficiale dell'ente, citta')
_ENTES = (
    (re.compile(r"\bAOU\s+Careggi|Azienda Ospedaliero[- ]Universitaria Careggi", re.I), "Azienda Ospedaliero-Universitaria Careggi", "Firenze"),
    (re.compile(r"\bAOU\s+Meyer|\bMeyer\b", re.I), "Azienda Ospedaliero-Universitaria Meyer", "Firenze"),
    (re.compile(r"\bAOU\s+Pisana|Azienda Ospedaliero[- ]Universitaria Pisana", re.I), "Azienda Ospedaliero-Universitaria Pisana", "Pisa"),
    (re.compile(r"\bAOU\s+Senese|Azienda Ospedaliero[- ]Universitaria Senese", re.I), "Azienda Ospedaliero-Universitaria Senese", "Siena"),
    (re.compile(r"Usl\s+Toscana\s+Sud\s*Est|\bUSL\s+Toscana\s+Sud\s*Est", re.I), "Azienda USL Toscana Sud Est", "Siena"),
    (re.compile(r"Usl\s+Toscana\s+Nord\s*Ovest", re.I), "Azienda USL Toscana Nord Ovest", "Pisa"),
    (re.compile(r"Usl\s+Toscana\s+Centro", re.I), "Azienda USL Toscana Centro", "Firenze"),
)

_DEADLINE_RE = re.compile(r"del\s+(\d{1,2}/\d{1,2}/\d{4})\s*$")
_ART_RE = re.compile(r'<article class="elementor-post[^"]*"(.*?)</article>', re.S)
_LINK_RE = re.compile(r'<a href="([^"]+)"[^>]*>\s*(.*?)\s*</a>', re.S)
_DATE_RE = re.compile(r'elementor-post-date">\s*(.*?)\s*</span>', re.S)


def _text(fragment: str) -> str:
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def ente_from_title(title: str) -> tuple[str | None, str | None]:
    for rx, name, city in _ENTES:
        if rx.search(title):
            return name, city
    return None, None


def parse_list(html: str, section: str = "") -> list[Item]:
    items: list[Item] = []
    for art in _ART_RE.findall(html):
        link = _LINK_RE.search(art)
        if not link:
            continue
        url, title = link.group(1), _text(link.group(2))
        dm = _DEADLINE_RE.search(title)
        deadline = P.parse_it_date(dm.group(1)) if dm else None
        published = P.parse_it_date(_text(_DATE_RE.search(art).group(1))) if _DATE_RE.search(art) else None
        # «104/2026/ST STABILIZZAZIONE ...»: il codice ESTAR e' l'identificativo; si toglie dal titolo.
        code = re.match(r"^(\d{1,3}/\d{4}/[A-Z]+(?:\s+START\s+SMART)?)\s+", title)
        clean = title[code.end():] if code else title
        clean = re.sub(r"\s*[-–—]\s*Scadenza ore [\d.:]+ del \d{1,2}/\d{1,2}/\d{4}\s*$", "", clean).strip()
        clean = clean.replace("“", "").replace("”", "").replace('"', "")
        ente, city = ente_from_title(clean)
        items.append(
            Item(
                ident=url.rstrip("/").rsplit("/", 1)[-1],
                title=clean,
                url=url,
                deadline=deadline,
                published=published,
                entes=[ente] if ente else [],
                section=section,
                city=city,
                extra=[f"Codice ESTAR: {code.group(1).strip()}"] if code else [],
            )
        )
    return items


def parse_detail_docs(html: str) -> list[tuple[str, str]]:
    docs: list[tuple[str, str]] = []
    for m in re.finditer(r'<a[^>]+href="([^"]+/wp-content/uploads/[^"]+\.pdf)"[^>]*>(.*?)</a>', html, re.S | re.I):
        name = _text(m.group(2)) or "Allegato"
        entry = (name[:90], m.group(1))
        if entry not in docs:
            docs.append(entry)
    return docs


_LIST_CACHE: dict[str, list[Item]] = {}


def list_items(client: HttpClient) -> list[Item]:
    items: list[Item] = []
    seen: set[str] = set()
    for i, url in enumerate(LIST_PAGES):
        try:
            html = client.get_text(url)
        except Exception:  # noqa: BLE001  (le sezioni secondarie non bloccano la principale)
            if i == 0:
                raise
            continue
        if i == 0 and "elementor-post" not in html:
            raise RuntimeError("estar-toscana: elenco non riconosciuto (struttura della pagina cambiata?)")
        section = ("concorso" if i == 0 else "selezione a tempo determinato" if i == 1 else "incarico struttura complessa")
        for it in parse_list(html, section):
            if it.ident not in seen:
                seen.add(it.ident)
                items.append(it)
    return items


def collect_calls(client: HttpClient, now: datetime | None = None, stats: dict | None = None, with_detail: bool = True) -> list[P.Call]:
    now = now or datetime.now(timezone.utc)
    stats = stats if stats is not None else {}
    if "list" not in _LIST_CACHE:
        _LIST_CACHE["list"] = list_items(client)
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
            item.docs = parse_detail_docs(client.get_text(item.url))
        except Exception:  # noqa: BLE001
            stats["errors"] = stats.get("errors", 0) + 1
            continue
        call = build_call(item, SRC, now, stats, with_detail=True)
        if call:
            calls.append(call)
    return calls


def priority_keys(client: HttpClient, now: datetime | None = None) -> list:
    return [c.key for c in collect_calls(client, now=now, with_detail=False)]


class EstarToscanaScraper(BaseScraper):
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
