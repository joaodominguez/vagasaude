"""Apoteca Natura (rete di farmacie): bacheca https://job.apotecanatura.it/offerte (Drupal).

Elenco HTML lato server con 10 annunci per pagina (``?page=N``); ogni scheda ha ruolo, sede (citta' + sigla), date di
validita' (``<time datetime>``) e, nella pagina di dettaglio, mansioni, requisiti, contratto e benefit. Quasi tutti i titoli
dicono "Farmacista Collaboratore/Collaboratrice FARMACIA X - Candidatura Spontanea": sono annunci reali per farmacia (con
data di scadenza), quindi QUESTA fonte e' esentata dal filtro talent-pool (vedi ``_it_priv.TALENT_POOL_EXEMPT_SOURCES``) e il
titolo viene ricostruito: "Farmacista collaboratore/a - Farmacia X, Citta'". Annunci scaduti (validita' finita) esclusi;
la scheda generica "Candidatura spontanea" senza sede resta fuori. robots.txt (Drupal): solo /media/oembed vietato.
User-agent onesto, >= 2 s tra le richieste; il dettaglio si scarica solo per gli annunci ancora validi.
"""
from __future__ import annotations

import html as htmllib
import re
import ssl
from datetime import datetime, timezone
from pathlib import Path

import certifi
import httpx
from bs4 import BeautifulSoup

from common.http import DEFAULT_HEADERS, HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text, slugify

from . import _it_priv as P

BASE = "https://job.apotecanatura.it"
LIST_URL = BASE + "/offerte"
COMPANY = "Apoteca Natura"
SLUG = "apoteca-natura"
MAX_PAGES = 6
# O servidor so envia o certificado folha (falta o intermedio "Actalis Domain Validation Server CA G3", assinado pela
# Actalis Authentication Root CA, ja no certifi): a verificacao TLS NAO se desativa; junta-se o intermedio publico
# (descarregado do AIA do certificado) ao trust store.
INTERMEDIATE = Path(__file__).resolve().parent.parent / "common" / "certs" / "actalis_dv_g3.pem"
_PLACE_RE = re.compile(r"^(.*?)\s*\(([A-Z]{2})\)\s*$")
_ROLE_PREFIX = re.compile(r"^(?:(?:farmacista|commess[oa]|addett[oa]|banconist[ae]|collaborator[ei]|collaboratrice|di farmacia|alla vendita|/)\s*)+", re.I)
_SPONT_TAIL = re.compile(r"\s*[-–]?\s*candidatura spontanea\s*$", re.I)


def _client() -> HttpClient:
    """HttpClient (mesmo UA e throttle) com verificacao TLS completa + intermedio em falta no site."""
    context = ssl.create_default_context(cafile=certifi.where())
    context.load_verify_locations(cafile=str(INTERMEDIATE))
    client = HttpClient(min_interval=2.0)
    client.client.close()
    client.client = httpx.Client(timeout=30.0, headers=DEFAULT_HEADERS, follow_redirects=True, verify=context)
    return client


def _dt(value: str | None) -> datetime | None:
    iso = P.iso_datetime(value)
    return datetime.fromisoformat(iso) if iso else None


def pharmacy_name(raw_title: str) -> str | None:
    """"Farmacista Collaboratore/Collaboratrice FARMACIA CIPOLLA - Candidatura Spontanea" -> "Farmacia Cipolla"."""
    name = _ROLE_PREFIX.sub("", htmllib.unescape(raw_title or "").strip())
    name = _SPONT_TAIL.sub("", name).strip(" -–")
    if not name:
        return None
    name = re.sub(r"\b([DL]')([a-z])", lambda m: m.group(1) + m.group(2).upper(), P.pretty_title(name))
    return name if re.match(r"farmacia\b", name, re.I) else f"Farmacia {name}"


def build_title(raw_title: str, role: str | None, city: str | None) -> str:
    """Titolo chiaro dal contenuto: ruolo reale + farmacia + citta'."""
    pharmacy = pharmacy_name(raw_title)
    blob = f"{raw_title} {role or ''}"
    if re.search(r"commess|addett|banconist", blob, re.I):
        base = "Commesso/a di farmacia"
    elif re.search(r"collaborat", blob, re.I):
        base = "Farmacista collaboratore/a"
    else:
        base = "Farmacista (candidatura spontanea)"
    where = ", ".join(x for x in (pharmacy, city) if x)
    return f"{base} - {where}" if where else base


def parse_list(html: str) -> list[dict]:
    rows: list[dict] = []
    for card in BeautifulSoup(html, "html.parser").select("div.card"):
        a = card.select_one("h2.card-title a[href]")
        if not a:
            continue
        times = [t.get("datetime") for t in card.select("span.validity time")]
        loc = card.select_one("span.location")
        sub = card.select_one(".card-subtitle")
        rows.append({
            "href": a["href"],
            "title": a.get_text(" ", strip=True),
            "start": times[0] if times else None,
            "end": times[1] if len(times) > 1 else (times[0] if times else None),
            "location": loc.get_text(" ", strip=True) if loc else "",
            "role": sub.get_text(" ", strip=True) if sub else None,
        })
    return rows


def parse_body(html: str) -> str:
    body = BeautifulSoup(html, "html.parser").select_one(".field--name-body")
    if not body:
        return ""
    text = html_to_text(str(body))
    text = re.sub(r"\n[^\n]*Le Farmacie Apoteca Natura si impegnano per la diversit.*", "", text, flags=re.S)
    return P.clean_text(text)


def _abs(href: str) -> str:
    return BASE + href if href.startswith("/") else href


def build_job(row: dict, body: str, now: datetime, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    raw_title = htmllib.unescape(row["title"])
    # Fonte esentata dal filtro talent-pool (altrimenti "Candidatura Spontanea" cadrebbe qui).
    if P.is_talent_pool(raw_title, source=SLUG):
        skip("talent_pool")
        return None
    end = _dt(row.get("end"))
    if end is None or end < now:
        skip("expired")
        return None
    location = htmllib.unescape(row["location"]).replace("’", "'").strip()
    place = _PLACE_RE.match(location)
    city = P.tidy_city(place.group(1)) if place else None
    region = P.region_label(location, None)
    if region == "Italia":
        skip("no_region")
        return None
    pharmacy = pharmacy_name(raw_title)
    if not pharmacy:
        skip("no_pharmacy")  # scheda generica "Candidatura spontanea" senza farmacia
        return None
    if len(body) < P.MIN_BODY:
        skip("thin")
        return None
    contract = guess_contract(body[:1500])
    if contract in ("Contratto", "Turni"):
        contract = None
    slug = row["href"].rstrip("/").rsplit("/", 1)[-1]
    return JobPayload(
        title=build_title(raw_title, row.get("role"), city),
        company=COMPANY,
        location_district=region,
        location_concelho=city,
        profession="Farmacia",
        specialty=None,
        sector=P.SECTOR,
        contract_type=contract,
        description=f"Farmacia: {pharmacy}\n\n{body}"[: P.MAX_DESCRIPTION],
        requirements=None,
        salary=None,
        application_url=_abs(row["href"]),
        source=SLUG,
        source_id=f"apoteca-natura-{slugify(slug)[:90]}",
        published_at=P.iso_datetime(row.get("start")),
        expires_at=end.isoformat(),
    )


class ApotecaNaturaScraper(BaseScraper):
    slug = SLUG
    name = "Apoteca Natura - Offerte di lavoro"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = _client()
        now = datetime.now(timezone.utc)
        jobs: list[JobPayload] = []
        rows: list[dict] = []
        errors = 0
        first_ok = False
        try:
            for page in range(MAX_PAGES):
                try:
                    chunk = parse_list(client.get_text(LIST_URL, params={"page": page}))
                except Exception:  # noqa: BLE001
                    errors += 1
                    break
                first_ok = first_ok or page == 0
                new = [r for r in chunk if all(r["href"] != x["href"] for x in rows)]
                if not new:
                    break
                rows += new
            self.stats["listed"] = len(rows)
            for row in rows:
                end = _dt(row.get("end"))
                if end is None or end < now:
                    self.stats["expired"] = self.stats.get("expired", 0) + 1
                    continue
                try:
                    body = parse_body(client.get_text(_abs(row["href"])))
                except Exception:  # noqa: BLE001
                    errors += 1
                    continue
                job = build_job(row, body, now, self.stats)
                if job and all(job.source_id != j.source_id for j in jobs):
                    jobs.append(job)
        finally:
            client.close()
        self.last_listings_complete = first_ok and errors == 0
        self.stats["errors"] = errors
        self.stats["published"] = len(jobs)
        return jobs
