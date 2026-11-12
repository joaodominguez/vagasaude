"""Clariane Italia (ex Korian): RSA, hospice, case di cura e poliambulatori.

Sito carriere WordPress (carriere.clariane.it): ``korian-jobs-sitemap.xml`` (~215 URL, molti
vecchi) e, in ogni scheda ``/dettagli-posizione/<slug>-<anno>-<id>/``, JSON-LD ``JobPosting``
con titolo, ``datePosted``, regione (``addressRegion``) e descrizione HTML. Non c'e'
``validThrough``: restano solo gli annunci pubblicati/aggiornati negli ultimi 60 giorni (se il
JSON-LD avesse ``validThrough`` conta quello). robots.txt (Yoast) non blocca le schede.
Ruoli clinici: medici, infermieri, OSS, fisioterapisti, terapisti, educatori, assistenti sociali.
>= 1 s tra le richieste.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text

from . import _it_priv as P

SITEMAP = "https://carriere.clariane.it/korian-jobs-sitemap.xml"
COMPANY = "Clariane (Korian)"
MAX_AGE_DAYS = 60
_NOT_CLINICAL = re.compile(
    r"manutenz|installazione|cuoc[oa]|ristorazione|parrucch|servizi generali|care manager|"
    r"\bamministrativ|\bcontabil|\bhr\b|risorse umane|impiegat|autista|lavanderia|pulizie|addett[oa] (alla )?(cucina|mensa)",
    re.I,
)
_TITLE_MAP: tuple[tuple[str, str], ...] = (
    (r"^(area|responsabile|direttore|aiuto) (medic|sanitari)|^medico\b|^dermatologo\b", "Medicina"),
    (r"^area infermieristica", "Infermieristica"),
)
# "Per la nostra RSA ... situata a Lanzo (TO)": citta' solo se la descrizione la dice.
_CITY_RE = re.compile(r"\b([A-ZÀ-Ý][\wàèéìòù'’]+(?: [A-ZÀ-Ý][\wàèéìòù'’]+){0,2})\s*\(([A-Z]{2})\)")
_FACILITY_RE = re.compile(
    r"fondazione|\brsa\b|casa|residenza|istituto|centro|villa|hospice|poliambulatori|clinica|korian|clariane|"
    r"campus|ospedale|societ|gruppo|\bsrl\b|\bspa\b|\bcdc\b|\bihg\b|\bsad\b|\badi\b",
    re.I,
)
_JUNK_LINES = {"stellenbeschreibung"}


def parse_sitemap(xml: str) -> list[tuple[str, str | None]]:
    """[(url, lastmod ISO)] delle sole schede ``/dettagli-posizione/<slug>/``."""
    rows: list[tuple[str, str | None]] = []
    seen: set[str] = set()
    for block in re.findall(r"<url>.*?</url>", xml, re.S):
        loc = re.search(r"<loc>\s*([^<]+?)\s*</loc>", block)
        if not loc or "/dettagli-posizione/" not in loc.group(1) or loc.group(1) in seen:
            continue
        seen.add(loc.group(1))
        lastmod = re.search(r"<lastmod>\s*([^<]+?)\s*</lastmod>", block)
        rows.append((loc.group(1), lastmod.group(1) if lastmod else None))
    return rows


def _city(text: str) -> str | None:
    from common.normalize import guess_district

    for name, sigla in _CITY_RE.findall(text):
        # Solo citta' note ("Lanzo (TO)"): niente nomi di strutture come "Fondazione Borghi (VA)".
        if _FACILITY_RE.search(name):
            continue
        if guess_district(None, f"({sigla})") != "Italia":
            return name
    return None


def parse_detail(html: str, url: str, now: datetime | None = None, stats: dict | None = None) -> JobPayload | None:
    now = now or datetime.now(timezone.utc)
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    posting = P.job_posting(html)
    if not posting:
        skip("no_data")
        return None
    title = re.sub(r"\s+", " ", posting.get("title") or "").strip()
    title = re.sub(r"(\s*\bM\s*/\s*F\b)+\s*$", "", title, flags=re.I).strip(" -–")
    if not title:
        skip("no_data")
        return None
    if title.isupper() and len(title) > 5:  # "AIUTO MEDICO" -> "Aiuto medico"
        title = title.capitalize()
    if P.is_talent_pool(title):
        skip("talent_pool")
        return None
    posted = P.iso_datetime(posting.get("datePosted"))
    valid = P.iso_datetime(posting.get("validThrough"))
    if valid:
        if datetime.fromisoformat(valid) < now:
            skip("expired")
            return None
    elif not posted or datetime.fromisoformat(posted) < now - timedelta(days=MAX_AGE_DAYS):
        skip("stale")
        return None
    profession = None if _NOT_CLINICAL.search(title) else P.classify(title, _TITLE_MAP)
    if profession is None:
        skip("not_clinical")
        return None
    loc = posting.get("jobLocation") or {}
    if isinstance(loc, list):
        loc = loc[0] if loc else {}
    address = loc.get("address") or {}
    if not P.is_italy(address.get("addressCountry")):
        skip("not_italy")
        return None
    body = html_to_text(posting.get("description"))
    body = "\n".join(ln for ln in body.splitlines() if ln.strip().lower() not in _JUNK_LINES)
    structure = (loc.get("name") or "").strip()
    city = (address.get("addressLocality") or "").strip().title() or _city(body)
    district = P.region_label(city, address.get("addressRegion"))
    if district == "Italia":
        skip("no_region")
        return None
    text = P.clean_text(body)
    if len(text) < P.MIN_BODY:
        skip("thin")
        return None
    if structure and structure.lower() not in {"sede"}:
        text = f"Struttura: {structure}\n\n{text}"
    # Titolo pagina: <h1>OSS M/F Contratto a tempo determinato</h1>
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S | re.I)
    h1_text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", h1.group(1))).strip() if h1 else ""
    contract = guess_contract(f"{title} {h1_text}") or guess_contract(body[:1500])
    if contract in (None, "Contratto"):
        contract = {"FULL_TIME": "Full-time", "PART_TIME": "Part-time"}.get(str(posting.get("employmentType")).upper())
    ident = (posting.get("identifier") or {}).get("value") or url.rstrip("/").split("-")[-1]
    return JobPayload(
        title=title,
        company=COMPANY,
        location_district=district,
        location_concelho=city,
        profession=profession,
        specialty=None,
        sector=P.SECTOR,
        contract_type=contract,
        description=text[: P.MAX_DESCRIPTION],
        requirements=None,
        salary=None,
        application_url=url,
        source=ClarianeScraper.slug,
        source_id=f"clariane-{ident}",
        published_at=posted,
        expires_at=valid[:10] if valid else None,
    )


class ClarianeScraper(BaseScraper):
    slug = "clariane"
    name = "Clariane Italia - Carriere"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        now = datetime.now(timezone.utc)
        jobs: list[JobPayload] = []
        errors = 0
        urls: list[tuple[str, str | None]] = []
        try:
            urls = parse_sitemap(client.get_text(SITEMAP))
            self.stats["sitemap"] = len(urls)
            for url, lastmod in urls:
                # lastmod >= datePosted: una scheda non toccata da 60+ giorni e' sicuramente vecchia.
                stamp = P.iso_datetime(lastmod)
                if stamp and datetime.fromisoformat(stamp) < now - timedelta(days=MAX_AGE_DAYS):
                    self.stats["stale"] = self.stats.get("stale", 0) + 1
                    continue
                try:
                    html = client.get_text(url)
                except Exception:  # noqa: BLE001
                    errors += 1
                    continue
                job = parse_detail(html, url, now, self.stats)
                if job:
                    jobs.append(job)
        finally:
            client.close()
        self.last_listings_complete = errors <= max(2, len(urls) // 10)
        self.stats["errors"] = errors
        self.stats["published"] = len(jobs)
        return jobs
