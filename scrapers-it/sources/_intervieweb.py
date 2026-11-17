"""Lettore generico Intervieweb / inRecruiting (Zucchetti): un cliente = una configurazione.

Usato da Policlinico Gemelli, GVM Care & Research e Synlab Italia, con l'autorizzazione dei tre gruppi
(il robots.txt di inrecruiting.intervieweb.it vieta ``/*LAC*``; la deroga vale SOLO per questi clienti,
vedi sources/gemelli.py, gvm.py, synlab.py).

- Lista: pagina pubblica ``<host>/app.php?module=career`` (HTML lato server, 15 annunci per pagina; contiene
  ``#url-for-announces`` con i token CSRF della sessione e l'id di sezione). Le pagine 2..N sono una POST
  ``act1=vacancyListCareer`` (JSON ``{success, data: <html>}``) con lo stesso cookie di sessione.
- Dettaglio: ``<host>/jobs/<slug>-<id>/it/`` HTML lato server (``#description__vacancy-title``,
  ``#description__subtitle`` con Sede, ``#description__body`` con il testo).
Cortesia: >= 2 s tra le richieste, 1 richiesta per pagina di lista + 1 per ogni annuncio CLINICO nuovo
(l'annuncio non clinico si scarta dal titolo/funzione senza scaricarlo); cache su disco dei dettagli
(``INTERVIEWEB_CACHE``, in produzione data/intervieweb-cache.json); User-Agent OfferteSanitaBot.
"""
from __future__ import annotations

import copy
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text, norm

from . import _it_priv as P

DEFAULT_CACHE = Path(__file__).resolve().parent.parent / ".cache" / "intervieweb.json"
MIN_INTERVAL = 2.0
MAX_PAGES = 30
MAX_DETAIL_FETCH = 250

# Ruoli non clinici anche quando il titolo contiene parole sanitarie ("Coordinatore Retail Punti Prelievo",
# "Addetta accettazione", "Controller Ospedale", "Pulizie", ...).
_NOT_CLINICAL = re.compile(
    r"\bcontroller\b|controllo di gestione|amministrativ|contabil|segreteri|accettazione|accoglienza|\bcup\b|"
    r"assistenza clienti|customer|retail|\bmarketing|comunicazione|\bacquist|\bhr\b|human resources|"
    r"internship|\bstage\b|tirocin|sourcing|facilit|real estate|\bit\b|informatic|sistemi informativi|"
    r"pulizi|sanificazione|\bcameriere|ai piani|alberghier|^addett|^adett|impiegat|assistente personale|housekeep|hotel|magazzin|autista|"
    r"manutent|\blegal\b|\bfinance\b|business|developer|ingegner|project manager|ricercator|data (manager|scien)|"
    r"clinical (trial|research)|study coordinator|segretaria|portiere|barista|cuoc[oa]|ristorazione|"
    r"call center|telemarketing|ufficio|direttore generale|direttore (amministrativo|commerciale)|"
    r"coordinatore (retail|operativo|amministrativo|commerciale)|\bsales\b|recruit|brand|content|"
    r"^bando\b(?!.*\b(medic[oa]|infermier|fisioterap))|bioinformatic|data entry|database|specialista (di )?accoglienza|"
    r"process designer|buyer|executive assistant|head of|responsabile operativo",
    re.I,
)
# Titoli che il classificatore generico non riconosce ma sono clinici.
_TITLE_MAP: tuple[tuple[str, str], ...] = (
    (r"nutrizionist", "Nutrizione e dietistica"),
    (r"^tecnic[oi] (sanitari[oi] )?(di |del )?(laboratorio|radiolog|neurofisiopat|fisiopatolog|cardio)|\btsrm\b|\btslb\b", "Tecnici sanitari"),
    (r"^cardio(anestesista|logo)|^anestesista|^radiologo|^chirurgo|^ortopedico|^specialista in ", "Medicina"),
    (r"^(dirigente|aiuto|assistente) medico|^medico\b", "Medicina"),
    (r"coordinatore.{0,20}infermieristic|caposala|\binfermier", "Infermieristica"),
    (r"^operatore socio ?sanitari|^oss\b|\boss\b", "OSS"),
    (r"^educatore professionale", "Servizio sociale"),
)
# Fallback sulla "Professione/Funzione" dell'ATS (solo se il titolo non e' non-clinico).
_FUNCTION_MAP: tuple[tuple[str, str], ...] = (
    (r"^medico\b|personale medico", "Medicina"),
    (r"^infermier", "Infermieristica"),
    (r"^oss\b", "OSS"),
    (r"^fisioterapist", "Fisioterapia"),
    (r"tecnico di radiologia", "Tecnici sanitari"),
)


def career_page_info(html: str) -> dict:
    """Dalla prima pagina: URL ajax (con CSRF), id di sezione e numero di pagine."""
    ajax = re.search(r'id="url-for-announces"\s+value="([^"]+)"', html)
    section = re.search(r"['\"]section['\"]\s*:\s*['\"]([^'\"]+)['\"]", html)
    pages = re.search(r"Pagina\s+\d+\s+di\s+(\d+)", html)
    if not ajax or not section:
        raise ValueError("Intervieweb: pagina carriere senza url-for-announces/section (formato cambiato?)")
    return {
        "ajax_url": ajax.group(1).replace("&amp;", "&"),
        "section": section.group(1),
        "pages": int(pages.group(1)) if pages else 1,
    }


def _text(node) -> str:
    """Testo di un nodo senza le etichette per screen reader (``.sr-only``: "Sede", "Azienda", ...)."""
    if not node:
        return ""
    node = copy.copy(node)
    for hidden in node.select(".sr-only"):
        hidden.decompose()
    return re.sub(r"\s+", " ", node.get_text(" ")).strip()


def parse_list(html: str) -> list[dict]:
    """Annunci di una pagina di lista: titolo, url, sede, funzione."""
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []
    for box in soup.select(".vacancy__render"):
        link = box.select_one(".vacancy__title a[href*='/jobs/']")
        if link is None:
            continue
        info = {span.get("title"): _text(span) for span in box.select(".subtitle__informations")}
        rows.append({
            "url": link["href"].strip(),
            "title": _text(link.select_one("h3") or link),
            "place": info.get("Sede", ""),
            "function": info.get("Professione/Funzione", ""),
        })
    return rows


def job_id(url: str) -> str | None:
    m = re.search(r"[-_](\d+)/(?:[a-z]{2}/)?$", url.rstrip("/") + "/")
    return m.group(1) if m else None


def classify_row(row: dict) -> str | None:
    """Categoria clinica dell'app per un annuncio di lista, oppure None (non clinico, talent pool)."""
    title = row.get("title") or ""
    if not title or P.is_talent_pool(title) or _NOT_CLINICAL.search(title):
        return None
    profession = P.classify(title, _TITLE_MAP)
    if profession:
        return profession
    for pattern, label in _FUNCTION_MAP:
        if re.search(pattern, row.get("function") or "", re.I):
            return label
    return None


_ROLE_PREFIX = re.compile(r"^N\.?\s*\d+\s+(?:cococo|contratto[\w\s\-]*?)\s+per\s+(?:il ruolo di\s+)?", re.I)
_BANDO_ROLE = re.compile(r"^bando\b.*?\bper\s+n\.?\s*\d+\s+(.+?)(?:\s+con contratto|\s+cococo|\s+[-\u2013\u2014]\s|$)", re.I)
_DATE_RE = r"(\d{2})/(\d{2})/(\d{4})"


def clean_role_title(title: str) -> str:
    """Titoli da bando ("BANDO PNRR-... per N.1 MEDICO/A CON CONTRATTO cococo - ...") -> il ruolo."""
    title = re.sub(r"\s*_\s*", " - ", re.sub(r"\s+", " ", title or "")).strip()
    m = _BANDO_ROLE.match(title)
    if m:
        role = m.group(1).strip(" -")
        return f"{role[:1].upper()}{role[1:].lower()} - progetto di ricerca"
    stripped = _ROLE_PREFIX.sub("", title)
    return f"{stripped[:1].upper()}{stripped[1:]}" if stripped != title else title


def _date(label: str, text: str) -> str | None:
    m = re.search(label + r"[^\d\n]{0,40}" + _DATE_RE, text, re.I)
    if not m:
        return None
    try:
        return datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)), tzinfo=timezone.utc).isoformat()
    except ValueError:
        return None


def _future_date(label: str, text: str) -> str | None:
    """Scadenza (YYYY-MM-DD) solo se non e' gia' passata (i testi dei bandi sono spesso incoerenti)."""
    iso = _date(label, text)
    if iso and iso[:10] >= datetime.now(timezone.utc).date().isoformat():
        return iso[:10]
    return None


def _city_in_title(city: str, title: str) -> bool:
    """La citta' (o il suo primo termine: "Agrate" per "Agrate Brianza") e' gia' nel titolo?"""
    first = re.split(r"[\s'\u2019-]+", norm(city))[0]
    return len(first) >= 4 and first in norm(title)


def parse_detail(html: str, url: str, cfg: type, profession: str, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.select_one("#description__vacancy-title")
    body = soup.select_one("#description__body")
    ident = job_id(url)
    if h1 is None or body is None or not ident:
        skip("no_data")
        return None
    raw_title = _text(h1)
    if P.is_talent_pool(raw_title):
        skip("talent_pool")
        return None
    info = {span.get("title", "").strip(): _text(span) for span in soup.select("#description__subtitle .subtitle__informations")}
    place = re.sub(r",?\s*(Italia|Italy)$", "", info.get("Sede", ""), flags=re.I).strip(" ,")
    place = re.sub(r"^Rome\b", "Roma", place)
    description = P.clean_text(html_to_text(str(body)))
    # Le sezioni "Descrizione azienda" sono lunghe e uguali per tutti gli annunci: restano, ma il corpo
    # deve avere almeno un testo proprio.
    if len(description) < P.MIN_BODY:
        skip("thin")
        return None
    title = P.pretty_title(clean_role_title(raw_title))
    city = P.tidy_city(place.split(",")[0].strip()) if place else None
    district = "Italia"
    for segment in (place, raw_title):  # prima la Sede strutturata, poi la sigla "(BS)" nel titolo
        if segment:
            district = P.locate_in_segments([segment])[1]
            if district != "Italia":
                break
    if district == "Italia":
        skip("no_region")
        return None
    if city and not _city_in_title(city, title):
        title = f"{title} - {city}"
    contract = guess_contract(raw_title) or guess_contract(description[-700:]) or guess_contract(description)
    if contract == "Contratto":
        contract = None
    return JobPayload(
        title=title,
        company=cfg.company,
        location_district=district,
        location_concelho=city,
        profession=profession,
        specialty=None,
        sector=P.SECTOR,
        contract_type=contract,
        description=description[: P.MAX_DESCRIPTION],
        requirements=None,
        salary=None,
        application_url=url,
        source=cfg.slug,
        source_id=f"{cfg.slug}-{ident}",
        published_at=_date(r"data di pubblicazione", description),
        expires_at=_future_date(r"scadenza (?:presentazione )?(?:della )?domanda", description),
    )


CACHE_VERSION = 1  # alzare quando cambia il parser: le righe vecchie si riscaricano
CACHE_TTL = 7 * 86400  # un annuncio si rilegge almeno una volta a settimana (il testo puo' cambiare)


def cache_get(cache: dict, key: str) -> dict | None:
    row = cache.get(key)
    if not row or row.get("v") != CACHE_VERSION or time.time() - row.get("t", 0) > CACHE_TTL:
        return None
    return row


def cache_row(job: JobPayload | None) -> dict:
    return {"v": CACHE_VERSION, "t": int(time.time()), "job": job.__dict__ if job else None}


def _load_cache(path: Path) -> dict:
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def _save_cache(path: Path, cache: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(cache, ensure_ascii=False))
    tmp.replace(path)


class InterviewebScraper(BaseScraper):
    """Base: le sottoclassi impostano slug, name, company, career_url (e ``skip_titles`` opzionale)."""

    slug: str
    name: str
    company: str
    career_url: str
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def list_rows(self, client: HttpClient) -> list[dict]:
        first = client.get_text(self.career_url)
        info = career_page_info(first)
        rows = parse_list(first)
        for page in range(2, min(info["pages"], MAX_PAGES) + 1):
            resp = client.post_form_response(info["ajax_url"], {
                "act1": "vacancyListCareer", "section": info["section"], "order": "name", "page": page,
                "country": "", "region": "", "function": "", "project": "", "text": "", "division": "", "company": "",
            })
            resp.raise_for_status()
            data = resp.json()
            if not data.get("success"):
                raise ValueError(f"Intervieweb: pagina {page} senza success")
            rows += parse_list(data.get("data") or "")
        self.stats["pages"] = info["pages"]
        return rows

    def fetch(self) -> list[JobPayload]:
        cache_path = Path(os.environ.get("INTERVIEWEB_CACHE") or DEFAULT_CACHE)
        cache = _load_cache(cache_path)
        client = HttpClient(min_interval=MIN_INTERVAL)
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        live: dict = {}
        fetched = errors = 0
        complete = True
        try:
            rows = self.list_rows(client)
            self.stats["listed"] = len(rows)
            if not rows:  # lista vuota = formato cambiato o blocco: errore, mai "0 offerte" (soft-expire di tutto)
                raise ValueError("Intervieweb: lista annunci vuota")
            host = self.career_url.split("/app.php")[0]
            for row in rows:
                url = row["url"]
                if not url.startswith(host + "/") or "/jobs/" not in url or job_id(url) is None:
                    self.stats["bad_link"] = self.stats.get("bad_link", 0) + 1
                    continue
                profession = classify_row(row)
                if profession is None:
                    self.stats["not_clinical"] = self.stats.get("not_clinical", 0) + 1
                    continue
                key = f"{self.slug}:{job_id(url)}"
                if key in seen:
                    continue
                seen.add(key)
                cached = cache_get(cache, key)
                if cached is None:
                    if fetched >= MAX_DETAIL_FETCH:
                        complete = False
                        continue
                    fetched += 1
                    try:
                        html = client.get_text(url)
                    except Exception:  # noqa: BLE001
                        errors += 1
                        complete = False
                        continue
                    job = parse_detail(html, url, type(self), profession, self.stats)
                    cached = cache_row(job)
                live[key] = cached
                if cached.get("job"):
                    jobs.append(JobPayload(**cached["job"]))
        finally:
            client.close()
            # Solo gli annunci ancora in lista restano in cache; mai svuotarla se la lista e' fallita.
            if live:
                merged = {k: v for k, v in cache.items() if not k.startswith(self.slug + ":")}
                merged.update(live)
                _save_cache(cache_path, merged)
        self.last_listings_complete = complete and errors <= max(1, len(seen) // 10)
        self.stats.update(fetched=fetched, errors=errors, published=len(jobs))
        return jobs
