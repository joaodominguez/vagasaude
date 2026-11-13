"""Gazzetta Ufficiale — 4ª Serie Speciale «Concorsi ed esami»: bandi di enti sanitari.

Fonte: feed RSS https://www.gazzettaufficiale.it/rss/S4 (ultimo numero; usciti martedi' e venerdi'). Ogni item ha
l'emettitore, il tipo (CONCORSO/AVVISO/DIARIO/...), la scadenza «(scad. 10 dicembre 2026)» e 1-2 righe di oggetto.
La pagina di dettaglio (`/eli/id/AAAA/MM/DD/CODICE/S4`, robots.txt -> 404, nessuna restrizione) raggiunge anche il
VPS ma ripete SOLO emettitore, tipo, scadenza e oggetto: non aggiunge testo, quindi non si legge item per item.
Il sommario HTML dei numeri precedenti (`/eli/gu/AAAA/MM/DD/N/S4/html`, stesso contenuto del feed) si usa per
recuperare gli ultimi WINDOW numeri (~4 settimane: la scadenza e' a 30 giorni). Non si usano `/rss` (indice, WAF)
ne' `/30giorni`.

Priorita' tra fonti: un bando gia' presente nel portale Veneto o su inPA (stesso ente + profilo + posti/scadenza)
non viene ripubblicato da qui.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from html import unescape

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import html_to_text

from . import _it_pub as P

RSS = "https://www.gazzettaufficiale.it/rss/S4"
ISSUE_URL = "https://www.gazzettaufficiale.it/eli/gu/{y:04d}/{m:02d}/{d:02d}/{n}/S4/html"
ACT_URL = "https://www.gazzettaufficiale.it/eli/id/{y:04d}/{m:02d}/{d:02d}/{code}/S4"
WINDOW = 7  # numeri precedenti a quello del feed

_KINDS = "CONCORSO|AVVISO|DIARIO|RETTIFICA|ERRATA CORRIGE|COMUNICATO|ESITO|GRADUATORIA|NOMINA|PROROGA|INTEGRAZIONE|MODIFICA|REVOCA|SOSPENSIONE|RIAPERTURA|ANNULLAMENTO"
_TITLE_RE = re.compile(r"^(?P<ente>.*?)\s+-\s+(?P<kind>" + _KINDS + r")(?:\s*\(scad\.\s*(?P<scad>[^)]*)\))?\s*$", re.I | re.S)
_CODE_RE = re.compile(r"\((\d{2}E\d{4,6})\)\s*$")
_THIRTY_DAYS_RE = re.compile(r"(?:entro|nel termine di|termine di|scadenza)\s+(?:il )?(?:trenta|30)\s+giorni\s+(?:dalla|dal)\s+(?:data di )?pubblicazione", re.I)


class Entry:
    __slots__ = ("ente", "kind", "scad", "text", "code", "published", "issue")

    def __init__(self, ente: str, kind: str, scad: str | None, text: str, code: str, published: date, issue: str):
        self.ente, self.kind, self.scad, self.text, self.code, self.published, self.issue = ente, kind, scad, text, code, published, issue


def _clean_text(text: str) -> str:
    return P.fix_accents(re.sub(r"\s+", " ", unescape(text)).strip())


def parse_rss(xml: str) -> tuple[list[Entry], tuple[date, int] | None]:
    """(entries, (data, numero) del numero del feed)."""
    issue = None
    m = re.search(r"/eli/gu/(\d{4})/(\d{2})/(\d{2})/(\d+)/S4", xml)
    if m:
        issue = (date(int(m.group(1)), int(m.group(2)), int(m.group(3))), int(m.group(4)))
    entries: list[Entry] = []
    for item in re.findall(r"<item>(.*?)</item>", xml, re.S):
        title = unescape(re.search(r"<title>(.*?)</title>", item, re.S).group(1))
        link = re.search(r"<link>(.*?)</link>", item, re.S).group(1)
        content = re.search(r"<content:encoded>(.*?)</content:encoded>", item, re.S)
        tm = _TITLE_RE.match(re.sub(r"\s+", " ", title).strip())
        lm = re.search(r"/eli/id/(\d{4})/(\d{2})/(\d{2})/(\w+)/S4", link)
        if not tm or not lm:
            continue
        text = _clean_text(content.group(1)) if content else ""
        code = lm.group(4)
        text = _CODE_RE.sub("", text).strip()
        entries.append(
            Entry(
                tm.group("ente").strip(), tm.group("kind").upper(), (tm.group("scad") or "").strip() or None, text, code,
                date(int(lm.group(1)), int(lm.group(2)), int(lm.group(3))),
                f"{issue[1]}" if issue else "",
            )
        )
    return entries, issue


def parse_issue_html(html: str, published: date, number: int) -> list[Entry]:
    """Sommario HTML di un numero (stessi campi del feed)."""
    entries: list[Entry] = []
    for chunk in html.split('<span class="emettitore">')[1:]:
        ente = _clean_text(re.sub(r"<[^>]+>", " ", chunk.split("</span>", 1)[0]))
        kind = re.search(r'<span class="data">\s*([A-ZÀ-Ý ]+?)\s*(?:<font[^>]*>\s*\(scad\.\s*([^)]*)\)|<)', chunk)
        code = re.search(r"codiceRedazionale=(\w+)", chunk)
        texts = re.findall(r'<a href="/atto/concorsi/caricaDettaglioAtto[^"]*">\s*([^<]{15,})', chunk)
        if not (kind and code and texts):
            continue
        text = _CODE_RE.sub("", _clean_text(texts[-1])).strip()
        entries.append(Entry(ente, kind.group(1).strip().upper(), (kind.group(2) or "").strip() or None, text, code.group(1), published, str(number)))
    return entries


def _split_ente(ente: str) -> tuple[str, str | None]:
    """"AZIENDA UNITA' LOCALE SOCIO-SANITARIA N. 7 PEDEMONTANA - BASSANO DEL GRAPPA" -> (nome, sede)."""
    parts = re.split(r"\s+-\s+", ente)
    if len(parts) == 2 and not re.search(r"\d", parts[1]) and len(parts[1]) < 40:
        return parts[0], parts[1]
    return ente, None


def build_call(e: Entry, now: datetime | None = None, stats: dict | None = None) -> P.Call | None:
    now = now or datetime.now(timezone.utc)
    stats = stats if stats is not None else {}

    def bump(key: str) -> None:
        stats[key] = stats.get(key, 0) + 1

    if e.kind != "CONCORSO" or P.is_not_open_call(e.text):
        bump("not_open")
        return None
    text = e.text
    if P.is_not_job(text):
        bump("not_open")
        return None
    if P.is_academic_ente(e.ente) or (P.ACADEMIC_RE.search(text) and not P.is_health_ente(e.ente)):
        bump("non_health")
        return None
    name, seat = _split_ente(e.ente)
    health_ente = P.is_health_ente(e.ente)
    profile = P.extract_profile(text)
    if not health_ente and not (profile and P.is_health_profile(profile) and not re.search(r"ministero|tribunale|prefettura|questura", e.ente, re.I)):
        bump("non_health")
        return None
    if P.ACADEMIC_RE.search(text):
        bump("non_health")
        return None

    estimated = False
    deadline = P.parse_it_date(e.scad)
    if not deadline and _THIRTY_DAYS_RE.search(text):
        deadline, estimated = e.published + timedelta(days=30), True
    if not deadline:
        bump("no_deadline")
        return None
    if P.end_of_day(deadline) < now:
        bump("expired")
        return None

    discipline = P.extract_discipline(text)
    posts = P.posts_from(text)
    kind = P.classify_kind(text)
    if kind == P.KIND_SELEZIONE and not re.search(r"conferimento|incarico", text, re.I):
        kind = P.KIND_CONCORSO  # il feed li classifica CONCORSO; gli incarichi di direzione restano "Selezione pubblica"
    ente_name = P.nice_ente(name)
    short = P.short_ente(name)
    if re.fullmatch(r"(?i)estar", name.strip()):
        ente_name, short = "ESTAR — Ente di Supporto Tecnico-Amministrativo Regionale (Toscana)", "ESTAR"
    if profile:
        title = P.build_title(kind, profile, discipline, short, posts)
    else:
        title = P.fit_title(f"{kind}: {P.nice_case(text)}", short)
    profession = P.profession_for(profile, discipline, text, health_ente)

    region, town = P.location_from_text(name, seat)
    if re.fullmatch(r"(?i)estar", name.strip()):
        region, town = "Toscana", None
    if region == "Italia":
        bump("no_region")
        return None
    if seat and not town:
        town = P.nice_case(seat)

    url = ACT_URL.format(y=e.published.year, m=e.published.month, d=e.published.day, code=e.code)
    parts = [text, "", f"Ente: {ente_name}" + (f" (sede: {P.nice_case(seat)})" if seat else ""), f"Tipologia: {kind}"]
    if posts:
        parts.append(f"Posti: {posts}")
    if profile:
        parts.append(f"Profilo: {profile}" + (f", disciplina {discipline}" if discipline else ""))
    parts.append(
        f"Pubblicato nella Gazzetta Ufficiale, 4ª Serie Speciale — Concorsi ed esami, n. {e.issue} del {P.fmt_date(e.published)} (codice redazionale {e.code})."
    )
    if estimated:
        parts.append(
            f"Scadenza stimata: {P.fmt_date(deadline)} (30 giorni dalla pubblicazione in Gazzetta Ufficiale, come indicato nel bando). Verifica la data esatta nel bando."
        )
    else:
        parts.append(f"Scadenza per la presentazione delle domande: {P.fmt_date(deadline)} (come indicata in Gazzetta Ufficiale).")
    parts.extend(
        [
            "",
            "Come candidarsi: la domanda va presentata secondo le modalità indicate nel bando integrale, pubblicato in Gazzetta Ufficiale e sul sito dell'ente.",
            f"Fonte: Gazzetta Ufficiale — {url}",
        ]
    )
    description = P.clip_description("\n".join(parts))
    if len(description) < 200:
        bump("thin")
        return None

    key = P.make_key([name], profile, discipline, [posts], deadline)
    job = JobPayload(
        title=title,
        company=ente_name,
        location_district=region,
        location_concelho=town,
        profession=profession,
        specialty=discipline,
        sector="pubblico",
        contract_type="Tempo indeterminato" if re.search(r"indeterminat", text, re.I) else ("Tempo determinato" if re.search(r"determinato", text, re.I) else None),
        description=description,
        requirements=None,
        salary=None,
        application_url=url,
        source="gu-s4",
        source_id=f"gu-{e.code}",
        published_at=P.start_of_day(e.published).isoformat(),
        expires_at=P.end_of_day(deadline).isoformat(),
    )
    return P.Call(job, key)


def previous_issue_dates(latest: date, count: int = 20) -> list[date]:
    """Martedi'/venerdi' precedenti, dal piu' recente (la G.U. S4 esce in quei giorni)."""
    out = []
    d = latest - timedelta(days=1)
    while len(out) < count:
        if d.weekday() in (1, 4):
            out.append(d)
        d -= timedelta(days=1)
    return out


def collect_entries(client: HttpClient, window: int = WINDOW, stats: dict | None = None) -> list[Entry]:
    stats = stats if stats is not None else {}
    entries, issue = parse_rss(client.get_text(RSS))
    stats["rss_items"] = len(entries)
    if not issue:
        return entries
    latest, number = issue
    got, n = 0, number - 1
    for d in previous_issue_dates(latest):
        if got >= window or n < 1:
            break
        try:
            html = client.get_text(ISSUE_URL.format(y=d.year, m=d.month, d=d.day, n=n))
        except Exception:  # noqa: BLE001
            continue
        found = parse_issue_html(html, d, n)
        if found:
            entries.extend(found)
            got += 1
            n -= 1
    stats["issues_backfilled"] = got
    return entries


def build_calls(entries: list[Entry], now: datetime | None = None, stats: dict | None = None) -> list[P.Call]:
    stats = stats if stats is not None else {}
    calls, seen = [], set()
    for e in entries:
        if e.code in seen:
            continue
        seen.add(e.code)
        c = build_call(e, now, stats)
        if c:
            calls.append(c)
    return calls


class GuS4Scraper(BaseScraper):
    slug = "gu-s4"
    name = "Gazzetta Ufficiale 4ª Serie — Concorsi (sanità)"
    # Il feed contiene solo l'ultimo numero (+ finestra di numeri precedenti): niente soft-expire per mancata presenza.
    last_listings_complete = False

    def __init__(self) -> None:
        self.stats: dict = {}
        self.dropped: list[P.Call] = []
        self.dropped_by: dict[str, int] = {}

    def fetch(self) -> list[JobPayload]:
        from . import inpa, plone_er, veneto_concorsi

        client = HttpClient(min_interval=1.0)
        try:
            calls = build_calls(collect_entries(client, stats=self.stats), stats=self.stats)
            # Fonti degli enti (Veneto, Plone Emilia-Romagna) prima di inPA.
            veneto_keys = [c.key for c in veneto_concorsi.collect_calls(client)]
            veneto_keys += plone_er.priority_keys(client)
            inpa_calls, _ = inpa.collect_calls(client)
        finally:
            client.close()
        inpa_keys = [c.key for c in inpa_calls]
        # Un bando inPA gia' scartato a favore del Veneto resta comunque una "chiave piu' ricca".
        kept, dropped_v = P.drop_duplicates(calls, veneto_keys)
        kept, dropped_i = P.drop_duplicates(kept, inpa_keys)
        self.dropped = dropped_v + dropped_i
        self.dropped_by = {"veneto": len(dropped_v), "inpa": len(dropped_i)}
        self.stats["dup_veneto"], self.stats["dup_inpa"] = len(dropped_v), len(dropped_i)
        jobs = P.dedupe_titles([c.job for c in kept])
        self.stats["published"] = len(jobs)
        return jobs
