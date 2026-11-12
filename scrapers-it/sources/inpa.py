"""inPA — Portale del Reclutamento (Dipartimento della Funzione Pubblica), bandi sanitari.

https://www.inpa.gov.it : l'elenco bandi e' caricato via /wp-json/ (VIETATO da robots.txt: non si usa). Si usano
la sitemap `sitemap-bandi.xml` (~1900 URL, tutte le PA) e la pagina di dettaglio con i campi strutturati in HTML
server-side (`dettaglio-bando-avviso/?concorso_id=...`). Solo ~8% sono sanitari.

Per non rileggere ~1900 pagine a ogni esecuzione c'e' una cache su disco (`.cache/inpa.json`, variabile INPA_CACHE):
per ogni concorso_id si ricorda se e' scaduto / non sanitario / non aperto (mai piu' riletto) oppure i campi dei
sanitari aperti (riletti solo se cambia il lastmod della sitemap). Ogni esecuzione legge al massimo INPA_MAX_FETCH
pagine nuove (default 1200, 1 s tra una richiesta e l'altra); se ne restano da leggere, `last_listings_complete`
e' False (nessun soft-expire) e il resto viene recuperato nelle esecuzioni successive.
"""
from __future__ import annotations

import json
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_district, html_to_text

from . import _it_pub as P

SITEMAP = "https://www.inpa.gov.it/sitemap-bandi.xml"
DETAIL = "https://www.inpa.gov.it/bandi-e-avvisi/dettaglio-bando-avviso/?concorso_id={id}"
DEFAULT_MAX_FETCH = 1200
_ID_RE = re.compile(r"concorso_id=([0-9a-f]{32})")


def parse_sitemap(xml: str) -> list[tuple[str, str]]:
    """[(concorso_id, lastmod)] nell'ordine della sitemap."""
    out = []
    root = ET.fromstring(xml)
    for url in root.iter("{http://www.sitemaps.org/schemas/sitemap/0.9}url"):
        loc = url.findtext("{http://www.sitemaps.org/schemas/sitemap/0.9}loc") or ""
        m = _ID_RE.search(loc)
        if m:
            out.append((m.group(1), url.findtext("{http://www.sitemaps.org/schemas/sitemap/0.9}lastmod") or ""))
    return out


_FIELD_RE = re.compile(
    r'<span class="concorso-label[^"]*">\s*([^<:]+?):\s*</span>\s*(?:<span class="concorso-content[^"]*">(.*?)</span>|(?=</p>))', re.S
)


def parse_detail(html: str, ident: str) -> dict | None:
    h1 = re.search(r'<h1 class="h5">(.*?)</h1>', html, re.S)
    if not h1:
        return None
    out: dict = {"id": ident, "title": re.sub(r"\s+", " ", html_to_text(h1.group(1))).strip()}
    for m in _FIELD_RE.finditer(html):
        label = re.sub(r"\s+", " ", m.group(1)).strip().lower()
        if m.group(2) is not None and label not in out:
            out[label] = re.sub(r"\s+", " ", html_to_text(m.group(2))).strip()
    st = re.search(r'concorso-status\s+([A-Za-zÀ-ÿ]+)', html)
    out["stato"] = st.group(1) if st else ""
    desc = re.search(r'Descrizione:\s*</span></p>\s*<div class="font-lora">(.*?)</div>', html, re.S)
    out["descrizione"] = html_to_text(desc.group(1)).strip() if desc else ""
    link = re.search(r'Link al sito della PA:.*?<a href="([^"]+)"', html, re.S)
    out["link_pa"] = unescape(link.group(1)) if link else ""
    atts = []
    for am in re.finditer(r'<a href="(https://portale\.inpa\.gov\.it/api/media/[^"]+)" title="([^"]*)"[^>]*>([^<]*)</a>', html):
        atts.append((unescape(am.group(2)).strip(), am.group(1), re.sub(r"\s+", " ", unescape(am.group(3))).strip()))
    out["attachments"] = atts
    return out


def _body(detail: dict) -> str:
    """Testo del bando senza il prefisso dell'ente ("ASL X – CONCORSO PUBBLICO ...")."""
    body = detail.get("descrizione") or ""
    if not body:
        title = detail.get("title", "")
        body = re.split(r"\s[–-]\s", title, maxsplit=1)[-1]
    return re.sub(r"\s+", " ", body).strip()


def _tail(detail: dict) -> str:
    """Titolo senza il prefisso dell'ente ("ASL X – Concorso ...")."""
    title = detail.get("title", "")
    ente = (detail.get("ente di riferimento") or "").strip()
    if ente and title.lower().startswith(ente.lower()):
        title = title[len(ente):].lstrip(" –—-:")
    return title


def profile_of(detail: dict) -> tuple[str | None, str | None]:
    """(profilo, disciplina) dal titolo (senza ente) o, in mancanza, dalla descrizione."""
    tail, body = _tail(detail), _body(detail)
    profile = P.extract_profile(tail) or P.extract_profile(body)
    discipline = P.extract_discipline(tail) or P.extract_discipline(body)
    return profile, discipline


def classify_detail(detail: dict, now: datetime) -> tuple[str, str | None]:
    """('keep'|'expired'|'non_health'|'not_open'|'bad', motivo/None). Pura: serve anche per la cache."""
    if not detail.get("title"):
        return "bad", None
    if (detail.get("stato") or "").lower() != "aperto":
        return "not_open", None
    deadline = P.parse_it_date(detail.get("data chiusura candidature"))
    if deadline and P.end_of_day(deadline) < now:
        return "expired", None
    ente = detail.get("ente di riferimento") or ""
    body = _body(detail)
    health_ente = P.is_health_ente(ente)
    profile, _ = profile_of(detail)
    # Ente non sanitario (comune, IPAB, casa di riposo...): conta solo un profilo chiaramente sanitario.
    health_profile = bool(profile and P.is_health_profile(profile))
    if not (health_ente or health_profile):
        return "non_health", None
    if not health_ente and (P.ACADEMIC_RE.search(body) or P.is_academic_ente(ente)):
        return "non_health", None
    if P.is_not_job(f"{detail.get('title', '')} {body}"):
        return "not_open", None
    if P.is_not_open_call(body):
        return "not_open", None
    return "keep", None


def build_call(detail: dict, now: datetime | None = None) -> P.Call | None:
    now = now or datetime.now(timezone.utc)
    verdict, _ = classify_detail(detail, now)
    if verdict != "keep":
        return None
    ident = detail["id"]
    ente = detail.get("ente di riferimento") or re.split(r"\s[–-]\s", detail["title"], maxsplit=1)[0]
    body = _body(detail)
    health_ente = P.is_health_ente(ente)
    deadline = P.parse_it_date(detail.get("data chiusura candidature"))
    opened = P.parse_it_date(detail.get("data apertura candidature"))
    if not opened:
        for _, _, label in detail.get("attachments", []):
            opened = P.parse_it_date(label)
            if opened:
                break
    posts_field = detail.get("numero di posti", "")
    posts = P.clean_posts(int(posts_field)) if posts_field.strip().isdigit() else None
    posts = posts or P.posts_from(_tail(detail)) or P.posts_from(body)
    profile, discipline = profile_of(detail)
    kind = P.classify_kind(f"{_tail(detail)} {body}")
    short = P.short_ente(ente)
    if profile:
        title = P.build_title(kind, profile, discipline, short, posts)
    else:
        text = P.nice_case(re.sub(r"(?i)^(concorso pubblico|avviso pubblico|selezione pubblica)[,]?\s*", "", _tail(detail) or body))
        title = P.fit_title(f"{kind}: {text}", short)
    profession = P.profession_for(profile, discipline, body, health_ente)

    area = detail.get("area geografica", "")
    region = guess_district(None, area) if area else "Italia"
    town = None
    if region not in P.REGIONS:
        region, town = P.location_from_text(ente, detail["title"])
    else:
        _, town = P.location_from_text(ente, detail["title"])
    if region == "Italia":
        # senza regione non compare nelle pagine regionali: si scarta (inPA copre anche enti nazionali)
        return None

    url = DETAIL.format(id=ident)
    headline = detail["title"] if detail["title"].lower().startswith(ente.lower()) else f"{ente} – {detail['title']}"
    headline = P.nice_case(headline) if headline.isupper() else headline
    parts = [headline]
    if body and re.sub(r"\W+", "", body.lower()) not in re.sub(r"\W+", "", headline.lower()):
        parts.extend(["", body])
    parts.append("")
    parts.append(f"Ente: {P.nice_ente(ente)}")
    parts.append(f"Tipologia: {kind}" + (f" ({detail['valutazione'].lower()})" if detail.get("valutazione") else ""))
    if posts:
        parts.append(f"Posti: {posts}")
    if profile:
        parts.append(f"Profilo: {profile}" + (f", disciplina {discipline}" if discipline else ""))
    parts.append(f"Area geografica: {area or region}")
    if opened:
        parts.append(f"Apertura candidature: {P.fmt_date(opened)}")
    if deadline:
        parts.append(f"Scadenza candidature: {P.fmt_date(deadline)}")
    parts.extend(["", "Come candidarsi: le domande si presentano dal portale inPA, dalla pagina del bando (accesso con SPID, CIE o CNS)."])
    if detail.get("attachments"):
        parts.extend(["", "Bando e allegati ufficiali:"])
        parts.extend(f"- {name}: {link}" for name, link, _ in detail["attachments"][:8])
    if detail.get("link_pa"):
        parts.append(f"Sito dell'ente: {detail['link_pa']}")
    parts.extend(["", f"Fonte: inPA — Portale del Reclutamento: {url}"])
    description = P.clip_description("\n".join(parts))
    if len(description) < 200:
        return None

    key = P.make_key([ente], profile, discipline, [posts], deadline)
    job = JobPayload(
        title=title,
        company=P.nice_ente(ente),
        location_district=region,
        location_concelho=town,
        profession=profession,
        specialty=discipline,
        sector="pubblico",
        contract_type=_contract(body),
        description=description,
        requirements=None,
        salary=None,
        application_url=url,
        source="inpa",
        source_id=f"inpa-{ident}",
        published_at=P.start_of_day(opened).isoformat() if opened else None,
        expires_at=P.end_of_day(deadline).isoformat() if deadline else None,
    )
    return P.Call(job, key)


def _contract(text: str) -> str | None:
    t = text.lower()
    if re.search(r"indeterminat", t):
        return "Tempo indeterminato"
    if re.search(r"\bdeterminat|a termine|sostituzion|temporane", t):
        return "Tempo determinato"
    if re.search(r"libero[- ]professional|lavoro autonomo|co\.?co\.?co", t):
        return "Libero professionale"
    return None


# --- cache -----------------------------------------------------------------------------------------

def cache_path() -> Path:
    return Path(os.environ.get("INPA_CACHE") or Path(__file__).resolve().parent.parent / ".cache" / "inpa.json")


def load_cache(path: Path | None = None) -> dict:
    path = path or cache_path()
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {}


def save_cache(cache: dict, path: Path | None = None) -> None:
    path = path or cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def collect_calls(
    client: HttpClient,
    now: datetime | None = None,
    stats: dict | None = None,
    max_fetch: int | None = None,
    cache: dict | None = None,
    save: bool = True,
) -> tuple[list[P.Call], bool]:
    """(bandi sanitari aperti, elenco completo?). Legge sitemap + dettagli non in cache."""
    now = now or datetime.now(timezone.utc)
    stats = stats if stats is not None else {}
    if max_fetch is None:
        max_fetch = int(os.environ.get("INPA_MAX_FETCH") or DEFAULT_MAX_FETCH)
    cache = cache if cache is not None else load_cache()
    entries = parse_sitemap(client.get_text(SITEMAP))
    stats["sitemap"] = len(entries)
    fetched = 0
    remaining = 0
    calls: list[P.Call] = []
    live_ids = {i for i, _ in entries}
    for ident, lastmod in entries:
        row = cache.get(ident)
        if row and (row.get("v") in ("expired", "bad") or (row.get("v") == "non_health" and not row.get("d"))):
            stats[row["v"]] = stats.get(row["v"], 0) + 1
            continue
        if row and row.get("lastmod") == lastmod and row.get("d"):
            detail = row.get("d")  # si riclassifica sempre dal dettaglio salvato: le regole possono cambiare
        else:
            if fetched >= max_fetch:
                remaining += 1
                continue
            fetched += 1
            try:
                detail = parse_detail(client.get_text(DETAIL.format(id=ident)), ident)
            except Exception:  # noqa: BLE001
                stats["errors"] = stats.get("errors", 0) + 1
                remaining += 1
                continue
            if detail is None:
                cache[ident] = {"v": "bad", "lastmod": lastmod}
                stats["bad"] = stats.get("bad", 0) + 1
                continue
            verdict, _ = classify_detail(detail, now)
            cache[ident] = {"v": verdict, "lastmod": lastmod, **({"d": detail} if verdict != "expired" else {})}
            if save and fetched % 50 == 0:
                save_cache(cache)
        if not detail:
            continue
        verdict, _ = classify_detail(detail, now)
        if verdict != "keep":
            stats[verdict] = stats.get(verdict, 0) + 1
            if verdict == "expired":
                cache[ident] = {"v": "expired", "lastmod": lastmod}
            continue
        call = build_call(detail, now)
        if call:
            calls.append(call)
        else:
            stats["no_region_or_thin"] = stats.get("no_region_or_thin", 0) + 1
    for stale in [k for k in cache if k not in live_ids]:
        del cache[stale]
    if save:
        save_cache(cache)
    stats["fetched"] = fetched
    stats["remaining"] = remaining
    return calls, remaining == 0


class InpaScraper(BaseScraper):
    slug = "inpa"
    name = "inPA — Portale del Reclutamento (sanità)"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}
        self.dropped: list[P.Call] = []

    def fetch(self) -> list[JobPayload]:
        from . import veneto_concorsi

        client = HttpClient(min_interval=1.0)
        try:
            calls, complete = collect_calls(client, stats=self.stats)
            # Priorita': il portale Veneto vince sugli stessi bandi letti su inPA.
            higher = [c.key for c in veneto_concorsi.collect_calls(client)]
        finally:
            client.close()
        self.last_listings_complete = complete
        kept, self.dropped = P.drop_duplicates(calls, higher)
        self.stats["dup_veneto"] = len(self.dropped)
        jobs = P.dedupe_titles([c.job for c in kept])
        self.stats["published"] = len(jobs)
        return jobs
