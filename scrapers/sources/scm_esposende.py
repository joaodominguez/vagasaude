from __future__ import annotations

import re
from html import unescape
from urllib.parse import urljoin

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_profession, html_to_text

BASE = "https://www.scmesposende.pt"
LIST = f"{BASE}/recrutamento"


class ScmEsposendeScraper(BaseScraper):
    slug = "scm_esposende"
    name = "Santa Casa Misericórdia Esposende"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.35)
        try:
            html = client.get_text(LIST)
            paths = sorted(
                {
                    path
                    for path in re.findall(r'href="(/recrutamento/[^"#]+)"', html)
                    if path.rstrip("/") != "/recrutamento"
                }
            )
            jobs: list[JobPayload] = []
            for path in paths:
                job = self._detail(client, path)
                if job:
                    jobs.append(job)
            return jobs
        finally:
            client.close()

    def _detail(self, client: HttpClient, path: str) -> JobPayload | None:
        url = urljoin(BASE, path)
        html = client.get_text(url)
        title = _h1(html) or path.rstrip("/").rsplit("/", 1)[-1].replace("-", " ")
        title = title.strip()
        if not title:
            return None

        description = _main_text(html) or title
        requirements = None
        if "Habilitações" in description or "Habilitacoes" in description:
            parts = re.split(r"Habilita[cç][oõ]es[^\n]*", description, maxsplit=1)
            if len(parts) == 2:
                requirements = parts[1].strip()[:800] or None

        source_id = path.rstrip("/").rsplit("/", 1)[-1]
        return JobPayload(
            title=title if " " in title else title.title(),
            company="Santa Casa da Misericórdia de Esposende",
            location_district="Braga",
            location_concelho="Esposende",
            profession=guess_profession(f"{title} {description[:200]}"),
            specialty=None,
            sector="ipss",
            contract_type=None,
            description=description[:4000],
            requirements=requirements,
            salary=None,
            application_url=url,
            source=self.slug,
            source_id=source_id,
            published_at=None,
        )


def _h1(html: str) -> str:
    match = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
    if not match:
        return ""
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", match.group(1)))).strip()


def _main_text(html: str) -> str:
    match = re.search(r"<main[\s\S]*?</main>", html, re.I)
    chunk = match.group(0) if match else html
    chunk = re.sub(r"<script[\s\S]*?</script>", " ", chunk, flags=re.I)
    chunk = re.sub(r"<style[\s\S]*?</style>", " ", chunk, flags=re.I)
    # Drop nav/footer noise when possible
    text = html_to_text(chunk)
    # Prefer from role heading onward
    for needle in ("O/A Enfermeiro", "O Nutricionista", "O/A Técnico", "tem como missão"):
        idx = text.find(needle)
        if idx >= 0:
            text = text[idx:]
            break
    return text.strip()
