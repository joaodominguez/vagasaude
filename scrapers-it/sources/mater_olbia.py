"""Mater Olbia Hospital (Olbia, Sardegna): pagina unica "Lavora con noi" (WordPress/Kadence, accordion).

https://materolbia.com/lavora-con-noi/ ha ~7 annunci in HTML lato server (``div.kf-accordion-item``: ``h3`` col titolo +
``div.kf-accordion-item-content`` col testo completo). Non esiste una pagina per annuncio: ``application_url`` e' la
pagina piu' un'ancora ``#<slug-del-titolo>``. La candidatura e' per email, ma gli indirizzi restano fuori dai campi e dal
testo (clean_text) e il blocco "Per candidarsi" viene sostituito da un rimando generico alla pagina.
robots.txt: Disallow solo /wp-admin/. Una sola richiesta. L'host www.materolbia.com ha il certificato scaduto: si usa
l'host senza www. Il server invia solo il certificato foglia (manca l'intermedio Sectigo DV R36): la verifica TLS NON si
disattiva; si aggiunge al trust store (certifi) l'intermedio pubblico di common/certs/sectigo_dv_r36.pem (scaricato dall'AIA
del certificato, firmato dalla root Sectigo R46 gia' in certifi).
"""
from __future__ import annotations

import re
import ssl
from pathlib import Path

import certifi
import httpx
from bs4 import BeautifulSoup

from common.http import DEFAULT_HEADERS, HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text, slugify

from . import _it_priv as P

PAGE = "https://materolbia.com/lavora-con-noi/"
INTERMEDIATE = Path(__file__).resolve().parent.parent / "common" / "certs" / "sectigo_dv_r36.pem"
COMPANY = "Mater Olbia Hospital"
CITY, DISTRICT = "Olbia", "Sardegna"
_TITLE_MAP: tuple[tuple[str, str], ...] = (
    (r"^fisico medico", "Tecnici sanitari"),
    (r"^medic[oi]\b", "Medicina"),
    (r"^infermier", "Infermieristica"),
)
_NOT_CLINICAL = re.compile(r"amministrativ|segreter|impiegat|contabil|marketing|\bhr\b|risorse umane|informatic", re.I)
_POINTER = "Per candidarsi seguire le istruzioni indicate nella pagina Lavora con noi del Mater Olbia Hospital."
_APPLY_RE = re.compile(r"\n[^\n]*per candidarsi\b.*", re.I | re.S)


def _client() -> HttpClient:
    """HttpClient (mesmo UA e throttle) com verificacao TLS completa + intermedio em falta no site."""
    context = ssl.create_default_context(cafile=certifi.where())
    context.load_verify_locations(cafile=str(INTERMEDIATE))
    client = HttpClient(min_interval=2.0)
    client.client.close()
    client.client = httpx.Client(timeout=30.0, headers=DEFAULT_HEADERS, follow_redirects=True, verify=context)
    return client


def parse_page(html: str, stats: dict | None = None) -> list[JobPayload]:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    soup = BeautifulSoup(html, "html.parser")
    jobs: list[JobPayload] = []
    used: set[str] = set()
    for item in soup.select("div.kf-accordion-item"):
        label = item.select_one("h3 .kf-accordion-item-label") or item.find("h3")
        panel = item.select_one("div.kf-accordion-item-content")
        if label is None or panel is None:
            continue
        raw_title = re.sub(r"\s+", " ", label.get_text(" ")).strip()
        if not raw_title or P.is_talent_pool(raw_title):
            skip("talent_pool")
            continue
        title = P.pretty_title(raw_title)
        profession = None if _NOT_CLINICAL.search(raw_title) else P.classify(title, _TITLE_MAP)
        if profession is None:
            skip("not_clinical")
            continue
        text = html_to_text(str(panel))
        text = _APPLY_RE.sub("", "\n" + text).strip()
        text = re.sub(r"(?m)^[\s—–-]{6,}$\n?", "", text)  # righe di soli trattini
        text = P.clean_text(text)
        if len(text) < P.MIN_BODY:
            skip("thin")
            continue
        slug = slugify(raw_title)[:80] or "annuncio"
        if slug in used:
            skip("duplicate")
            continue
        used.add(slug)
        offer = re.search(r"si offre[:\s]*\n?([^\n]+)", text, re.I)
        contract = guess_contract(offer.group(1) if offer else None)
        if contract == "Contratto":
            contract = None
        jobs.append(
            JobPayload(
                title=title,
                company=COMPANY,
                location_district=DISTRICT,
                location_concelho=CITY,
                profession=profession,
                specialty=None,
                sector=P.SECTOR,
                contract_type=contract,
                description=(text[: P.MAX_DESCRIPTION - len(_POINTER) - 2] + "\n\n" + _POINTER),
                requirements=None,
                salary=None,
                application_url=f"{PAGE}#{slug}",
                source=MaterOlbiaScraper.slug,
                source_id=f"mater-olbia-{slug}",
                published_at=None,
            )
        )
    return jobs


class MaterOlbiaScraper(BaseScraper):
    slug = "mater-olbia"
    name = "Mater Olbia Hospital - Lavora con noi"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = _client()
        try:
            jobs = parse_page(client.get_text(PAGE), self.stats)
        finally:
            client.close()
        # Pagina cambiata/vuota: niente soft-expire.
        self.last_listings_complete = len(jobs) >= 2
        self.stats["published"] = len(jobs)
        return jobs
