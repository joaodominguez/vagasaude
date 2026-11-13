"""Randstad Healthcare (agenzia per il lavoro) — PILOTA agenzie, approvato dal proprietario il 2026-11-13.

* Elenco: sitemap pubbliche ``/sitemaps/jobs/it/sitemap-jobdetails.xml`` e ``-2.xml`` (~10.000 offerte di
  tutti i settori). robots.txt: ``Allow: /``; vieta solo filtri di ricerca (km/postcode/...), /job-redirect/ e
  l'apply-proxy, che non usiamo.
* Pre-filtro sullo slug dell'URL (parole sanitarie) per non chiedere migliaia di pagine; poi, per ogni
  pagina, JobPosting JSON-LD completo (``industry``, descrizione, responsabilita', requisiti, luogo,
  ``validThrough``, ``baseSalary``).
* Regole del pilota: solo ``industry == "Sanità"`` e professione clinica; testo integrale; l'offerta e'
  dichiarata come annuncio di AGENZIA (azienda "Randstad Healthcare (agenzia per il lavoro)" e prima riga
  della descrizione); la citta' entra nel titolo, cosi' lo stesso annuncio in citta' diverse non e'
  scambiato per un duplicato.
* Cache su disco per URL (l'uuid nell'URL e' immutabile): a ogni giro si scaricano solo le offerte nuove.
  ``RANDSTAD_CACHE`` per cambiare il percorso (in produzione: data/randstad-cache.json).
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text

from . import _it_priv as P

SITEMAPS = (
    "https://www.randstad.it/sitemaps/jobs/it/sitemap-jobdetails.xml",
    "https://www.randstad.it/sitemaps/jobs/it/sitemap-jobdetails-2.xml",
)
COMPANY = "Randstad Healthcare (agenzia per il lavoro)"
AGENCY_LINE = (
    "Offerta pubblicata da Randstad Healthcare, agenzia per il lavoro, per conto di una struttura cliente."
)
DEFAULT_CACHE = Path(__file__).resolve().parent.parent / ".cache" / "randstad.json"
MAX_FETCH = 700

# Slug (parte prima di "_citta_uuid"): solo profili sanitari/sociosanitari.
_SLUG_HEALTH = re.compile(
    r"(^|-)(oss|asa|infermier\w*|fisioterapist\w*|logoped\w*|ostetric\w*|farmacist\w*|medic[oi]|"
    r"psicolog\w*|educator\w*-professional\w*|tecnic\w*-(di-)?(radiolog\w*|laborator\w*|sanitari\w*|riabilitaz\w*|neurofisiopatolog\w*)|"
    r"terapist\w*|dietist\w*|odontoiatr\w*|igienist\w*|assistente-alla-poltrona|ortottist\w*|podolog\w*|"
    r"audioprotesist\w*|operator\w*-socio-sanitari\w*|operatore-socio-assistenziale|ausiliari\w*-socio)(-|$)"
)
_TITLE_MAP = (
    (r"\bASA\b|ausiliari\w* socio", "OSS"),
    (r"assistente alla poltrona|igienista dentale", "Odontoiatria"),
    (r"educatore professionale", "Logopedia e riabilitazione"),
)
_EMPLOYMENT = {"FULL_TIME": "Full-time", "PART_TIME": "Part-time", "TEMPORARY": "Tempo determinato",
               "CONTRACTOR": "Libero professionale"}
_BOILERPLATE = re.compile(r"^(il presente annuncio è rivolto|ti preghiamo di leggere l.informativa)", re.I)


_GENDER_RE = re.compile(r"\s*\(?\b[fmn]{1,2}\s*/\s*[fmn]{1,2}(?:\s*/\s*nb)?\b\)?", re.I)
_KEEP_UPPER = {"OSS", "ASA", "RSA", "SAD", "CRA", "ASP", "RSD", "CDI", "ADI", "UTIC", "TSRM", "LP", "ASL", "ASST", "IRCCS", "AO", "AOU"}


def clean_title(title: str) -> str:
    """Toglie i marcatori di genere (F/M/NB), gli underscore e le parole TUTTE MAIUSCOLE (tranne le sigle)."""
    t = _GENDER_RE.sub(" ", title or "").replace("_", " ")
    t = re.sub(r"\(\s*\)", " ", t)

    def fix(m: re.Match) -> str:
        w = m.group(0)
        return w if w in _KEEP_UPPER or len(w) <= 3 else w.capitalize()

    t = re.sub(r"\b[A-ZÀ-Ý]{2,}\b", fix, t)
    t = re.sub(r"\s+", " ", t).strip(" -–")
    return t[:1].upper() + t[1:]


def job_urls(xml: str) -> list[str]:
    return re.findall(r"<loc>\s*(https://www\.randstad\.it/offerte-lavoro/[^<\s]+)\s*</loc>", xml)


def is_health_slug(url: str) -> bool:
    slug = url.rstrip("/").rsplit("/", 1)[-1].split("_", 1)[0].lower()
    return bool(_SLUG_HEALTH.search(slug))


def _salary(posting: dict) -> str | None:
    base = posting.get("baseSalary") or {}
    value = (base.get("value") or {}) if isinstance(base, dict) else {}
    amount = value.get("value") if isinstance(value, dict) else None
    unit = str((value or {}).get("unitText") or "").upper()
    if not isinstance(amount, (int, float)) or amount <= 0:
        return None
    euros = f"{amount:,.0f}".replace(",", ".")
    per = {"YEAR": "lordi annui", "MONTH": "lordi mensili", "HOUR": "lordi l'ora", "DAY": "lordi al giorno"}.get(unit)
    return f"{euros} € {per}" if per else None


def parse_job(html: str, url: str, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    posting = P.job_posting(html)
    if not posting:
        skip("no_jsonld")
        return None
    if str(posting.get("industry") or "").strip().lower() != "sanità":
        skip("not_sanita")
        return None
    raw_title = re.sub(r"\s+", " ", posting.get("title") or "").strip()
    if not raw_title or P.is_talent_pool(raw_title):
        skip("talent_pool_or_empty")
        return None
    profession = P.classify(raw_title, _TITLE_MAP)
    if not profession:
        skip("not_clinical")
        return None
    address = ((posting.get("jobLocation") or {}).get("address") or {}) if isinstance(posting.get("jobLocation"), dict) else {}
    if not P.is_italy(address.get("addressCountry")):
        skip("not_italy")
        return None
    city = P.tidy_city((address.get("addressLocality") or "").strip() or None)
    district = P.region_label(city, address.get("addressRegion"))
    if district == "Italia":
        skip("no_region")
        return None
    parts = [AGENCY_LINE]
    for field in ("description", "responsibilities", "qualifications"):
        text = P.clean_text(html_to_text(posting.get(field)))
        if text:
            parts.append("\n".join(ln for ln in text.splitlines() if not _BOILERPLATE.match(ln.strip())))
    description = "\n\n".join(parts).strip()
    if len(description) - len(AGENCY_LINE) < P.MIN_BODY:
        skip("thin")
        return None
    types = posting.get("employmentType") or []
    types = [types] if isinstance(types, str) else types
    contract = guess_contract(f"{raw_title} {description[:800]}")
    if contract in (None, "Contratto"):
        contract = next((_EMPLOYMENT[t] for t in types if t in _EMPLOYMENT), None)
    ident = ((posting.get("identifier") or {}).get("value") if isinstance(posting.get("identifier"), dict) else None)
    uuid = re.search(r"_([0-9a-f]{8}-[0-9a-f-]{27,})/?$", url)
    base_title = clean_title(raw_title)
    title = f"{base_title} – {city}" if city and city.lower() not in raw_title.lower() else base_title
    valid = posting.get("validThrough")
    return JobPayload(
        title=title,
        company=COMPANY,
        location_district=district,
        location_concelho=city,
        profession=profession,
        specialty=None,
        sector=P.SECTOR,
        contract_type=contract,
        description=description[: P.MAX_DESCRIPTION],
        requirements=None,
        salary=_salary(posting),
        application_url=url,
        source=RandstadScraper.slug,
        source_id=f"randstad-{ident or (uuid.group(1) if uuid else url)}",
        published_at=P.iso_datetime(posting.get("datePosted")),
        expires_at=str(valid)[:10] if valid else None,
    )


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


class RandstadScraper(BaseScraper):
    slug = "randstad"
    name = "Randstad Healthcare (agenzia per il lavoro)"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        cache_path = Path(os.environ.get("RANDSTAD_CACHE") or DEFAULT_CACHE)
        cache = _load_cache(cache_path)
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        live: dict = {}
        fetched = 0
        try:
            urls: list[str] = []
            for sitemap in SITEMAPS:
                urls.extend(job_urls(client.get_text(sitemap)))
            self.stats["sitemap"] = len(urls)
            candidates = [u for u in dict.fromkeys(urls) if is_health_slug(u)]
            self.stats["health_slug"] = len(candidates)
            for url in candidates:
                row = cache.get(url)
                if row is None:
                    if fetched >= MAX_FETCH:
                        self.last_listings_complete = False
                        continue
                    fetched += 1
                    try:
                        html = client.get_text(url)
                    except Exception:  # noqa: BLE001
                        self.stats["errors"] = self.stats.get("errors", 0) + 1
                        self.last_listings_complete = False
                        continue
                    job = parse_job(html, url, self.stats)
                    row = {"job": job.__dict__ if job else None}
                live[url] = row
                if row.get("job"):
                    job = JobPayload(**row["job"])
                    job.title = clean_title(job.title)  # idempotente: vale anche per la cache vecchia
                    jobs.append(job)
        finally:
            client.close()
            # Solo le URL ancora nelle sitemap: le offerte chiuse escono dalla cache.
            if live or not cache:
                _save_cache(cache_path, live)
        self.stats["fetched"] = fetched
        self.stats["published"] = len(jobs)
        return jobs
