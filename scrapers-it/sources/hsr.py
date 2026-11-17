"""IRCCS Ospedale San Raffaele (HSR, Milano; Gruppo San Donato): elenco su hsr.it, schede su Allibo ``ats3``.

* Elenco: https://www.hsr.it/lavora-con-noi (HTML lato server: ~310 link ``joblink.allibo.com/ats3/job-offer.aspx``
  con il titolo nel testo del link; quasi tutti bandi di ricerca PNRR/PNC). Il Gruppo San Donato / HSR ha
  AUTORIZZATO la raccolta (2026-11-17).
* Schede: stesso parser di sources/_allibo.py (robots di joblink.allibo.com: ``Allow: /``).
* NON REGISTRATO in sources/__init__.py: dal VPS (91.99.167.243) www.hsr.it risponde 403 (WAF). Serve
  l'allowlist dell'IP del VPS da parte di HSR; finche' non c'e', la fonte si prova solo da un IP autorizzato
  (``python3 run.py`` con ``--source hsr`` dopo averla registrata). Nessun proxy ne' aggiramento.
* Pre-filtro sul titolo (niente scheda per i ruoli non clinici: ricerca di base, data, study coordinator...).
  Cache su disco delle schede (``INTERVIEWEB_CACHE``, stessa del connettore Intervieweb).
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload

from . import _allibo as A
from . import _it_priv as P
from ._intervieweb import DEFAULT_CACHE, MIN_INTERVAL, _load_cache, _save_cache, cache_get, cache_row

LIST_URL = "https://www.hsr.it/lavora-con-noi"
MAX_DETAIL_FETCH = 250
# Ricerca di base e ruoli di supporto alla ricerca, anche se il titolo contiene "Biologo"/"Medico".
_NOT_CLINICAL_HSR = re.compile(
    r"ricercator|post ?-?doc|research|bioinformatic|biostatistic|data (manager|scien|analyst|steward)|"
    r"study coordinator|clinical trial|project manager|tecnico di ricerca|technician|dottorand|phd|"
    r"informatic|ingegner|amministrativ|segretari|contabil|addett|borsista|borsa di studio per (laureat|ricerca)",
    re.I,
)


def list_items(html: str) -> list[dict]:
    """Annunci dell'elenco hsr.it: dict compatibili con sources/_allibo.parse_detail (Title, DetailLink)."""
    soup = BeautifulSoup(html, "html.parser")
    items: list[dict] = []
    seen: set[str] = set()
    for a in soup.select("a[href*='joblink.allibo.com/ats3/job-offer.aspx']"):
        link = a["href"].strip()
        ident = (parse_qs(urlparse(link).query).get("ID") or [""])[0]
        title = re.sub(r"\s+", " ", a.get_text(" ")).strip()
        if not ident or not title or ident in seen:
            continue
        seen.add(ident)
        items.append({"Title": title, "DetailLink": link})
    return items


def prefilter(title: str) -> str | None:
    if _NOT_CLINICAL_HSR.search(title) or A._NOT_CLINICAL.search(title) or P.is_talent_pool(title):
        return None
    return P.classify(P.pretty_title(title), A._TITLE_MAP)


class HsrScraper(BaseScraper):
    slug = "hsr"
    name = "IRCCS San Raffaele - Lavora con noi"
    company = "IRCCS Ospedale San Raffaele"
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
        complete = True
        try:
            items = list_items(client.get_text(LIST_URL))
            self.stats["listed"] = len(items)
            for item in items:
                if prefilter(item["Title"]) is None:
                    self.stats["not_clinical"] = self.stats.get("not_clinical", 0) + 1
                    continue
                ident = parse_qs(urlparse(item["DetailLink"]).query)["ID"][0]
                key = f"{self.slug}:{ident}"
                cached = cache_get(cache, key)
                if cached is None:
                    if fetched >= MAX_DETAIL_FETCH:
                        complete = False
                        continue
                    fetched += 1
                    try:
                        html = client.get_text(item["DetailLink"])
                    except Exception:  # noqa: BLE001
                        errors += 1
                        complete = False
                        continue
                    job = A.parse_detail(html, item, type(self), self.stats)
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
        self.last_listings_complete = complete and errors <= max(1, len(live) // 10)
        self.stats.update(fetched=fetched, errors=errors, published=len(jobs))
        return jobs
