"""Gruppo San Donato (GSD: Istituto Clinico Sant'Anna, Policlinico San Donato, Sant'Ambrogio, ICCB, ...).

* Elenco: ``https://www.grupposandonato.it/sitemap.xml`` (un solo file) -> pagine
  ``/lavora-con-noi/<categoria>/<slug>``; solo le categorie cliniche (medico, infermiere, tecnico di
  radiologia/laboratorio, biologo, fisioterapista, OSS, farmacista, ...).
* Scheda: HTML lato server (``h1.title-page``, ``div.c-text`` con "Dove?" e "Dettagli lavorativi"). Il robots.txt
  non vieta ``/lavora-con-noi``. Il Gruppo San Donato ha AUTORIZZATO la raccolta (2026-11-17).
* NON REGISTRATO in sources/__init__.py: dal VPS (91.99.167.243) il sito risponde 403 (WAF) anche per la
  sitemap. Serve l'allowlist dell'IP del VPS da parte di GSD; da un IP autorizzato basta registrarlo.
  Nessun proxy ne' aggiramento.
* >= 2 s tra le richieste; ~50 schede per giro (cache su disco, ``INTERVIEWEB_CACHE``).
"""
from __future__ import annotations

import os
import re
from pathlib import Path

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text

from . import _it_priv as P
from ._intervieweb import DEFAULT_CACHE, MIN_INTERVAL, _load_cache, _save_cache, cache_get, cache_row

SITEMAP = "https://www.grupposandonato.it/sitemap.xml"
BASE = "https://www.grupposandonato.it"
CLINICAL_CATEGORIES = {
    "medico", "infermiere", "coordinatore-infermieristico", "tecnico-di-radiologia", "tecnico-di-laboratorio",
    "tecnico-sanitario", "biologo", "fisioterapista", "oss", "farmacista",
}
_TITLE_MAP = (
    (r"^tecnico|\btsrm\b", "Tecnici sanitari"),
    (r"^coordinatore.{0,20}infermieristic|^infermier", "Infermieristica"),
    (r"^operatore socio|^oss\b", "OSS"),
)
_NOT_CLINICAL = re.compile(r"stage|tirocin|amministrativ|informatic|ingegner|ricercator|data manager|\bit\b", re.I)


def job_urls(xml: str) -> list[tuple[str, str]]:
    """(categoria, url) delle schede (profondita' 2) nelle categorie cliniche."""
    out: list[tuple[str, str]] = []
    for loc in re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml):
        m = re.fullmatch(re.escape(BASE) + r"/lavora-con-noi/([a-z0-9-]+)/([a-z0-9-]+)", loc)
        if m and m.group(1) in CLINICAL_CATEGORIES and (m.group(1), loc) not in out:
            out.append((m.group(1), loc))
    return out


# Strutture GSD: (regex sul titolo/testo, citta', sigla). Molte schede non hanno un indirizzo ("Dove?").
FACILITIES: tuple[tuple[str, str, str], ...] = (
    (r"citt[aà] di brescia|iccb\b", "Brescia", "BS"),
    (r"sant.?\s?anna|icsan\b", "Brescia", "BS"),
    (r"san rocco|icsr\b", "Ome", "BS"),
    (r"beato matteo|icbm\b", "Vigevano", "PV"),
    (r"policlinico san marco|\bpsm\b", "Zingonia", "BG"),
    (r"policlinico san pietro|\bpsp\b", "Ponte San Pietro", "BG"),
    (r"policlinico san donato|\bpsd\b", "San Donato Milanese", "MI"),
    (r"sant.?\s?ambrogio|galeazzi|ogsa|icsa\b", "Milano", "MI"),
    (r"citt[aà] studi", "Milano", "MI"),
    (r"villa aprica", "Como", "CO"),
    (r"villa erbosa", "Bologna", "BO"),
)
_CAP_RE = re.compile(
    r"\b\d{5},?\s+([A-ZÀ-Ý][^()\n\d,;]*?)(?:\s+([A-Z]{2}))?\s*(?:\(([^)]*)\))?\s*(?:\n|$|[-\u2013,;])"
)


def _where(title: str, body) -> tuple[str | None, str | None]:
    """(citta', sigla): prima "CAP Citta' (PR)" dopo "Dove?", poi la struttura nominata nel titolo o nel testo."""
    text = body.get_text("\n")
    m = re.search(r"\bDove\??\s*", text)
    if m:
        hit = _CAP_RE.search(text[m.end(): m.end() + 400])
        if hit:
            sig = hit.group(2) or (hit.group(3).upper() if hit.group(3) and len(hit.group(3)) == 2 else None)
            return hit.group(1).strip(" ,.-"), sig
    haystack = f"{title}\n{text[:900]}".lower()
    for pattern, city, sig in FACILITIES:
        if re.search(pattern, haystack):
            return city, sig
    return None, None


def parse_detail(html: str, url: str, category: str, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.select_one("h1.title-page")
    body = soup.select_one("div.c-text")
    if h1 is None or body is None:
        skip("no_data")
        return None
    raw_title = re.sub(r"\s+", " ", h1.get_text(" ")).strip()
    if not raw_title or P.is_talent_pool(raw_title) or _NOT_CLINICAL.search(raw_title):
        skip("not_clinical")
        return None
    title = P.pretty_title(raw_title)
    profession = P.classify(title, _TITLE_MAP)
    if profession is None:
        skip("not_clinical")
        return None
    description = P.clean_text(html_to_text(str(body)))
    if len(description) < P.MIN_BODY:
        skip("thin")
        return None
    city_raw, sigla = _where(raw_title, body)
    segment = f"{city_raw} ({sigla})" if city_raw and sigla else (city_raw or "")
    city, district = P.locate_in_segments([segment] if segment else [])
    if district == "Italia":
        skip("no_region")
        return None
    city = P.tidy_city(city or city_raw)
    if city and city.lower() not in title.lower():
        title = f"{title} - {city}"
    contract_line = re.search(r"Tipo di contratto:\s*([^\n]+)", description)
    contract = guess_contract(contract_line.group(1) if contract_line else None) or guess_contract(description)
    if contract == "Contratto":
        contract = None
    slug = url.rsplit("/", 1)[-1]
    return JobPayload(
        title=title,
        company=GsdScraper.company,
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
        source=GsdScraper.slug,
        source_id=f"gsd-{slug}",
        published_at=None,
    )


class GsdScraper(BaseScraper):
    slug = "gsd"
    name = "Gruppo San Donato - Lavora con noi"
    company = "Gruppo San Donato"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        cache_path = Path(os.environ.get("INTERVIEWEB_CACHE") or DEFAULT_CACHE)
        cache = _load_cache(cache_path)
        client = HttpClient(min_interval=MIN_INTERVAL)
        jobs: list[JobPayload] = []
        live: dict = {}
        fetched = errors = 0
        try:
            entries = job_urls(client.get_text(SITEMAP))
            self.stats["sitemap"] = len(entries)
            for category, url in entries:
                key = f"{self.slug}:{url.rsplit('/', 1)[-1]}"
                cached = cache_get(cache, key)
                if cached is None:
                    fetched += 1
                    try:
                        html = client.get_text(url)
                    except Exception:  # noqa: BLE001
                        errors += 1
                        continue
                    job = parse_detail(html, url, category, self.stats)
                    cached = cache_row(job)
                live[key] = cached
                if cached.get("job"):
                    jobs.append(JobPayload(**cached["job"]))
        finally:
            client.close()
            if live:
                merged = {k: v for k, v in cache.items() if not k.startswith(self.slug + ":")}
                merged.update(live)
                _save_cache(cache_path, merged)
        self.last_listings_complete = errors <= max(1, len(live) // 10)
        self.stats.update(fetched=fetched, errors=errors, published=len(jobs))
        return jobs
