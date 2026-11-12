"""Cerba HealthCare Italia (ex Lifebrain): laboratori, diagnostica e poliambulatori.

Career site Cornerstone/talent-soft (cerbahealthcare-career.talent-soft.com), HTML lato server,
nessun JSON-LD ne' API: la lista ``liste-toutes-offres.aspx?LCID=1040&page=N`` (10 schede per
pagina: titolo, data, societa', regione) e il dettaglio ``/job/<slug>_<id>.aspx?LCID=1040``
(descrizione in ``#fldjobdescription_*``, sede in ``#fldlocation_joblocation``). Il parametro
``LCID=1040`` rende il link pubblico anche senza sessione (senza, il sito rimanda alla home).
robots.txt vuoto, nessun Crawl-delay: 1 s tra le richieste. Il dettaglio si legge solo per i ruoli
clinici (infermieri, medici, tecnici di laboratorio/radiologia, biologi, ostetriche, fisioterapisti);
front office, segreteria, RSPP, logistica, acquisti restano fuori. Gli annunci generici
"Ricerca Medici/Infermieri ... Cerba Healthcare Italia" valgono come talent pool e si saltano.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from html import unescape
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_district, html_to_text, norm

from . import _it_priv as P

BASE = "https://cerbahealthcare-career.talent-soft.com"
LIST_URL = BASE + "/offre-de-emploi/liste-toutes-offres.aspx?LCID=1040"
COMPANY = "Cerba HealthCare"
MAX_PAGES = 30
_TITLE_MAP: tuple[tuple[str, str], ...] = (
    (r"^direttore tecnico", "Gestione e supporto"),  # non e' una posizione clinica da assistenza
    (r"tech?nico di laboratorio|tecnico di radiologia|citoscreener|^tecnico", "Tecnici sanitari"),
    (r"^biolog", "Tecnici sanitari"),
    (r"^(endocrinolog|ginecolog|cardiolog|dermatolog|oculista|allergolog)", "Medicina"),
)
_NOT_CLINICAL = re.compile(r"direttore tecnico|tirocinio|\bstage\b|key account|segreteria|front office", re.I)
_POOL_TITLE = re.compile(r"^ricerca (medici|infermier|figure|professionisti)", re.I)


def parse_list(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []
    for card in soup.select("div.ts-offer-card"):
        link = card.select_one("a.ts-offer-card__title-link")
        if not link or not link.get("href"):
            continue
        items = [re.sub(r"\s+", " ", li.get_text(" ")).strip() for li in card.select("ul li")]
        m = re.search(r"_(\d+)\.aspx", link["href"])
        if not m:
            continue
        rows.append(
            {
                "id": m.group(1),
                "path": link["href"],
                "title": re.sub(r"\s+", " ", unescape(link.get_text(" "))).strip(),
                "date": items[1] if len(items) > 1 else "",
                "entity": items[2] if len(items) > 2 else "",
                "region": items[3] if len(items) > 3 else "",
            }
        )
    return rows


def _date(value: str) -> str | None:
    try:
        return datetime.strptime(value.strip(), "%d/%m/%Y").replace(tzinfo=timezone.utc).isoformat()
    except ValueError:
        return None


def _field(soup: BeautifulSoup, field_id: str) -> str:
    node = soup.select_one(f"#{field_id}")
    return html_to_text(str(node)).strip() if node else ""


def parse_detail(html: str, row: dict, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    soup = BeautifulSoup(html, "html.parser")
    title = row["title"]
    parts = [_field(soup, "fldjobdescription_description1"), _field(soup, "fldjobdescription_description2")]
    body = P.clean_text("\n\n".join(p for p in parts if p))
    if len(body) < P.MIN_BODY:
        skip("thin")
        return None
    # Sede: "35010 Limena (PD)" -> citta' + sigla; regione da sigla, poi dal campo regione della lista.
    loc = _field(soup, "fldlocation_joblocation")
    m = re.search(r"(\d{5})\s+([^()\n]+?)\s*\(([A-Z]{2})\)", loc)
    city = m.group(2).strip() if m else None
    district = guess_district(None, f"({m.group(3)})") if m else "Italia"
    if district == "Italia":
        district = guess_district(city, row.get("region") or None)
    if district == "Italia":
        district = guess_district(title, None)
    if district == "Italia":
        skip("no_region")
        return None
    contract_field = _field(soup, "fldjobdescription_contract")
    contract = guess_contract(f"{title} {contract_field}") or guess_contract(body[:800])
    if contract in (None, "Contratto"):
        contract = "Full-time" if "pieno" in _field(soup, "fldjobdescription_jobtime").lower() else None
    if city and norm(city) not in norm(title):  # "Infermiere" x N sedi -> titoli distinguibili
        title = f"{title} - {city}"
    return JobPayload(
        title=title,
        company=COMPANY,
        location_district=district,
        location_concelho=city,
        profession=row["profession"],
        specialty=None,
        sector=P.SECTOR,
        contract_type=contract,
        description=body[: P.MAX_DESCRIPTION],
        requirements=None,
        salary=None,
        application_url=f"{BASE}{row['path']}?LCID=1040",
        source=CerbaScraper.slug,
        source_id=f"cerba-{row['id']}",
        published_at=_date(row.get("date", "")),
    )


def clean_title(title: str) -> str:
    """"INFERMIERE M/F" -> "Infermiere"; toglie i "M/F" ripetuti e normalizza le maiuscole."""
    t = re.sub(r"(\s*\bM\s*/\s*F\b)+", "", title, flags=re.I).strip(" -")
    t = re.sub(r"\bTECHNICO\b", "TECNICO", t)
    if t.isupper():
        t = t.capitalize()
        t = re.sub(r"\b(p\.iva)\b", "P.IVA", t, flags=re.I)
    return re.sub(r"\s+", " ", t)


def select_rows(rows: list[dict], stats: dict) -> list[dict]:
    """Tiene solo i ruoli clinici e aggiunge la professione."""
    kept: list[dict] = []
    for row in rows:
        title = row["title"]
        if P.is_talent_pool(title) or _POOL_TITLE.search(title):
            stats["talent_pool"] = stats.get("talent_pool", 0) + 1
            continue
        profession = None if _NOT_CLINICAL.search(title) else P.classify(title, _TITLE_MAP)
        if profession is None:
            stats["not_clinical"] = stats.get("not_clinical", 0) + 1
            continue
        kept.append({**row, "title": clean_title(title), "profession": profession})
    return kept


class CerbaScraper(BaseScraper):
    slug = "cerba"
    name = "Cerba HealthCare Italia - Lavora con noi"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        errors = 0
        rows: list[dict] = []
        try:
            known: set[str] = set()
            for page in range(1, MAX_PAGES + 1):
                url = LIST_URL if page == 1 else f"{LIST_URL}&page={page}"
                try:
                    found = parse_list(client.get_text(url))
                except Exception:  # noqa: BLE001
                    errors += 1
                    break
                new = [r for r in found if r["id"] not in known]
                known.update(r["id"] for r in new)
                rows.extend(new)
                if not new:
                    break
            self.stats["listed"] = len(rows)
            for row in select_rows(rows, self.stats):
                try:
                    html = client.get_text(urljoin(BASE, row["path"]) + "?LCID=1040")
                except Exception:  # noqa: BLE001
                    errors += 1
                    continue
                job = parse_detail(html, row, self.stats)
                if job:
                    jobs.append(job)
        finally:
            client.close()
        self.last_listings_complete = errors == 0 or errors <= max(2, len(rows) // 10)
        self.stats["errors"] = errors
        self.stats["published"] = len(jobs)
        return jobs
