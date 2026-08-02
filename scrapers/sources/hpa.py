from __future__ import annotations

import re
from html import unescape
from urllib.parse import urljoin

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_district, guess_profession, html_to_text

BASE = "https://www.grupohpa.com"
LIST_URL = f"{BASE}/pt/empregos/"

REGION_DISTRICT = {
    "algarve": "Faro",
    "alentejo": "Setúbal",  # HPA Alentejo (Sines)
    "madeira": "Madeira",
}

LIST_ITEM_RE = re.compile(
    r'<h3 class="job-title">\s*(.*?)\s*</h3>.*?'
    r'<a href="(/pt/empregos/[^"]+)"[^>]*class="[^"]*btn-jobs',
    re.I | re.S,
)


class HpaScraper(BaseScraper):
    slug = "hpa"
    name = "Grupo HPA Saúde"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.35)
        try:
            items = self._list_jobs(client)
            jobs: list[JobPayload] = []
            for item in items:
                job = self._to_job(client, item)
                if job:
                    jobs.append(job)
            return jobs
        finally:
            client.close()

    def _list_jobs(self, client: HttpClient) -> list[dict]:
        html = client.get_text(LIST_URL)
        by_path: dict[str, dict] = {}
        for match in LIST_ITEM_RE.finditer(html):
            title = re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", match.group(1)))).strip()
            path = match.group(2).strip()
            if not title or not path or path.rstrip("/") == "/pt/empregos":
                continue
            by_path[path] = {"title": title, "path": path}
        return list(by_path.values())

    def _to_job(self, client: HttpClient, item: dict) -> JobPayload | None:
        path = item["path"]
        url = urljoin(BASE, path)
        html = client.get_text(url)
        title = _page_title(html) or item["title"]
        region, role_title = _split_region(title)
        description = _extract_description(html, title) or title
        district = _district_from(region, description)
        concelho = _concelho_hint(description)
        source_id = path.rstrip("/").rsplit("/", 1)[-1]
        if not source_id:
            return None

        return JobPayload(
            title=role_title or title,
            company="Grupo HPA Saúde",
            location_district=district,
            location_concelho=concelho,
            profession=guess_profession(f"{role_title or title} {description[:200]}"),
            specialty=None,
            sector="privado",
            contract_type=_guess_contract(description),
            description=description,
            requirements=None,
            salary=None,
            application_url=url,
            source=self.slug,
            source_id=source_id,
            published_at=None,
        )


def _page_title(html: str) -> str | None:
    match = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
    if not match:
        return None
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", match.group(1)))).strip()


def _split_region(title: str) -> tuple[str | None, str]:
    match = re.match(
        r"^\s*(Algarve|Alentejo|Madeira)\s*\|\s*(.+)$",
        title,
        re.I,
    )
    if not match:
        return None, title.strip()
    return match.group(1).strip().lower(), match.group(2).strip()


def _district_from(region: str | None, description: str) -> str:
    # A região no título (Algarve|Alentejo|Madeira) é a fonte de verdade.
    # A descrição partilha boilerplate com as três regiões.
    if region and region in REGION_DISTRICT:
        return REGION_DISTRICT[region]
    city = _concelho_hint(description)
    if city:
        hinted = guess_district(city)
        if hinted != "Portugal":
            return hinted
    return guess_district(region or description)


def _concelho_hint(description: str) -> str | None:
    match = re.search(
        r"Hospital Particular do Algarve\s*[-–]\s*([A-Za-zÀ-ú]+)",
        description,
        re.I,
    )
    if match:
        return match.group(1).strip()
    # Só o lead da oferta — o resto da página pode listar outras unidades.
    head = description[:400]
    for city in ("Sines", "Gambelas", "Alvor", "Funchal", "Portimão", "Faro"):
        if re.search(rf"\b{city}\b", head, re.I):
            return city
    return None


def _extract_description(html: str, title: str) -> str:
    match = re.search(r"<h1[^>]*>.*?</h1>(.*?)<form\b", html, re.I | re.S)
    chunk = match.group(1) if match else ""
    if not chunk:
        match = re.search(
            r'property="og:description"[^>]*content="([^"]*)"',
            html,
            re.I,
        )
        if match:
            return html_to_text(unescape(match.group(1)))
        return title
    chunk = re.sub(r"<script\b[^>]*>.*?</script>", " ", chunk, flags=re.I | re.S)
    chunk = re.sub(r"<style\b[^>]*>.*?</style>", " ", chunk, flags=re.I | re.S)
    text = html_to_text(chunk)
    # Cortar CTAs / formulário residual.
    text = re.split(
        r"\b(Candidatura|Enviar candidatura|Detalhes do formulário)\b",
        text,
        maxsplit=1,
        flags=re.I,
    )[0].strip()
    return text or title


def _guess_contract(description: str) -> str | None:
    t = description.lower()
    if "sem termo" in t:
        return "Sem termo"
    if "termo certo" in t or "a termo" in t:
        return "Contrato"
    if "40 horas" in t or "tempo inteiro" in t:
        return "Tempo inteiro"
    return None
