"""SAP SuccessFactors — Career Site Builder clássico (multi-board).

(O Sírio-Libanês usa a variante "Unify" e tem leitor próprio por feed: hsl_sirio.py.)

Boards públicos `https://<host>/search/`:
* Listagem: ``/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=N`` (25 por página,
  HTML no servidor): ``a.jobTitle-link`` (título + ``/job/<slug>/<id>/``) e ``.jobLocation``.
* Detalhe: ``/job/<slug>/<id>/`` — descrição em ``[itemprop=description]`` e data em
  ``[itemprop=datePosted]`` ("Thu Nov 12 02:00:00 UTC 2026").
* robots.txt: só bloqueia /applybutton/, /talentcommunity/, /services/, /preapply/ e afins.

Filtro de saúde no título da LISTAGEM (antes de pedir detalhes): operadoras como a Amil misturam
hospitais (Luz, Santa Helena, Pasteur) com funções corporativas e telemarketing.
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
from common.normalize import (
    guess_contract,
    guess_profession,
    html_to_text,
    looks_like_health_job,
    state_from_uf,
)

PAGE_SIZE = 25
MAX_PAGES = 20

# (url base, empresa, setor, prefixo do source_id)
Board = tuple[str, str, str, str]


def parse_listing(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []
    seen: set[str] = set()
    for link in soup.select("a.jobTitle-link"):
        href = link.get("href") or ""
        m = re.search(r"/job/[^/]+/(\d+)/?", href)
        if not m or m.group(1) in seen:
            continue
        seen.add(m.group(1))
        row = link.find_parent("tr") or link.find_parent("li") or link.parent
        location = row.select_one(".jobLocation") if row else None
        rows.append(
            {
                "id": m.group(1),
                "path": href,
                "title": re.sub(r"\s+", " ", unescape(link.get_text(" "))).strip(),
                "location": re.sub(r"\s+", " ", location.get_text(" ")).strip() if location else "",
            }
        )
    return rows


def parse_detail(html: str) -> tuple[str, str | None]:
    soup = BeautifulSoup(html, "html.parser")
    node = soup.select_one('[itemprop="description"]') or soup.select_one(".jobdescription")
    description = html_to_text(str(node)).strip() if node else ""
    meta = soup.select_one('[itemprop="datePosted"]')
    raw = (meta.get("content") if meta else None) or ""
    try:
        posted = (
            datetime.strptime(raw.strip(), "%a %b %d %H:%M:%S UTC %Y")
            .replace(tzinfo=timezone.utc)
            .isoformat()
        )
    except ValueError:
        posted = None
    return description, posted


_SMALL_WORDS = {"de", "da", "do", "das", "dos", "e"}
_ACCENTS = {"Sao Paulo": "São Paulo", "Brasilia": "Brasília", "Goiania": "Goiânia", "Belem": "Belém",
            "Niteroi": "Niterói", "Maceio": "Maceió", "Florianopolis": "Florianópolis"}


def _city(raw: str) -> str:
    words = raw.strip().lower().split()
    titled = " ".join(w if (i and w in _SMALL_WORDS) else w.capitalize() for i, w in enumerate(words))
    return _ACCENTS.get(titled, titled)


def split_location(raw: str, title: str = "") -> tuple[str, str | None]:
    """'SAO PAULO, SAO PAULO' / 'Vila Mariana, SP' → (estado, cidade). Sem local na listagem,
    usa o fim do título ('… - Méier, RJ' → Rio de Janeiro)."""
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    if parts:
        last = parts[-1]
        state = state_from_uf(last if len(last) == 2 else None, None if len(last) == 2 else last)
        if state != "Brasil":
            return state, (_city(parts[0]) if len(parts) > 1 and len(parts[0]) > 2 else None)
    m = re.search(r",\s*([A-Z]{2})\s*$", title)
    if m:
        return state_from_uf(m.group(1)), None
    return "Brasil", None


class SuccessFactorsScraper(BaseScraper):
    slug = "successfactors"
    name = "Hospitais e operadoras (SAP SuccessFactors)"
    BOARDS: list[Board] = [
        ("https://carreirasgrupo.amil.com.br", "Grupo Amil", "privado", "amil"),
        ("https://carreiras.preventsenior.com.br", "Prevent Senior", "privado", "prevent"),
    ]

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        try:
            for base, company, sector, prefix in self.BOARDS:
                rows: list[dict] = []
                for page in range(MAX_PAGES):
                    url = (
                        f"{base}/search/?q=&sortColumn=referencedate&sortDirection=desc"
                        f"&startrow={page * PAGE_SIZE}"
                    )
                    try:
                        found = parse_listing(client.get_text(url))
                    except httpx.HTTPError as exc:
                        print(f"[{self.slug}] {prefix}: erro na listagem ({exc})")
                        break
                    known = {x["id"] for x in rows}
                    new = [r for r in found if r["id"] not in known]
                    rows.extend(new)
                    if len(found) < PAGE_SIZE or not new:
                        break
                # Bancos de talentos não são vagas concretas (o Google for Jobs desaconselha-os).
                kept = [
                    r
                    for r in rows
                    if looks_like_health_job(r["title"]) and not re.match(r"banco de talentos", r["title"], re.I)
                ]
                print(f"[{self.slug}] {prefix}: {len(kept)}/{len(rows)} vagas após filtro")
                for row in kept:
                    detail_url = base + row["path"]
                    try:
                        description, posted = parse_detail(client.get_text(detail_url))
                    except httpx.HTTPError:
                        description, posted = "", None
                    state, city = split_location(row["location"], row["title"])
                    jobs.append(
                        JobPayload(
                            title=row["title"],
                            company=company,
                            location_district=state,
                            location_concelho=city,
                            profession=guess_profession(row["title"]),
                            specialty=None,
                            sector=sector,
                            contract_type=guess_contract(f"{row['title']} {description[:600]}"),
                            description=(description or row["title"])[:8000],
                            requirements=None,
                            salary=None,
                            application_url=detail_url,
                            source=self.slug,
                            source_id=f"{prefix}-{row['id']}",
                            published_at=posted,
                        )
                    )
        finally:
            client.close()
        return jobs
