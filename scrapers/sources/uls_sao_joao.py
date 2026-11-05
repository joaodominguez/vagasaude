from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_profession, html_to_text
from common.title import shorten_job_title

BASE = "https://concursosrh-ulssjoao.min-saude.pt"
LIST = f"{BASE}/processos-ativos"


class UlsSaoJoaoScraper(BaseScraper):
    slug = "uls_sao_joao"
    name = "ULS São João"
    company = "ULS São João, EPE"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(timeout=45.0, min_interval=0.4)
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
        jobs = _parse(html)
        # Sem concursos abertos o site mostra esta frase: 0 vagas é legítimo.
        # Sem a frase e sem links, a página mudou: erro (o health check avisa).
        if not jobs and "Não existem procedimentos" not in html:
            raise RuntimeError("ULS São João: lista de processos sem links nem aviso de vazio (página mudou?)")
        return jobs


def _parse(html: str) -> list[JobPayload]:
    soup = BeautifulSoup(html, "lxml")
    jobs: list[JobPayload] = []
    for a in soup.select('a[href*="recruitment_process_id="]'):
        title = a.get_text(" ", strip=True)
        href = urljoin(BASE, a.get("href") or "")
        if not title or len(title) < 12:
            continue
        m = re.search(r"recruitment_process_id=(\d+)", href)
        source_id = m.group(1) if m else href
        # Grab nearby resumo if present
        parent = a.find_parent(["div", "section", "article", "li"]) or a.parent
        blob = parent.get_text("\n", strip=True) if parent else title
        desc = html_to_text(blob)[:4000] or title
        short_title = shorten_job_title(title)
        jobs.append(
            JobPayload(
                title=short_title,
                company="ULS São João, EPE",
                location_district="Porto",
                location_concelho="Porto",
                profession=guess_profession(short_title, desc[:240]),
                specialty=None,
                sector="publico",
                contract_type="Contrato",
                description=desc,
                requirements=None,
                salary=None,
                application_url=href,
                source="uls_sao_joao",
                source_id=str(source_id),
                published_at=None,
            )
        )
    # dedupe by source_id
    by_id = {job.source_id: job for job in jobs}
    return list(by_id.values())
