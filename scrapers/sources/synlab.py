from __future__ import annotations

import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_district,
    guess_profession,
    html_to_text,
    norm,
)

BASE = "https://www.synlab.pt"
LIST_URL = f"{BASE}/recrutamento"

# Locais que o guess_district não conhece (postos de colheita SYNLAB).
LOCAIS: dict[str, tuple[str, str]] = {
    "entroncamento": ("Santarém", "Entroncamento"),
    "mora": ("Évora", "Mora"),
    "ponte de sor": ("Portalegre", "Ponte de Sor"),
    "parede": ("Lisboa", "Cascais"),
    "cascais": ("Lisboa", "Cascais"),
    "parque das nacoes": ("Lisboa", "Lisboa"),
    "torres de lisboa": ("Lisboa", "Lisboa"),
    "lisboa": ("Lisboa", "Lisboa"),
    "porto": ("Porto", "Porto"),
    "leiria": ("Leiria", "Leiria"),
}


class SynlabScraper(BaseScraper):
    slug = "synlab"
    name = "SYNLAB"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        try:
            for url in _list_urls(client.get_text(LIST_URL)):
                try:
                    html = client.get_text(url)
                except Exception:
                    continue
                job = parse_synlab_detail(html, url=url, source=self.slug)
                # Alguns slugs redirecionam para outra vaga: dedupe pelo URL final.
                if job and job.source_id not in seen:
                    seen.add(job.source_id)
                    jobs.append(job)
        finally:
            client.close()
        return jobs


def _list_urls(html: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    out: list[str] = []
    for link in soup.select(".recruitment-list a[href], a[href*='/recrutamento/']"):
        href = (link.get("href") or "").strip()
        if not re.search(r"/recrutamento/.+", href):
            continue
        url = urljoin(BASE, href)
        if url not in out:
            out.append(url)
    return out


def _final_path(soup: BeautifulSoup, url: str) -> str:
    canonical = soup.select_one("link[rel=canonical]")
    href = (canonical.get("href") if canonical else None) or url
    return urlparse(href).path.rstrip("/") or urlparse(url).path.rstrip("/")


def _location(text: str) -> tuple[str, str | None]:
    key = norm(text)
    for needle, (district, concelho) in LOCAIS.items():
        if re.search(rf"\b{needle}\b", key):
            return district, concelho
    district = guess_district(text)
    return district, (text or None)


def _rich_text(html: str) -> str:
    # <li> com quebras de linha e <br> soltos geram "-" isolados no html_to_text.
    html = re.sub(r"\s+", " ", html)
    html = re.sub(r"(?i)(<br\s*/?>\s*)+(</li>|</p>)", r"\2", html)
    html = re.sub(r"(?i)<li>\s*", "<li>", html)
    text = html_to_text(html).replace("\xa0", " ")
    text = re.sub(r"[ \t]{2,}", " ", text)
    # Linha em branco antes dos cabeçalhos ("O que vai fazer?") e do fecho.
    text = re.sub(r"\n+(?=[^\n-][^\n]*\?\n- )", "\n\n", text)
    text = re.sub(r"\n+(?=Construa a sua carreira)", "\n\n", text)
    return text.strip()


def _contract(title: str, description: str) -> str | None:
    # A introdução fala em "prestação de serviços de diagnóstico": usar só a oferta.
    offer = description.split("O que oferecemos", 1)
    text = title + ("\n" + offer[1] if len(offer) == 2 else "")
    return guess_contract(text)


def parse_synlab_detail(html: str, url: str, source: str = "synlab") -> JobPayload | None:
    soup = BeautifulSoup(html, "lxml")
    body = soup.select_one(".recruitment-detail .recruitment-body") or soup.select_one(
        ".recruitment-body"
    )
    if not body:
        return None
    h1 = body.select_one("h1")
    title = re.sub(r"\s+", " ", h1.get_text(" ", strip=True) if h1 else "").strip()
    if not title:
        return None
    loc_el = body.select_one(".location")
    location = loc_el.get_text(" ", strip=True) if loc_el else ""
    # Sem local explícito, o sufixo do título costuma trazê-lo.
    if not location and re.search(r"\s[-–]\s", title):
        location = re.split(r"\s[-–]\s", title, maxsplit=1)[1]
    district, concelho = _location(location)

    rich = body.select_one(".rich-text")
    description = _rich_text(str(rich)) if rich else ""
    description = description or title

    path = _final_path(soup, url)
    slug = path.split("/recrutamento/", 1)[-1]
    source_id = re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-") or path

    return JobPayload(
        title=title,
        company="SYNLAB",
        location_district=district,
        location_concelho=concelho,
        profession=guess_profession(title),
        specialty=None,
        sector="privado",
        contract_type=_contract(title, description),
        description=description,
        requirements=None,
        salary=None,
        application_url=f"{BASE}{path}",
        source=source,
        source_id=source_id,
        published_at=None,
    )
