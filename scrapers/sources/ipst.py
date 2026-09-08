from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_district, guess_profession, html_to_text

BASE = "https://www.ipst.pt"
YEAR_URL = (
    f"{BASE}/index.php/pt/procedimentos-concursais/"
    "1131-procedimentos-concursais-ano-2026"
)
YEAR_PRINT_URL = f"{YEAR_URL}?tmpl=component&print=1&page="


BEP_RE = re.compile(r"OE\d{6}/\d+", re.I)
LOC_RE = re.compile(
    r"Lisboa|Porto|Coimbra|Centro de Sangue|Transplanta[cç][aã]o",
    re.I,
)


class IpstScraper(BaseScraper):
    slug = "ipst"
    name = "IPST — Procedimentos concursais"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(timeout=90.0, min_interval=0.4)
        client.client.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "pt-PT,pt;q=0.9",
            }
        )
        try:
            html = client.get_text(YEAR_URL)
        finally:
            client.close()
        return _parse_year_page(html)


def _parse_year_page(html: str) -> list[JobPayload]:
    soup = BeautifulSoup(html, "lxml")
    item = soup.select_one(".item-page") or soup
    jobs: list[JobPayload] = []
    for p in item.select("p"):
        raw = p.get_text(" ", strip=True)
        if not raw.lower().startswith("procedimento"):
            continue
        bep = None
        apply = YEAR_URL
        ul = p.find_next_sibling("ul")
        links: list[str] = []
        if ul:
            for a in ul.select("a[href]"):
                label = a.get_text(" ", strip=True)
                href = urljoin(BASE, a.get("href") or "")
                links.append(f"- {label}: {href}")
                m = BEP_RE.search(label) or BEP_RE.search(href)
                if m:
                    bep = m.group(0).upper()
                if "aviso" in label.lower() and href.lower().endswith(".pdf"):
                    apply = href
        title = _title_from_procedure(raw)
        loc = _location(raw)
        district = guess_district(loc or "Lisboa")
        desc = raw
        if links:
            desc = raw + "\n\nDocumentos:\n" + "\n".join(links[:8])
        jobs.append(
            JobPayload(
                title=title,
                company="IPST, I.P.",
                location_district=district,
                location_concelho=loc or None,
                profession=guess_profession(title, raw[:240]),
                specialty=None,
                sector="publico",
                contract_type="Contrato",
                description=html_to_text(desc)[:5000],
                requirements=None,
                salary=None,
                application_url=apply,
                source="ipst",
                source_id=bep or re.sub(r"\W+", "-", title.lower())[:90],
                published_at=None,
            )
        )
    return jobs


def _title_from_procedure(raw: str) -> str:
    # "Procedimento Concursal Comum| 4 postos ... técnico auxiliar de saúde ..."
    body = raw.split("|", 1)[-1].strip() if "|" in raw else raw
    body = re.sub(r"^Procedimento Concursal[^\|]*\|?\s*", "", raw, flags=re.I).strip()
    if "|" in raw:
        body = raw.split("|", 1)[1].strip()
    # Shorten
    body = re.sub(r"\s+", " ", body)
    if len(body) > 160:
        body = body[:157].rstrip() + "…"
    return body or "Procedimento concursal IPST"


def _location(raw: str) -> str | None:
    m = LOC_RE.search(raw)
    if not m:
        return None
    token = m.group(0)
    if "lisboa" in token.lower():
        return "Lisboa"
    if "porto" in token.lower():
        return "Porto"
    if "coimbra" in token.lower():
        return "Coimbra"
    return token
