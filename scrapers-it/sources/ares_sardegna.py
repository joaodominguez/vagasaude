"""Sardegna: ARES (Azienda Regionale della Salute) — «Bandi di concorso e selezione» (Albo Pretorio).

https://www.aressardegna.it/albo-pretorio/bandi-di-concorso-e-selezione/ (WordPress, HTML paginato /page/N/).
Non si usa /wp-json/. robots.txt vuoto (tutto permesso). ~6 bandi per pagina, dal piu' recente; i bandi aperti
stanno nelle prime pagine (scadenza ~30 giorni): ci si ferma dopo 2 pagine consecutive senza bandi con scadenza futura.
Ogni scheda ha: titolo, stato, figura professionale, inquadramento, enti di riferimento (ASL/AOU/ARNAS), date di
pubblicazione e scadenza. Il dettaglio (/ap/<slug>/) aggiunge l'«Oggetto» e i documenti; si legge solo per i bandi
aperti e sanitari. ARES gestisce i concorsi per tutta la sanita' sarda (ASL Sassari, Nuoro, Sulcis, Brotzu, AOU...).
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from html import unescape

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import html_to_text

from . import _it_pub as P
from ._it_regional import Item, Source, build_call

BASE = "https://www.aressardegna.it"
LIST_URL = BASE + "/albo-pretorio/bandi-di-concorso-e-selezione/"
MAX_PAGES = 16
STOP_AFTER_EMPTY_PAGES = 2

SRC = Source(
    slug="ares-sardegna",
    label="ARES Sardegna - Bandi di concorso e selezione",
    owner="ARES Sardegna - Azienda Regionale della Salute",
    owner_short="ARES Sardegna",
    region="Sardegna",
    city="Cagliari",
    portal="ARES Sardegna, Albo Pretorio - bandi di concorso e selezione",
)

# Codici di protocollo in coda al titolo («... Endocrinologia ASL SS 03102», «... Brotzu 03099»).
_TAIL_CODE_RE = re.compile(r"\s+(?:(?:ASL|AOU|ARNAS|ARES)\s+[A-Z]{2,3}\s+)?0\d{4}\s*$")
# ASL e aziende sarde -> sede (la fonte non da' la citta')
CITY_BY_ENTE = (
    (re.compile(r"gallura", re.I), "Olbia"), (re.compile(r"\bsassari|AOU SS|ASL SS", re.I), "Sassari"),
    (re.compile(r"nuoro", re.I), "Nuoro"), (re.compile(r"ogliastra", re.I), "Lanusei"), (re.compile(r"oristano", re.I), "Oristano"),
    (re.compile(r"medio campidano", re.I), "Sanluri"), (re.compile(r"sulcis", re.I), "Carbonia"),
    (re.compile(r"brotzu|\bcagliari|AOU CA", re.I), "Cagliari"),
)


_SC_RE = re.compile(
    r"Direttore di Struttura Complessa.*?\bS\.?\s?C\.?\s*([A-Za-zÀ-ÿ'’() -]+?)"
    r"(?=\s+(?:del|della|dell['’]|di)\s+(?:P\.?O\.?|ASL|Asl|Azienda)\b|\s+(?:ASL|Asl)\b|\s+\d{2,5}\s*$|\s*$)",
    re.I,
)
_TAIL_ENTE_RE = re.compile(r"[,\s]+(?:(?:della|dell['’]|del|di)\s+)?(?:ASL|Asl|AOU|ARNAS|Arnas)\b[^,]*$")


def clean_title(title: str, entes: list[str]) -> str:
    """Toglie codici di protocollo e il nome dell'ente in coda; riscrive «Direttore di Struttura Complessa ... S.C. X» in «Direttore UOC X»."""
    title = _TAIL_CODE_RE.sub("", title)
    title = re.sub(r"\s+\d{2,5}\s*$", "", title)
    sc = _SC_RE.search(title)
    if sc:
        return f"Selezione pubblica per Direttore UOC {sc.group(1).strip(' .')}"
    cut = _TAIL_ENTE_RE.sub("", title)
    if len(cut) > 25:
        title = cut
    return title.strip(" ,;")


def city_of(ente: str) -> str | None:
    for rx, city in CITY_BY_ENTE:
        if rx.search(ente):
            return city
    return None


_CARD_SPLIT = '<div class="gray-head-card no-after card-bordered card">'
_TITLE_RE = re.compile(r'<h5 class="card-title[^>]*>\s*<a href="([^"]+)"[^>]*>(.*?)</a>', re.S)


def _field(card: str, label: str) -> str:
    m = re.search(rf"<strong>{label}</strong><br>(.*?)</div\s*>", card, re.S)
    return m.group(1) if m else ""


def _text(fragment: str) -> str:
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def _date(fragment: str):
    m = re.search(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", fragment)
    return P.parse_it_date(f"{m.group(1)}/{m.group(2)}/{m.group(3)}") if m else None


def parse_list(html: str) -> list[Item]:
    items: list[Item] = []
    for card in html.split(_CARD_SPLIT)[1:]:
        t = _TITLE_RE.search(card)
        if not t:
            continue
        url, title = t.group(1), _text(t.group(2))
        stato = _text(_field(card, "Stato"))
        if re.search(r"(?i)esito|conclus|revocat|annullat|sospes", stato):
            continue
        entes = [_text(x) for x in re.split(r"<br\s*/?>", _field(card, "Ente di riferimento")) if _text(x)]
        slug = url.rstrip("/").rsplit("/", 1)[-1]
        title = clean_title(title, entes)
        items.append(
            Item(
                ident=slug,
                title=title,
                url=url,
                deadline=_date(_field(card, "Data di scadenza")),
                published=_date(_field(card, "Data di pubblicazione")),
                entes=entes,
                city=city_of(entes[0]) if len(entes) == 1 else None,
                extra=[f"Inquadramento: {_text(_field(card, 'Inquadramento'))}"] if _text(_field(card, "Inquadramento")) else [],
            )
        )
    return items


def parse_detail(html: str) -> tuple[str, list[tuple[str, str]]]:
    """(oggetto, documenti) dalla pagina /ap/<slug>/."""
    m = re.search(r'<h4>Oggetto</h4>.*?<p class="text-serif">(.*?)</p>', html, re.S)
    body = _text(m.group(1)) if m else ""
    docs: list[tuple[str, str]] = []
    for a in re.finditer(r'<a[^>]+href="([^"]+\.(?:pdf|p7m|zip))"[^>]*>(.*?)</a>', html, re.S | re.I):
        name = _text(a.group(2)) or "Documento"
        if (name, a.group(1)) not in docs:
            docs.append((name[:90], a.group(1)))
    return body, docs


def list_items(client: HttpClient, now: datetime | None = None) -> list[Item]:
    now = now or datetime.now(timezone.utc)
    items: list[Item] = []
    empty = 0
    for page in range(1, MAX_PAGES + 1):
        url = LIST_URL if page == 1 else f"{LIST_URL}page/{page}/"
        html = client.get_text(url)
        if page == 1 and _CARD_SPLIT not in html:
            raise RuntimeError("ares-sardegna: elenco non riconosciuto (struttura della pagina cambiata?)")
        got = parse_list(html)
        if not got and _CARD_SPLIT not in html:
            break
        items.extend(got)
        if any(i.deadline and P.end_of_day(i.deadline) >= now for i in got):
            empty = 0
        else:
            empty += 1
            if empty >= STOP_AFTER_EMPTY_PAGES:
                break
    return items


_LIST_CACHE: dict[str, list[Item]] = {}


def collect_calls(client: HttpClient, now: datetime | None = None, stats: dict | None = None, with_detail: bool = True) -> list[P.Call]:
    now = now or datetime.now(timezone.utc)
    stats = stats if stats is not None else {}
    if "list" not in _LIST_CACHE:
        _LIST_CACHE["list"] = list_items(client, now)
    items = _LIST_CACHE["list"]
    stats["listed"] = len(items)
    calls: list[P.Call] = []
    for item in items:
        probe = build_call(item, SRC, now, {} if with_detail else stats, with_detail=False)
        if probe is None:
            if with_detail:
                build_call(item, SRC, now, stats, with_detail=False)  # conta il motivo
            continue
        if not with_detail:
            calls.append(probe)
            continue
        try:
            body, docs = parse_detail(client.get_text(item.url))
        except Exception:  # noqa: BLE001
            stats["errors"] = stats.get("errors", 0) + 1
            continue
        item.body, item.docs = body, docs
        call = build_call(item, SRC, now, stats, with_detail=True)
        if call:
            calls.append(call)
    return calls


def priority_keys(client: HttpClient, now: datetime | None = None) -> list:
    return [c.key for c in collect_calls(client, now=now, with_detail=False)]


class AresSardegnaScraper(BaseScraper):
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
