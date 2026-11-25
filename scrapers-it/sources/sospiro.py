"""Fondazione Sospiro (Cremona, Lombardia): RSA/RSD per persone con disabilita' e anziani, "Lavora con noi".

Tre elenchi WordPress (HTML lato server): ``/lavora-con-noi/lavora-con-noi-in-rsa/``, ``.../in-rsd/`` e
``.../lavora-con-noi-altre-posizioni/``; ogni voce rimanda a una scheda ``/lavora-con-noi/posizione/<slug>/`` (la stessa
scheda puo' comparire in RSA e RSD: si legge una volta). La scheda ha h1, riga con area (RSA/RSD), sede ("Sospiro (CR)"),
contratto/orario e il testo; la data e' in ``datePublished`` (JSON-LD WebPage). Le schede non hanno email nel testo; il modulo
di candidatura sta nella pagina e non si legge. robots.txt (WooCommerce): solo filtri e carrello. Solo ruoli sanitari/socio-sanitari
(OSS, ASA, infermieri, fisioterapisti, educatori professionali); amministrativi, tecnici e "scienze motorie" restano fuori.
"Altre posizioni" (tecniche/amministrative) di solito e' vuoto. >= 2 s tra le richieste.
"""
from __future__ import annotations

import re
import time
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text, slugify

from . import _it_priv as P

BASE = "https://www.fondazionesospiro.it"
LISTS = (
    f"{BASE}/lavora-con-noi/lavora-con-noi-in-rsa/",
    f"{BASE}/lavora-con-noi/lavora-con-noi-in-rsd/",
    f"{BASE}/lavora-con-noi/lavora-con-noi-altre-posizioni/",
)
COMPANY = "Fondazione Sospiro"
DEFAULT_CITY, DEFAULT_DISTRICT = "Sospiro", "Lombardia"
_TITLE_MAP: tuple[tuple[str, str], ...] = (
    (r"^asa\b|ausiliario socio", "OSS"),
    (r"^oss\b|operatore socio", "OSS"),
)
_NOT_CLINICAL = re.compile(r"amministrativ|impiegat|segreter|contabil|manutent|cuoc|autista|\bhr\b|scienze motorie", re.I)
_HEAD_RE = re.compile(r"^(?:(RSA|RSD)(?:\s+e\s+(?:RSA|RSD))?\s+)?([A-ZÀ-Ý][\wà-ù'’. ]+?)\s*\(([A-Z]{2})\)\s*(.*)$")


def parse_list(html: str) -> list[str]:
    """URL (senza query) delle schede ``/lavora-con-noi/posizione/<slug>/`` di un elenco."""
    soup = BeautifulSoup(html, "html.parser")
    urls: list[str] = []
    for a in soup.find_all("a", href=True):
        url = urljoin(BASE, a["href"])
        parts = urlsplit(url)
        if "/lavora-con-noi/posizione/" not in parts.path:
            continue
        clean = f"{parts.scheme}://{parts.netloc}{parts.path}"
        if clean not in urls:
            urls.append(clean)
    return urls


def parse_detail(html: str, url: str, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    raw = re.sub(r"\s+", " ", h1.get_text(" ")).strip() if h1 else ""
    if not raw:
        skip("no_data")
        return None
    title = P.pretty_title(raw)
    if P.is_talent_pool(title):
        skip("talent_pool")
        return None
    profession = None if _NOT_CLINICAL.search(raw) else P.classify(title, _TITLE_MAP)
    if profession is None:
        skip("not_clinical")
        return None
    main = soup.find("main") or soup.body
    for tag in main.select("script, style, form, button, nav"):
        tag.decompose()
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in html_to_text(str(main)).splitlines()]
    lines = [ln for ln in lines if ln and ln != raw]
    # Prima riga: "RSD Sospiro (CR) Part-time Orario giornaliero" (area, sede, contratto/orario).
    city, district, meta, area = None, DEFAULT_DISTRICT, "", None
    head = _HEAD_RE.match(lines[0]) if lines else None
    if head:
        area, place, sigla, meta = head.group(1), head.group(2).strip(), head.group(3), head.group(4).strip()
        found = P.region_label(place, f"({sigla})")
        if found != "Italia":
            city, district = place, found
        lines = lines[1:]
    body_lines = lines
    text = P.clean_text("\n".join(body_lines))
    if len(text) < P.MIN_BODY:
        skip("thin")
        return None
    if area:
        text = f"Area: {area}" + (f" - {city}" if city else "") + "\n\n" + text
    contract = guess_contract(meta) or guess_contract(text[:600])
    if contract == "Contratto":
        contract = None
    published = P.iso_datetime((re.search(r'"datePublished":"([^"]+)"', html) or [None, None])[1])
    ident = slugify(urlsplit(url).path.rstrip("/").rsplit("/", 1)[-1])[:80]
    return JobPayload(
        title=title,
        company=COMPANY,
        location_district=district,
        location_concelho=city or DEFAULT_CITY,
        profession=profession,
        specialty=None,
        sector=P.SECTOR,
        contract_type=contract,
        description=text[: P.MAX_DESCRIPTION],
        requirements=None,
        salary=None,
        application_url=url,
        source=SospiroScraper.slug,
        source_id=f"sospiro-{ident}",
        published_at=published,
    )


class SospiroScraper(BaseScraper):
    slug = "sospiro"
    name = "Fondazione Sospiro - Lavora con noi"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=2.0)
        jobs: list[JobPayload] = []
        errors = 0
        urls: list[str] = []
        try:
            for page in LISTS:
                try:
                    for url in parse_list(client.get_text(page)):
                        if url not in urls:
                            urls.append(url)
                except Exception:  # noqa: BLE001
                    errors += 1
            self.stats["list"] = len(urls)
            for url in urls:
                html = None
                for attempt in range(2):  # un ritentativo: i timeout isolati non devono bloccare il soft-expire
                    try:
                        html = client.get_text(url)
                        break
                    except Exception:  # noqa: BLE001
                        time.sleep(3)
                if html is None:
                    errors += 1
                    continue
                job = parse_detail(html, url, self.stats)
                if job and all(job.source_id != j.source_id for j in jobs):
                    jobs.append(job)
        finally:
            client.close()
        self.last_listings_complete = errors == 0
        self.stats["errors"] = errors
        self.stats["published"] = len(jobs)
        return jobs
