"""IEO - Istituto Europeo di Oncologia / Fondazione IEO-Monzino (Milano): pagina unica "Lavora con noi".

https://www.ieo.it/it/CHI-SIAMO/Lo-IEO/Lavora-con-noi/ ha ~34 annunci in HTML lato server (``li > h3`` + ``div.panel`` con il
testo completo). Non esiste una pagina per annuncio: ``application_url`` e' la pagina piu' un ancora ``#<slug-del-titolo>``.
La candidatura avviene per email, ma gli indirizzi restano fuori dai campi e dal testo (clean_text): in coda alla
descrizione c'e' solo l'indicazione generica di seguire le istruzioni della pagina. robots.txt: Disallow solo /it/RESEARCH/.
Una sola richiesta. Solo ruoli clinici: bandi di borsa di studio/PNRR, stage, amministrativo, marketing e ingegneria restano fuori.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text, slugify

from . import _it_priv as P

PAGE = "https://www.ieo.it/it/CHI-SIAMO/Lo-IEO/Lavora-con-noi/"
COMPANY = "Istituto Europeo di Oncologia (IEO)"
CITY, DISTRICT = "Milano", "Lombardia"
_NOT_CLINICAL = re.compile(r"\bbando\b|borsa di studio|\bpnrr\b|\bstage\b|ingegnere|bioinformatic|amministrazione|contabilit|"
                           r"marketing|punti vendita|servizi generali|\bcrm\b|pianificazione e controllo", re.I)
_TITLE_MAP: tuple[tuple[str, str], ...] = (
    (r"^tecnico sanitario", "Tecnici sanitari"),
    (r"^infermerie", "Infermieristica"),
    (r"^tecnico di ecografia", "Tecnici sanitari"),
    (r"^farmacista", "Farmacia"),
)
_POINTER = "Per candidarsi seguire le istruzioni indicate nella pagina Lavora con noi dell'Istituto Europeo di Oncologia."


def parse_page(html: str, stats: dict | None = None) -> list[JobPayload]:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    soup = BeautifulSoup(html, "html.parser")
    jobs: list[JobPayload] = []
    used: set[str] = set()
    for li in soup.find_all("li"):
        h3 = li.find("h3", recursive=False)
        panel = li.select_one(":scope > div.panel")
        if h3 is None or panel is None:
            continue
        raw_title = re.sub(r"\s+", " ", h3.get_text(" ")).strip()
        if P.is_talent_pool(raw_title):
            skip("talent_pool")
            continue
        profession = None if _NOT_CLINICAL.search(raw_title) else P.classify(P.pretty_title(raw_title), _TITLE_MAP)
        if profession is None:
            skip("not_clinical")
            continue
        description = P.clean_text(html_to_text(str(panel)))
        description = re.sub(r"(?m)^[·•]\s*$\n?", "", description)  # puntini orfani dei punti elenco Word
        description = re.sub(r"\n(?=[a-zà-ù(])", " ", description)  # frasi spezzate a meta' riga
        if len(description) < P.MIN_BODY:
            skip("thin")
            continue
        slug = slugify(raw_title)[:80] or "annuncio"
        if slug in used:
            skip("duplicate")
            continue
        used.add(slug)
        title = P.pretty_title(raw_title)
        offer = re.search(r"Si offre[^\n]*", description)
        contract = guess_contract(raw_title) or guess_contract(offer.group(0) if offer else None)
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
                description=(description[: P.MAX_DESCRIPTION - len(_POINTER) - 2] + "\n\n" + _POINTER),
                requirements=None,
                salary=None,
                application_url=f"{PAGE}#{slug}",
                source=IeoScraper.slug,
                source_id=f"ieo-{slug}",
                published_at=None,
            )
        )
    return jobs


class IeoScraper(BaseScraper):
    slug = "ieo"
    name = "IEO - Istituto Europeo di Oncologia"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        try:
            jobs = parse_page(client.get_text(PAGE), self.stats)
        finally:
            client.close()
        # Pagina vuota/cambiata: niente soft-expire.
        self.last_listings_complete = len(jobs) >= 3
        self.stats["published"] = len(jobs)
        return jobs
