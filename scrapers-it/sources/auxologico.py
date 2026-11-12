"""Istituto Auxologico Italiano (IRCCS e RSA: Milano, Cusano Milanino, Como, Piancavallo/Verbania, Roma).

Sito Drupal con HTML lato server: ``/lavora-con-noi/posizioni-aperte?page=N`` (20 annunci per pagina, ~54 in tutto) e una
scheda per annuncio ``/lavora-con-noi/posizioni-aperte/<slug>`` con data, testo completo e sede. robots.txt blocca
solo /admin/, /search/, /user/ ...: la lista e le schede sono permesse. >= 1 s tra le richieste.
Solo ruoli clinici; amministrativo, contabilita', ricerca di base, HSE, customer care e manutenzione restano fuori.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text, norm

from . import _it_priv as P

BASE = "https://www.auxologico.it"
LIST_URL = BASE + "/lavora-con-noi/posizioni-aperte?page={page}"
COMPANY = "Istituto Auxologico Italiano"
MAX_PAGES = 10
_NOT_CLINICAL = re.compile(
    r"\baddett|customer care|contabil|accountant|\bhse\b|study coordinator|data manager|ricercator|post-?\s?doc|"
    r"manutenzion|coordinatore area|ciclo (attivo|passivo)",
    re.I,
)
# Sedi dell'Istituto (nome nel campo "Dove") -> (citta', regione).
_SITES: tuple[tuple[str, str, str], ...] = (
    ("cusano", "Cusano Milanino", "Lombardia"),
    ("san luca", "Milano", "Lombardia"),
    ("mose bianchi", "Milano", "Lombardia"),
    ("residenza anziani", "Milano", "Lombardia"),
    ("piancavallo", "Oggebbio", "Piemonte"),
    ("como", "Como", "Lombardia"),
    ("roma", "Roma", "Lazio"),
)
_TITLE_MAP: tuple[tuple[str, str], ...] = (
    (r"educatore professionale sanitario", "Servizio sociale"),
    (r"^tecnic[ao](/o)? (di )?neurofisiopat", "Tecnici sanitari"),
    (r"^medico\b|^medici\b", "Medicina"),
)


def parse_list(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    out: list[str] = []
    for a in soup.select("article a.stretched-link[href]"):
        href = a["href"].split("?")[0].split("#")[0]
        if "/posizioni-aperte/" in href and href not in out:
            out.append(href)
    return out


def _place(sede: str) -> tuple[str | None, str]:
    key = norm(sede)
    for needle, city, region in _SITES:
        if re.search(rf"\b{needle}\b", key):
            return city, region
    pieces = [re.sub(r"^sedi\s+", "", p.strip(), flags=re.I) for p in sede.split(",") if p.strip()]
    region = P.region_label(None, sede)
    city = next((p for p in pieces if P.region_label(p, None) != "Italia" and norm(p) not in (norm(r) for r in _REGIONS)), None)
    if region == "Italia" and city:
        region = P.region_label(city, None)
    return city, region


from common.normalize import REGIONS as _REGIONS  # noqa: E402


def parse_detail(html: str, url: str, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.select_one("article.annuncio-di-lavoro--full h1") or soup.select_one("h1.text-blu")
    body = soup.select_one(".annuncio-di-lavoro__body")
    if h1 is None or body is None:
        skip("no_data")
        return None
    title = re.sub(r"\bOss\b", "OSS", re.sub(r"\s+", " ", h1.get_text(" ")).strip())
    if P.is_talent_pool(title):
        skip("talent_pool")
        return None
    profession = None if _NOT_CLINICAL.search(title) else P.classify(title, _TITLE_MAP)
    if profession is None:
        skip("not_clinical")
        return None
    description = P.clean_text(html_to_text(str(body)))
    if len(description) < P.MIN_BODY:
        skip("thin")
        return None
    sede_node = soup.select_one(".annuncio-di-lavoro__field-sedi-ospedaliere .field__item")
    city, district = _place(re.sub(r"\s+", " ", sede_node.get_text(" ")).strip() if sede_node else "")
    if district == "Italia":
        skip("no_region")
        return None
    published = None
    m = re.search(r"pubblicato il (\d{2})/(\d{2})/(\d{4})", soup.get_text(" "))
    if m:
        published = datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)), tzinfo=timezone.utc).isoformat()
    contract = guess_contract(title) or guess_contract(description[:600])
    if contract == "Contratto":
        contract = None
    slug = url.rstrip("/").rsplit("/", 1)[-1]
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
        source=AuxologicoScraper.slug,
        source_id=f"auxologico-{slug}",
        published_at=published,
    )


class AuxologicoScraper(BaseScraper):
    slug = "auxologico"
    name = "Istituto Auxologico Italiano - Lavora con noi"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        errors = 0
        links: list[str] = []
        try:
            for page in range(MAX_PAGES):
                found = parse_list(client.get_text(LIST_URL.format(page=page)))
                new = [href for href in found if href not in links]
                if not new:
                    break
                links += new
            self.stats["listed"] = len(links)
            for href in links:
                url = BASE + href
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
        self.last_listings_complete = bool(links) and errors <= max(2, len(links) // 10)
        self.stats["errors"] = errors
        self.stats["published"] = len(jobs)
        return jobs
