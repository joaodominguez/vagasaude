"""Sereni Orizzonti (RSA e residenze, Friuli e tutta Italia): "Posizioni aperte".

https://sereniorizzonti.it/it/posizioni-aperte/ (WordPress/Elementor, HTML lato server) elenca ~4 annunci come loop-item
(``div.e-loop-item.post-<id>``): data, luogo ("Tutta Italia", "Udine"), stato ("Selezione in corso"), titolo e testo.
Non c'e' una pagina per annuncio: ``application_url`` e' la pagina piu' un'ancora ``#posizione-<id>``. La candidatura e' per
email: indirizzi (anche personali) restano fuori da campi e testo (clean_text) e il testo termina con un rimando generico.
Solo ruoli sanitari (infermieri, OSS, fisioterapisti, medici ...); amministrativi e simili restano fuori. "Tutta Italia"
-> regione "Italia" (nazionale). robots.txt WP standard; il gruppo ha anche "Work On Time" (agenzia): non si usa.
Una sola richiesta.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text

from . import _it_priv as P

PAGE = "https://sereniorizzonti.it/it/posizioni-aperte/"
COMPANY = "Sereni Orizzonti"
_MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre",
           "novembre", "dicembre"]
_TITLE_MAP: tuple[tuple[str, str], ...] = (
    (r"infermier", "Infermieristica"),
    (r"^oss\b|operatore socio|operatori socio", "OSS"),
)
_NOT_CLINICAL = re.compile(r"amministrativ|impiegat|segreter|contabil|recupero crediti|cuoc|manutent|\bhr\b|marketing|commerciale", re.I)
_POINTER = "Per candidarsi seguire le istruzioni indicate nella pagina Posizioni aperte di Sereni Orizzonti."
_APPLY_RE = re.compile(r"\n[^\n]*\b(?:possono inviare|inviare il proprio|invia(?:re)? (?:il )?(?:tuo|proprio) cv)\b.*", re.I)


def _parse_date(text: str) -> str | None:
    m = re.match(r"\s*(\d{1,2})\s+([A-Za-zà-ù]+)\s+(\d{4})\s*$", text)
    if not m or m.group(2).lower() not in _MONTHS:
        return None
    return datetime(int(m.group(3)), _MONTHS.index(m.group(2).lower()) + 1, int(m.group(1)), tzinfo=timezone.utc).isoformat()


def parse_page(html: str, stats: dict | None = None) -> list[JobPayload]:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    soup = BeautifulSoup(html, "html.parser")
    jobs: list[JobPayload] = []
    used: set[str] = set()
    for item in soup.select("div.e-loop-item"):
        post = next((c[5:] for c in item.get("class", []) if re.fullmatch(r"post-\d+", c)), None)
        heads = [re.sub(r"\s+", " ", h.get_text(" ")).strip() for h in item.select(".elementor-heading-title")]
        if not post or len(heads) < 4:
            skip("no_data")
            continue
        date_txt, place, status, raw_title = heads[0], heads[1], heads[2], heads[3]
        if "in corso" not in status.lower():
            skip("closed")
            continue
        title = P.pretty_title(raw_title)
        if P.is_talent_pool(title):
            skip("talent_pool")
            continue
        profession = None if _NOT_CLINICAL.search(raw_title) else P.classify(title, _TITLE_MAP)
        if profession is None:
            skip("not_clinical")
            continue
        content = item.select_one(".elementor-widget-theme-post-content")
        text = html_to_text(str(content)) if content is not None else ""
        text = "\n".join(ln for ln in text.splitlines() if ln.strip().upper() != raw_title.strip().upper())
        text = _APPLY_RE.sub("", "\n" + text).strip()
        text = P.clean_text(text)
        if len(text) < P.MIN_BODY:
            skip("thin")
            continue
        city = None if re.search(r"tutta italia|nazionale", place, re.I) else place
        district = "Italia" if city is None else P.region_label(city, None)
        if post in used:
            skip("duplicate")
            continue
        used.add(post)
        contract_line = re.search(r"Contratto di lavoro:[^\n]*", text)
        # Elenco di piu' forme ("Tempo pieno, Part-time, ...") = contratto non definito.
        contract = None if contract_line and contract_line.group(0).count(",") >= 1 else guess_contract(
            contract_line.group(0) if contract_line else None)
        if contract == "Contratto":
            contract = None
        jobs.append(
            JobPayload(
                title=title,
                company=COMPANY,
                location_district=district,
                location_concelho=P.tidy_city(city) if city and district != "Italia" else None,
                profession=profession,
                specialty=None,
                sector=P.SECTOR,
                contract_type=contract,
                description=(text[: P.MAX_DESCRIPTION - len(_POINTER) - 2] + "\n\n" + _POINTER),
                requirements=None,
                salary=None,
                application_url=f"{PAGE}#posizione-{post}",
                source=SereniOrizzontiScraper.slug,
                source_id=f"sereni-orizzonti-{post}",
                published_at=_parse_date(date_txt),
            )
        )
    return jobs


class SereniOrizzontiScraper(BaseScraper):
    slug = "sereni-orizzonti"
    name = "Sereni Orizzonti - Posizioni aperte"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=2.0)
        try:
            html = client.get_text(PAGE)
            jobs = parse_page(html, self.stats)
            # Pagina con 0 loop-item = layout cambiato; con annunci non clinici soltanto e' normale.
            self.last_listings_complete = "e-loop-item" in html
        finally:
            client.close()
        self.stats["published"] = len(jobs)
        return jobs
