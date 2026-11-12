"""Diaverum Portugal — clínicas de hemodiálise (SAP SuccessFactors, career site clássico).

* Listagem: ``https://careers.diaverum.com/search/?q=&locationsearch=Portugal&startrow=N``
  (25 por página): ``a.jobTitle-link`` + ``.jobLocation`` ("Queluz, PT, 2745-225").
* Detalhe: ``[itemprop=description]`` e ``[itemprop=datePosted]``.
* robots.txt: só bloqueia /applybutton/, /talentcommunity/, /services/, /preapply/…
Os títulos vêm em inglês ("Hemodialysis Nurse"), tal como a Diaverum os publica.
Adicionado 2026-11-12 (levantamento de fontes novas). Pedidos com ≥1 s de intervalo.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from html import unescape

import httpx
from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text
from sources._farmacia_pt import resolve_place

BASE = "https://careers.diaverum.com"
COMPANY = "Diaverum"
PAGE_SIZE = 25

_PROFESSIONS = [
    (re.compile(r"nurse|enferm", re.I), "Enfermagem"),
    (re.compile(r"support worker|auxiliar|assistant", re.I), "Auxiliares"),
    (re.compile(r"physician|doctor|m[eé]dic|nephrolog", re.I), "Medicina"),
]
_NOT_HEALTH = re.compile(r"\bHR\b|human resources|administrative|finance|account|IT |sales", re.I)


def profession_for(title: str) -> str | None:
    for pattern, profession in _PROFESSIONS:
        if pattern.search(title):
            return profession
    return None


class DiaverumScraper(BaseScraper):
    slug = "diaverum"
    name = "Diaverum (hemodiálise)"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        try:
            rows: list[dict] = []
            for page in range(10):
                html = client.get_text(f"{BASE}/search/?q=&locationsearch=Portugal&startrow={page * PAGE_SIZE}")
                found = _parse_listing(html)
                known = {r["id"] for r in rows}
                new = [r for r in found if r["id"] not in known]
                rows.extend(new)
                if len(found) < PAGE_SIZE or not new:
                    break
            for row in rows:
                profession = profession_for(row["title"])
                if not profession or _NOT_HEALTH.search(row["title"]):
                    continue
                city = row["location"].split(",")[0].strip()
                place = resolve_place(city)
                if not place:
                    continue
                url = BASE + row["path"]
                try:
                    description, posted = _parse_detail(client.get_text(url))
                except httpx.HTTPError:
                    description, posted = "", None
                district, concelho = place
                jobs.append(
                    JobPayload(
                        title=row["title"],
                        company=COMPANY,
                        location_district=district,
                        location_concelho=concelho,
                        profession=profession,
                        specialty="Hemodiálise",
                        sector="privado",
                        contract_type=guess_contract(f"{row['title']} {description[:600]}"),
                        description=(description or row["title"])[:8000],
                        requirements=None,
                        salary=None,
                        application_url=url,
                        source=self.slug,
                        source_id=row["id"],
                        published_at=posted,
                    )
                )
        finally:
            client.close()
        return jobs


def _parse_listing(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []
    for link in soup.select("a.jobTitle-link"):
        href = link.get("href") or ""
        m = re.search(r"/job/[^/]+/(\d+)/?", href)
        if not m or any(r["id"] == m.group(1) for r in rows):
            continue
        row = link.find_parent("tr") or link.find_parent("li") or link.parent
        loc = row.select_one(".jobLocation") if row else None
        rows.append({
            "id": m.group(1),
            "path": href,
            "title": re.sub(r"\s+", " ", unescape(link.get_text(" "))).strip(),
            "location": re.sub(r"\s+", " ", loc.get_text(" ")).strip() if loc else "",
        })
    return rows


def _parse_detail(html: str) -> tuple[str, str | None]:
    soup = BeautifulSoup(html, "html.parser")
    node = soup.select_one('[itemprop="description"]') or soup.select_one(".jobdescription")
    description = html_to_text(str(node)).strip() if node else ""
    meta = soup.select_one('[itemprop="datePosted"]')
    try:
        posted = datetime.strptime(((meta.get("content") if meta else "") or "").strip(),
                                   "%a %b %d %H:%M:%S UTC %Y").replace(tzinfo=timezone.utc).isoformat()
    except ValueError:
        posted = None
    return description, posted
