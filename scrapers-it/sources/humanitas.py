"""Humanitas (Gruppo Humanitas: Rozzano, Bergamo, Torino, Castellanza, Arese, Monza, ...).

Career site SAP SuccessFactors (jobs.humanitas.it): ``/sitemap.xml`` elenca ~145 URL
``/job/<slug>/<id>/``; la scheda ha microdata schema.org JobPosting (``itemprop``:
title, description, datePosted, addressLocality). robots.txt blocca solo /applybutton/,
/talentcommunity/, /services/ e simili: non toccati. Un solo URL per annuncio, >= 1 s tra le richieste.

Solo ruoli clinici (medici, infermieri, OSS, tecnici sanitari, ...): amministrativo, IT, HR,
ricerca di base, stage e impianti restano fuori. Letta dal portatile e dal VPS: 200.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from html import unescape

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text

from . import _it_priv as P

SITEMAP = "https://jobs.humanitas.it/sitemap.xml"
COMPANY = "Humanitas"
# Ricerca di base / programmi non clinici anche se il titolo contiene "Medico" o "Laboratory".
_NOT_CLINICAL = re.compile(
    r"ricercator|post ?doc|pre ?-?phd|research fellow|cell biology|bioinformatic|data scien|"
    r"graduate program|\bstage\b|tirocinio|\bintern\b|internship|clinical engineering|"
    r"study coordinator|project manager",
    re.I,
)
_TITLE_MAP: tuple[tuple[str, str], ...] = (
    (r"^tecnico (di )?(laboratorio|neurofisiopat|radiolog)|^tecnico neurofisiopatolog", "Tecnici sanitari"),
    (r"^nurse\b", "Infermieristica"),
    (r"^assistente (oncologia|medicina|cardiologia|neurologia|chirurgia)", "Medicina"),
    (r"^aiuto (di|del|della)", "Medicina"),
    (r"^specialista in (?!impiant)", "Medicina"),
    (r"^chirurgo\b", "Medicina"),
    (r"^ortottist|tecnico ortottist", "Logopedia e riabilitazione"),
)


def parse_sitemap(xml: str) -> list[str]:
    seen: list[str] = []
    for loc in re.findall(r"<loc>\s*([^<]+?)\s*</loc>", xml):
        if "/job/" in loc and loc not in seen:
            seen.append(loc)
    return seen


def _meta(soup: BeautifulSoup, prop: str) -> str:
    node = soup.select_one(f'[itemprop="{prop}"]')
    if not node:
        return ""
    return re.sub(r"\s+", " ", unescape(node.get("content") or node.get_text(" "))).strip()


def _posted(raw: str) -> str | None:
    try:
        return (
            datetime.strptime(raw.strip(), "%a %b %d %H:%M:%S UTC %Y").replace(tzinfo=timezone.utc).isoformat()
        )
    except ValueError:
        return None


_EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF☀-➿️]+\\s*")


def parse_detail(html: str, url: str, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    soup = BeautifulSoup(html, "html.parser")
    title = _meta(soup, "title")
    node = soup.select_one('[itemprop="description"]')
    if not title or node is None:
        skip("no_data")
        return None
    if P.is_talent_pool(title):
        skip("talent_pool")
        return None
    profession = None if _NOT_CLINICAL.search(title) else P.classify(title, _TITLE_MAP)
    if profession is None:
        skip("not_clinical")
        return None
    raw_text = html_to_text(str(node))
    description = P.clean_text(_EMOJI_RE.sub("", raw_text))
    if len(description) < P.MIN_BODY:
        skip("thin")
        return None
    city = _meta(soup, "addressLocality") or None
    if not city:
        m = re.search(r"Sede di lavoro:\s*([^\n]+)", raw_text)
        city = m.group(1).strip() if m else None
    if city:  # "Milano, Monza" / "Bergamo, Italy" -> prima localita'
        city = next((c.strip() for c in city.split(",") if c.strip() and c.strip().lower() != "italy"), None)
    district = P.region_label(city, None)
    if district == "Italia":
        skip("no_region")
        return None
    contract_line = re.search(r"Tipologia contrattuale:\s*([^\n]+)", raw_text)
    contract = guess_contract(contract_line.group(1) if contract_line else None) or guess_contract(
        f"{title} {description[:500]}"
    )
    if contract == "Contratto":  # generico ("Contratto di assunzione diretta")
        contract = None
    job_id = url.rstrip("/").split("/")[-1]
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
        salary=None,
        application_url=url,
        source=HumanitasScraper.slug,
        source_id=f"humanitas-{job_id}",
        published_at=_posted(_meta(soup, "datePosted")),
    )


class HumanitasScraper(BaseScraper):
    slug = "humanitas"
    name = "Humanitas - Lavora con noi"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        errors = 0
        try:
            urls = parse_sitemap(client.get_text(SITEMAP))
            self.stats["sitemap"] = len(urls)
            for url in urls:
                try:
                    html = client.get_text(url)
                except Exception:  # noqa: BLE001
                    errors += 1
                    continue
                job = parse_detail(html, url, self.stats)
                if job:
                    jobs.append(job)
        finally:
            client.close()
        # Se piu' di un decimo dei dettagli fallisce, niente soft-expire (lista incompleta).
        self.last_listings_complete = errors <= max(2, len(urls) // 10)
        self.stats["errors"] = errors
        self.stats["published"] = len(jobs)
        return jobs
