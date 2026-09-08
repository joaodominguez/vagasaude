from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_profession, html_to_text
from common.title import shorten_job_title

LIST = "https://www.inem.pt/category/institucional/recrutamento/"
BASE = "https://www.inem.pt"

OPEN_HINT = re.compile(
    r"abertura|aviso\s*\(extrato\)|candidaturas?\s+at[eé]|prazo|"
    r"procedimento\s+concursal|recrutamento",
    re.I,
)
ROLE_RE = re.compile(
    r"enfermeir|TEPH|t[eé]cnic[oa]\s+de\s+emerg|m[eé]dic|"
    r"operador\s+de\s+telecomunica|psicolog|param[eé]dic",
    re.I,
)
SKIP_RE = re.compile(
    r"lista\s+(provis[oó]ria|definitiva)|ata\s*n|audi[eê]ncia\s+pr[eé]via|"
    r"homologa|mobilidade\s+interna|mapa\s+de\s+pessoal",
    re.I,
)


class InemScraper(BaseScraper):
    slug = "inem"
    name = "INEM — Recrutamento"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(timeout=60.0, min_interval=0.5)
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
            html = client.get_text(LIST)
        finally:
            client.close()
        return _parse(html)


def _parse(html: str) -> list[JobPayload]:
    soup = BeautifulSoup(html, "lxml")
    jobs: list[JobPayload] = []
    seen: set[str] = set()

    # Prefer structured headings that look like open contests.
    for heading in soup.select("h2, h3, h4, strong"):
        title = heading.get_text(" ", strip=True)
        if len(title) < 20 or len(title) > 220:
            continue
        if SKIP_RE.search(title):
            continue
        if not ROLE_RE.search(title):
            continue
        if not OPEN_HINT.search(title) and "TEPH" not in title.upper() and "enfermeir" not in title.lower():
            # Keep role titles that are clear job contests even without "abertura"
            if "concurso" not in title.lower() and "procedimento" not in title.lower():
                continue

        # Find a nearby application / detail link
        apply = LIST
        block = heading.find_parent(["article", "div", "section", "li"]) or heading.parent
        if block:
            for a in block.select("a[href]"):
                href = urljoin(BASE, a.get("href") or "")
                label = a.get_text(" ", strip=True).lower()
                if "bep.gov.pt" in href or "aviso" in label or href.endswith(".pdf"):
                    apply = href
                    break

        source_id = re.sub(r"\W+", "-", title.lower())[:90]
        if source_id in seen:
            continue
        seen.add(source_id)
        desc = title
        if block:
            desc = html_to_text(block.get_text("\n", strip=True))[:3500] or title
        short_title = shorten_job_title(title)
        jobs.append(
            JobPayload(
                title=short_title,
                company="INEM, I.P.",
                location_district="Lisboa",
                location_concelho="Lisboa",
                profession=guess_profession(short_title),
                specialty=None,
                sector="publico",
                contract_type="Contrato",
                description=desc,
                requirements=None,
                salary=None,
                application_url=apply,
                source="inem",
                source_id=source_id,
                published_at=None,
            )
        )
    return jobs[:40]
