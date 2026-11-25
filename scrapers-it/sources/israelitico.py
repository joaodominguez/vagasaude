"""Ospedale Israelitico (Roma, Lazio): pagina "Lavora con noi" + articoli "LAVORA CON NOI: ...".

https://ospedaleisraelitico.it/lavora-con-noi/ (WordPress/Avada, HTML lato server) elenca nel testo gli annunci per dirigente
medico ("N. 1 POSTI DI DIRIGENTE MEDICO ... DISCIPLINA: ...", separati da una riga di trattini) e, nel footer, gli articoli
piu' recenti: quelli con slug ``lavora-con-noi-...`` sono annunci singoli (JSON-LD/meta con data di pubblicazione).
Gli annunci della pagina non hanno data ne' pagina propria: ``application_url`` e' la pagina piu' un'ancora
``#<slug>``. I testi contengono email, telefoni e nomi di direttori: clean_text toglie ogni riga con contatti e
"Come candidarsi" viene sostituito da un rimando generico. Gli articoli piu' vecchi di 120 giorni non si leggono.
robots.txt: ``Disallow:`` vuoto. >= 2 s tra le richieste.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text, slugify

from . import _it_priv as P

PAGE = "https://ospedaleisraelitico.it/lavora-con-noi/"
COMPANY = "Ospedale Israelitico"
CITY, DISTRICT = "Roma", "Lazio"
MAX_POST_AGE_DAYS = 120
_TITLE_MAP: tuple[tuple[str, str], ...] = (
    (r"medic[oi]|dirigente medico|radiolog|radiodiagnostic", "Medicina"),
    (r"infermier", "Infermieristica"),
    (r"tecnico (sanitario|di radiologia)|tsrm", "Tecnici sanitari"),
)
_NOT_CLINICAL = re.compile(r"amministrativ|segreter|impiegat|contabil|informatic|marketing|\bhr\b", re.I)
_POINTER = "Per candidarsi seguire le istruzioni indicate nella pagina Lavora con noi dell'Ospedale Israelitico."
_ITEM_SPLIT = re.compile(r"(?=^N\.\s*\d+\s+POST[IO]\s+DI\b)", re.I | re.M)
_APPLY_RE = re.compile(r"\n\s*(?:come candidarsi|per candidarsi)\b.*", re.I | re.S)


def _tidy(text: str) -> str:
    text = re.sub(r"(?m)^[\s—–‒-]{6,}$\n?", "", text)  # righe di soli trattini
    text = re.sub(r"(?m)^\s*Per maggiori dettagli invitiamo a contattare:?\s*$\n?", "", text)
    text = re.sub(r"(?m)^[\s–-]*(?:la direzione sanitaria|il direttore della)[^\n]*$\n?", "", text, flags=re.I)
    return re.sub(r"\n{3,}", "\n\n", P.clean_text(text)).strip()


def parse_page(html: str, stats: dict | None = None) -> list[JobPayload]:
    """Annunci elencati nel testo della pagina (dirigenti medici)."""
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    soup = BeautifulSoup(html, "html.parser")
    root = soup.select_one("div.post-content") or soup.select_one("main") or soup.body
    if root is None:
        return []
    for tag in root.select("script, style"):
        tag.decompose()
    text = html_to_text(str(root))
    start = re.search(r"posizioni aperte", text, re.I)
    text = text[start.end():] if start else text
    jobs: list[JobPayload] = []
    used: set[str] = set()
    for block in _ITEM_SPLIT.split(text):
        head = re.match(r"N\.\s*\d+\s+POST[IO]\s+DI\s+([^\n(]+?)\s*(?:\(([^)\n]*)\))?\s*\n", block.strip() + "\n", re.I)
        if not head:
            continue
        role = P.pretty_title(head.group(1))
        discipline = re.search(r"DISCIPLINA:?\s*([^\n]*(?:\n(?!Si cerca)[^\n]+)?)", block, re.I)
        disc = P.pretty_title(re.sub(r"\s+", " ", discipline.group(1)).strip()) if discipline else ""
        title = f"{role} - {disc}" if disc else role
        if P.is_talent_pool(title):
            skip("talent_pool")
            continue
        profession = None if _NOT_CLINICAL.search(title) else P.classify(title, _TITLE_MAP)
        if profession is None:
            skip("not_clinical")
            continue
        body = _tidy(block)
        if len(body) < P.MIN_BODY:
            skip("thin")
            continue
        slug = slugify(title)[:80]
        if not slug or slug in used:
            skip("duplicate")
            continue
        used.add(slug)
        contract = guess_contract(head.group(2) or "") or guess_contract(body[:500])
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
                description=(body[: P.MAX_DESCRIPTION - len(_POINTER) - 2] + "\n\n" + _POINTER),
                requirements=None,
                salary=None,
                application_url=f"{PAGE}#{slug}",
                source=IsraeliticoScraper.slug,
                source_id=f"israelitico-{slug}",
                published_at=None,
            )
        )
    return jobs


def post_links(html: str) -> list[str]:
    """URL degli articoli "LAVORA CON NOI: ..." linkati dalla pagina (slug che inizia per lavora-con-noi-)."""
    soup = BeautifulSoup(html, "html.parser")
    urls: list[str] = []
    for a in soup.find_all("a", href=True):
        url = urljoin(PAGE, a["href"]).split("#")[0]
        path = url.split("ospedaleisraelitico.it", 1)[-1].strip("/")
        if "ospedaleisraelitico.it" in url and re.fullmatch(r"lavora-con-noi-[a-z0-9-]+", path) and url not in urls:
            urls.append(url)
    return urls


def parse_post(html: str, url: str, now: datetime | None = None, stats: dict | None = None) -> JobPayload | None:
    now = now or datetime.now(timezone.utc)
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    published = P.iso_datetime((re.search(r'article:published_time"\s+content="([^"]+)"', html) or [None, None])[1])
    if not published or datetime.fromisoformat(published) < now - timedelta(days=MAX_POST_AGE_DAYS):
        skip("stale")
        return None
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.select_one("h1.entry-title") or soup.find("h1")
    raw = re.sub(r"\s+", " ", h1.get_text(" ")).strip() if h1 else ""
    raw = re.sub(r"^lavora con noi:\s*", "", raw, flags=re.I)
    raw = re.sub(r"^l.ospedale israelitico (ricerca|cerca)\s+", "", raw, flags=re.I)
    if not raw:
        skip("no_data")
        return None
    title = raw[:1].upper() + raw[1:]
    if P.is_talent_pool(title):
        skip("talent_pool")
        return None
    profession = None if _NOT_CLINICAL.search(title) else P.classify(title, _TITLE_MAP)
    if profession is None:
        skip("not_clinical")
        return None
    box = soup.select_one("article div.post-content")
    if box is None:
        skip("no_data")
        return None
    text = html_to_text(str(box))
    text = _APPLY_RE.sub("", "\n" + text).strip()
    text = _tidy(text)
    if len(text) < P.MIN_BODY:
        skip("thin")
        return None
    kind = re.search(r"Tipologia di contratto[^\n]*", text)
    contract = guess_contract(kind.group(0) if kind else None)
    if contract == "Contratto":
        contract = None
    slug = slugify(url.rstrip("/").rsplit("/", 1)[-1])[:80]
    return JobPayload(
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
        application_url=url,
        source=IsraeliticoScraper.slug,
        source_id=f"israelitico-{slug}",
        published_at=published,
    )


class IsraeliticoScraper(BaseScraper):
    slug = "israelitico"
    name = "Ospedale Israelitico - Lavora con noi"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=2.0)
        now = datetime.now(timezone.utc)
        errors = 0
        try:
            html = client.get_text(PAGE)
            jobs = parse_page(html, self.stats)
            for url in post_links(html):
                try:
                    job = parse_post(client.get_text(url), url, now, self.stats)
                except Exception:  # noqa: BLE001
                    errors += 1
                    continue
                if job and all(job.source_id != j.source_id for j in jobs):
                    jobs.append(job)
        finally:
            client.close()
        self.last_listings_complete = bool(jobs) and errors == 0
        self.stats["errors"] = errors
        self.stats["published"] = len(jobs)
        return jobs
