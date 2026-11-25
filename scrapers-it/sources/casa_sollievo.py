"""Casa Sollievo della Sofferenza / Opera Padre Pio (San Giovanni Rotondo, Puglia): "Posizioni aperte".

https://www.operapadrepio.it/it/posizioni-aperte (Joomla/EasyBlog, HTML lato server) elenca ~8 avvisi (titolo + estratto +
"Per saperne di piu'"); ogni avviso ha una pagina ``/it/notizie-e-comunicati/<slug>`` con testo, data di pubblicazione e
scadenza ("entro e non oltre il 30 Novembre 2026"). Le pagine di dettaglio contengono anche il modulo di candidatura
(campi, informativa privacy): il testo si taglia prima del modulo. Graduatorie, selezioni chiuse e candidature spontanee
sono sezioni a parte e non si leggono. robots.txt Joomla standard: solo cartelle tecniche. >= 2 s tra le richieste.
Sono selezioni a tempo (con scadenza): scadute -> fuori; il soft-expire tratta quelle sparite dalla lista.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timezone
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text, slugify

from . import _it_priv as P

BASE = "https://www.operapadrepio.it"
LIST_URL = f"{BASE}/it/posizioni-aperte"
COMPANY = "Casa Sollievo della Sofferenza"
CITY, DISTRICT = "San Giovanni Rotondo", "Puglia"
_TITLE_MAP: tuple[tuple[str, str], ...] = (
    (r"medic[oi]|dirigent[ei] medic", "Medicina"),
    (r"infermier", "Infermieristica"),
    (r"tecnico sanitario|tecnici sanitari|radiologia medica", "Tecnici sanitari"),
    (r"ostetric[ah]\b(?!.*ginecolog)", "Ostetricia"),
)
_NOT_CLINICAL = re.compile(r"amministrativ|informatic|ingegner|contabil|\bbando\b.*\bborsa\b", re.I)
_MONTHS = {m: i for i, m in enumerate(
    ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre",
     "novembre", "dicembre"], 1)}
_FORM_START = re.compile(r"Please complete all required fields|\nIl sottoscritto\b|\nCognome\n", re.I)
_POINTER = "Per candidarsi seguire le istruzioni indicate nell'avviso sul sito della Fondazione Casa Sollievo della Sofferenza."


def parse_list(html: str) -> list[tuple[str, str]]:
    """[(titolo, url assoluto)] degli avvisi nella lista (stesso ordine della pagina, senza doppioni)."""
    soup = BeautifulSoup(html, "html.parser")
    rows: list[tuple[str, str]] = []
    seen: set[str] = set()
    for a in soup.select("div.eb-mod-title a[href]"):
        url = urljoin(BASE, a["href"])
        title = re.sub(r"\s+", " ", a.get_text(" ")).strip()
        if "/notizie-e-comunicati/" not in url or not title or url in seen:
            continue
        seen.add(url)
        rows.append((title, url))
    return rows


def short_title(raw: str) -> str:
    """"Selezione per 4 Dirigenti Medici ... per assunzione a tempo indeterminato" -> titolo breve."""
    title = re.sub(r"\s+", " ", raw).strip()
    spec = re.search(r"specializzazione in (.+?)(?:\.\s*Proroga.*)?\.?$", title, re.I)
    if re.search(r"specializzandi", title, re.I) and spec:
        return f"Medico specializzando - {spec.group(1).strip().rstrip('.')}"
    for _ in range(2):  # "Proroga termine e parziale rettifica Selezione per ..."
        title = re.sub(r"^(proroga termine e parziale rettifica|avviso di selezione|selezione)\s+(per\s+)?", "", title, flags=re.I)
    title = re.sub(r"\s+(per|me)\s+assunzione a tempo (in)?determinato.*$", "", title, flags=re.I)
    title = re.sub(r"\s*\((?:CNEL|cnel)[^)]*\)\s*$", "", title)
    title = re.sub(r"^\d+\s+", "", title)  # "4 Dirigenti Medici ..." (il numero resta nel testo)
    title = title[:1].upper() + title[1:] if title else title
    return title


def parse_deadline(text: str) -> str | None:
    """Prima data dopo "entro ... il" (es. 30 Novembre 2026) -> AAAA-MM-GG."""
    m = re.search(r"entro\s+(?:e non oltre\s+)?(?:il\s+)?(?:giorno\s+)?(\d{1,2})\s+([a-zà-ù]+)\s+(\d{4})", text, re.I)
    if not m or m.group(2).lower() not in _MONTHS:
        return None
    try:
        return date(int(m.group(3)), _MONTHS[m.group(2).lower()], int(m.group(1))).isoformat()
    except ValueError:
        return None


def parse_detail(html: str, url: str, list_title: str, today: date | None = None, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}
    today = today or datetime.now(timezone.utc).date()

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    if P.is_talent_pool(list_title):
        skip("talent_pool")
        return None
    title = short_title(list_title)
    profession = None if _NOT_CLINICAL.search(list_title) else P.classify(title, _TITLE_MAP)
    if profession is None:
        skip("not_clinical")
        return None
    soup = BeautifulSoup(html, "html.parser")
    body = soup.select_one("div.eb-entry-article") or soup.select_one("div.eb-entry-body")
    if body is None:
        skip("no_data")
        return None
    for tag in body.select("script, style, form, .eb-image"):
        tag.decompose()
    text = html_to_text(str(body))
    cut = _FORM_START.search(text)
    if cut:
        text = text[: cut.start()]
    text = P.clean_text(text)
    if len(text) < P.MIN_BODY:
        skip("thin")
        return None
    expires = parse_deadline(text)
    if expires and date.fromisoformat(expires) < today:
        skip("expired")
        return None
    when = soup.select_one("time.eb-meta-date")
    published = None
    if when is not None and when.get("content"):
        try:
            published = datetime.strptime(when["content"], "%d-%m-%Y").replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            published = None
    contract = guess_contract(list_title) or guess_contract(text[:800])
    if contract == "Contratto":
        contract = None
    slug = url.rstrip("/").rsplit("/", 1)[-1]
    slug = slugify(slug)[:90] or slugify(title)[:90]
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
        source=CasaSollievoScraper.slug,
        source_id=f"casa-sollievo-{slug}",
        published_at=published,
        expires_at=expires,
    )


class CasaSollievoScraper(BaseScraper):
    slug = "casa-sollievo"
    name = "Casa Sollievo della Sofferenza - Posizioni aperte"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=2.0)
        jobs: list[JobPayload] = []
        errors = 0
        try:
            rows = parse_list(client.get_text(LIST_URL))
            self.stats["list"] = len(rows)
            for list_title, url in rows:
                try:
                    html = client.get_text(url)
                except Exception:  # noqa: BLE001
                    errors += 1
                    continue
                job = parse_detail(html, url, list_title, stats=self.stats)
                if job:
                    jobs.append(job)
        finally:
            client.close()
        # Lista vuota o con errori: niente soft-expire (la lista vuota e' possibile, ma meglio non ritirare tutto).
        self.last_listings_complete = bool(rows) and errors == 0
        self.stats["errors"] = errors
        self.stats["published"] = len(jobs)
        return jobs
