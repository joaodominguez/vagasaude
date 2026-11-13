"""Emilia-Romagna: aziende sanitarie sul CMS Plone 6 (Volto / io-Sanita') con API REST pubblica.

Endpoint (stessi del sito, solo lettura anonima; robots.txt di ogni dominio vieta al massimo `/search` e `/login`):
  GET https://<host>/++api++/@search?portal_type=Bando&b_size=100&metadata_fields=_all   (elenco, con scadenza e stato)
  GET https://<host>/++api++/<percorso-del-bando>                                          (testi: a chi si rivolge, come partecipare...)

Un lettore generico, una configurazione per ente, UNO SLUG PER ENTE (`ausl-ferrara`, `ausl-romagna`, `ausl-modena`): cosi' ogni ente ha la propria scheda fonte con il nome vero e un guasto/soft-expire di un ente non
cancella le offerte degli altri. L'AOU di Ferrara (www.ospfe.it) NON e' registrata: il suo robots.txt ha
`Disallow: /*?` e l'elenco @search richiede parametri. L'AUSL di Piacenza non e' registrata: il suo Plone contiene solo gare e forniture
(le procedure di reclutamento stanno su offline.ausl.pc.it, fuori dalle API Plone).

Solo bandi APERTI di reclutamento verso l'esterno: concorsi, avvisi a tempo determinato, mobilita' in entrata, incarichi
libero-professionali, direttori di struttura complessa. Si scartano selezioni interne, banche dati, stabilizzazioni,
borse di studio, gare/forniture, esiti/graduatorie e profili non sanitari.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from common.http import HttpClient
from common.models import BaseScraper, JobPayload

from . import _it_pub as P

ROME = ZoneInfo("Europe/Rome")
REGION = "Emilia-Romagna"
PAGE = 100
MAX_PAGES = 6


@dataclass(frozen=True)
class Entity:
    slug: str
    name: str        # nome ufficiale (company)
    short: str       # sigla per i titoli
    host: str
    city: str        # sede
    label: str       # nome della fonte


ENTITIES = (
    Entity("ausl-ferrara", "Azienda USL di Ferrara", "AUSL Ferrara", "www.ausl.fe.it", "Ferrara", "AUSL Ferrara - Concorsi e avvisi"),
    Entity("ausl-romagna", "Azienda USL della Romagna", "AUSL Romagna", "www.auslromagna.it", "Ravenna", "AUSL Romagna - Concorsi e selezioni"),
    Entity("ausl-modena", "Azienda USL di Modena", "AUSL Modena", "www.ausl.mo.it", "Modena", "AUSL Modena - Concorsi"),
)

LIST_PATH = "/++api++/@search"
LIST_PARAMS = {"portal_type": "Bando", "b_size": PAGE, "sort_on": "effective", "sort_order": "descending", "metadata_fields": "_all"}


# --- filtri ------------------------------------------------------------------------------------

_SKIP_SECTION_RE = re.compile(
    r"selezion\w* intern|\binterno\b|\binterna\b|\binterni\b|riservat\w* al personale|personale dipendente|banc[ah]e? dati|"
    r"diritto allo studio|incarichi? di funzione|stabilizzazion|bors[ae] di studio|consultazione preliminare|co-?progettazione|"
    r"ricerca di sponsor|sponsor|acquisizione beni|beni e servizi|\bgare?\b|appalto|affidamento (di|del) (servizio|lavori)|fornitur|"
    r"agevolazioni|finanziamenti|contributi|incarichi? di docenza|docenza|graduatoria interna|alienazione|locazione",
    re.I,
)
_HEALTH_EXTRA_RE = re.compile(
    r"medicina e chirurgia|laureat\w* in medicina|specializzand|igenist|professionist\w* (della salute|sanitar)|odontoiatr|"
    r"assistente sanitari|medic[oi] (specialist|di)|dirigente (sanitari|medic)|direttore (di )?(struttura complessa|uoc|u\.o\.c)|"
    r"infermier|operator\w* socio|psicolog|educator\w* professional",
    re.I,
)
_LEAD_RE = re.compile(r"(?i)^(concorso pubblico|avviso pubblico|selezione pubblica)[,]?\s*")
_NON_HEALTH_RE = re.compile(r"ingegner|informatic|amministrativ|tecnico professionale|avvocat|statistic|geometr|architett", re.I)


def is_health_call(text: str) -> bool:
    if _NON_HEALTH_RE.search(text) and not P.is_health_profile(text):
        return False
    return P.is_health_profile(text) or bool(_HEALTH_EXTRA_RE.search(text))


# --- testi Volto ---------------------------------------------------------------------------------

def blocks_text(field) -> str:
    """Testo semplice di un campo Volto (blocchi slate o draft-js); '' se vuoto."""
    if not isinstance(field, dict):
        return ""
    blocks = field.get("blocks") or {}
    order = (field.get("blocks_layout") or {}).get("items") or list(blocks)
    lines: list[str] = []
    for bid in order:
        b = blocks.get(bid) or {}
        if b.get("@type") == "slate":
            for node in b.get("value") or []:
                t = _slate_text(node).strip()
                if t:
                    lines.append(t)
        elif b.get("@type") == "text":
            for ent in ((b.get("text") or {}).get("blocks") or []):
                t = (ent.get("text") or "").strip()
                if t:
                    lines.append(t)
    return "\n".join(lines)


def _slate_text(node) -> str:
    if isinstance(node, dict):
        if "text" in node and "children" not in node:
            return node.get("text") or ""
        sep = "\n" if node.get("type") in ("ul", "ol") else ""
        return sep.join(_slate_text(c) for c in node.get("children") or [])
    return ""


def blocks_links(field) -> list[str]:
    out: list[str] = []

    def walk(x):
        if isinstance(x, dict):
            url = (x.get("data") or {}).get("url") if isinstance(x.get("data"), dict) else None
            if isinstance(url, str) and url.startswith("http") and url not in out:
                out.append(url)
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)

    walk(field)
    return out


# --- date ------------------------------------------------------------------------------------------

def parse_dt(value: str | None) -> datetime | None:
    if not value or value == "None":
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ROME)
    return dt.astimezone(timezone.utc)


def rome_date(dt: datetime | None) -> date | None:
    return dt.astimezone(ROME).date() if dt else None


# --- bando -------------------------------------------------------------------------------------------

def _discipline(title: str, description: str) -> str | None:
    d = P.extract_discipline(title) or P.extract_discipline(description)
    if d:
        return d
    m = re.search(r"dirigente medico\s+(?:di|della|dell['’]|in)\s+([^,.;(–—-]+?)(?:\s+(?:per|presso|a tempo|presso)\b|[,.;(–—]|$)", f"{title}", re.I)
    if m and len(m.group(1)) < 70 and not re.match(r"(?i)(struttura|direzione|unit)", m.group(1)):
        return P.nice_case(m.group(1))
    return None


def skip_reason(item: dict, now: datetime) -> str | None:
    """Motivo di scarto sui soli metadati dell'elenco, None se il bando e' da leggere."""
    title = re.sub(r"\s+", " ", item.get("title") or "").strip()
    if not title:
        return "empty"
    state = item.get("bando_state") or []
    if state and str(state[0]).lower() != "open":
        return "closed"
    deadline = parse_dt(item.get("scadenza_bando"))
    if deadline and deadline < now:
        return "expired"
    section = " ".join(
        x for x in (item.get("tipologia_bando_label"), (item.get("parent") or {}).get("title")) if isinstance(x, str)
    )
    if _SKIP_SECTION_RE.search(section) or _SKIP_SECTION_RE.search(title):
        return "not_recruitment"
    if P.is_not_open_call(title) or P.is_not_job(title) or P.ACADEMIC_RE.search(title):
        return "not_open"
    if not is_health_call(f"{title} {item.get('description') or ''}"):
        return "non_health"
    return None


def build_call(item: dict, entity: Entity, detail: dict | None = None, now: datetime | None = None, stats: dict | None = None) -> P.Call | None:
    """`item` = riga dell'elenco; `detail` = pagina del bando (None: chiave soltanto, senza testi)."""
    now = now or datetime.now(timezone.utc)
    stats = stats if stats is not None else {}
    reason = skip_reason(item, now)
    if reason:
        stats[reason] = stats.get(reason, 0) + 1
        return None
    title = re.sub(r"\s+", " ", item["title"]).strip()
    if title.isupper():
        title = P.nice_case(title)
    short_desc = re.sub(r"\s+", " ", item.get("description") or "").strip()
    section = " ".join(
        x for x in (item.get("tipologia_bando_label"), (item.get("parent") or {}).get("title")) if isinstance(x, str)
    )
    deadline_dt = parse_dt(item.get("scadenza_bando"))
    deadline = rome_date(deadline_dt)
    published_dt = parse_dt(item.get("apertura_bando")) or parse_dt(item.get("effective")) or parse_dt(item.get("created"))
    published = rome_date(published_dt)

    posts = P.posts_from(title) or P.posts_from(short_desc)
    ext = f"{title}. {short_desc}" if short_desc and short_desc.lower() not in title.lower() else title
    profile = P.extract_profile(title) or P.extract_profile(ext)
    discipline = _discipline(title, ext)
    kind = P.classify_kind(f"{title} {section}")
    if profile:
        job_title = P.build_title(kind, profile, discipline, entity.short, posts)
    else:
        bare = P.nice_case(_LEAD_RE.sub("", title))
        job_title = P.fit_title(f"{kind}: {bare}", entity.short)
    profession = P.profession_for(profile, discipline, ext, True)

    url = item.get("@id") or item.get("getURL")
    ident = item.get("UID") or url
    detail = detail or {}
    parts = [title, ""]
    if short_desc and short_desc.lower() not in title.lower():
        parts.append(short_desc)
        parts.append("")
    parts.append(f"Ente: {entity.name} (sede: {entity.city})")
    parts.append(f"Tipologia: {kind}")
    if posts:
        parts.append(f"Posti: {posts}")
    if profile:
        parts.append(f"Profilo: {profile}" + (f", disciplina {discipline}" if discipline else ""))
    if published:
        parts.append(f"Data di apertura: {P.fmt_date(published)}")
    if deadline:
        parts.append(f"Scadenza per la presentazione delle domande: {P.fmt_date(deadline)}")
    else:
        parts.append("Scadenza: avviso aperto, senza data di scadenza indicata sul sito dell'ente.")
    for label, field in (
        ("A chi si rivolge", "a_chi_si_rivolge"), ("Descrizione", "descrizione_estesa"), ("Testo del bando", "text"),
        ("Modalità di selezione", "modalita_selezione"), ("Come partecipare", "come_partecipare"),
        ("Riferimenti", "riferimenti_bando"), ("Aggiornamenti", "note_aggiornamento"),
    ):
        text = blocks_text(detail.get(field))
        if text and text.lower() not in title.lower() and text.strip() != short_desc:
            parts.extend(["", f"{label}: {text}" if "\n" not in text and len(text) < 120 else f"{label}:\n{text}"])
    apply_links = [u for u in blocks_links(detail.get("come_partecipare")) if "ausl" not in urlsplit(u).netloc or "login" in u or "concorsi" in u]
    if apply_links:
        parts.extend(["", f"Domanda online: {apply_links[0]}"])
    atts = []
    for group in detail.get("approfondimento") or []:
        for child in group.get("children") or []:
            if child.get("url") and child.get("title"):
                atts.append((child["title"], child["url"].replace(" ", "%20")))
    if atts:
        parts.extend(["", "Documenti ufficiali:"])
        parts.extend(f"- {name}: {link}" for name, link in atts[:8])
    parts.extend(["", f"Bando integrale e allegati sul sito dell'ente: {url}", f"Fonte: {entity.name} — albo concorsi e avvisi."])
    description = P.clip_description("\n".join(parts))
    if detail and len(description) < 200:
        stats["thin"] = stats.get("thin", 0) + 1
        return None

    low = f"{title} {section}".lower()
    contract = None
    if kind == P.KIND_INCARICO:
        contract = "Libero professionale"
    elif re.search(r"indeterminat", low) or (kind == P.KIND_CONCORSO and not re.search(r"determinat", low)):
        contract = "Tempo indeterminato"
    elif re.search(r"determinat|temporane|sostituzion|urgenza", low) or kind == P.KIND_TEMPO_DET:
        contract = "Tempo determinato"

    key = P.make_key([entity.name], profile, discipline, [posts], deadline)
    job = JobPayload(
        title=job_title,
        company=entity.name,
        location_district=REGION,
        location_concelho=entity.city,
        profession=profession,
        specialty=discipline,
        sector="pubblico",
        contract_type=contract,
        description=description,
        requirements=None,
        salary=None,
        application_url=url,
        source=entity.slug,
        source_id=f"{entity.slug}-{ident}",
        published_at=published_dt.isoformat() if published_dt else None,
        expires_at=P.end_of_day(deadline).isoformat() if deadline else None,
    )
    return P.Call(job, key)


# --- rete --------------------------------------------------------------------------------------------

def list_items(client: HttpClient, entity: Entity) -> list[dict]:
    items: list[dict] = []
    for page in range(MAX_PAGES):
        params = dict(LIST_PARAMS, b_start=page * PAGE)
        data = client.get_json(f"https://{entity.host}{LIST_PATH}", params=params)
        if page == 0 and "items" not in data:
            raise RuntimeError(f"{entity.slug}: risposta @search non riconosciuta (API Plone cambiata?)")
        got = data.get("items") or []
        items.extend(got)
        if len(items) >= int(data.get("items_total") or 0) or not got:
            break
    return items


def detail_url(entity: Entity, item: dict) -> str:
    return f"https://{entity.host}/++api++{urlsplit(item['@id']).path}"


def collect_calls(
    client: HttpClient, entity: Entity, now: datetime | None = None, stats: dict | None = None, with_detail: bool = True
) -> list[P.Call]:
    """Bandi aperti dell'ente. `with_detail=False`: solo chiavi per il dedupe (1 richiesta, nessun testo)."""
    now = now or datetime.now(timezone.utc)
    stats = stats if stats is not None else {}
    calls: list[P.Call] = []
    items = list_items(client, entity)
    stats["listed"] = len(items)
    for item in items:
        if skip_reason(item, now):
            build_call(item, entity, None, now, stats)  # conta il motivo
            continue
        detail = None
        if with_detail:
            try:
                detail = client.get_json(detail_url(entity, item))
            except Exception:  # noqa: BLE001
                stats["errors"] = stats.get("errors", 0) + 1
                continue
        call = build_call(item, entity, detail if with_detail else None, now, stats)
        if call:
            calls.append(call)
    return calls


def priority_keys(client: HttpClient, now: datetime | None = None) -> list:
    """Chiavi dei bandi aperti di tutti gli enti (1 richiesta per ente): servono a inPA e GU per non
    ripubblicare gli stessi bandi, perche' la fonte dell'ente e' piu' ricca. Un ente in errore non blocca."""
    keys: list = []
    for entity in ENTITIES:
        try:
            keys.extend(c.key for c in collect_calls(client, entity, now=now, with_detail=False))
        except Exception:  # noqa: BLE001
            continue
    return keys


class PloneErScraper(BaseScraper):
    entity: Entity
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.1)
        try:
            calls = collect_calls(client, self.entity, stats=self.stats)
        finally:
            client.close()
        jobs = P.dedupe_titles([c.job for c in calls])
        self.stats["published"] = len(jobs)
        self.last_listings_complete = not self.stats.get("errors")
        return jobs


def _make(entity: Entity) -> type[PloneErScraper]:
    return type(
        "PloneEr" + "".join(p.capitalize() for p in entity.slug.split("-")) + "Scraper",
        (PloneErScraper,),
        {"slug": entity.slug, "name": entity.label, "entity": entity},
    )


SCRAPER_CLASSES = tuple(_make(e) for e in ENTITIES)
ENTITY_BY_SLUG = {e.slug: e for e in ENTITIES}
