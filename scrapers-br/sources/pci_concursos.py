from __future__ import annotations

import re
from datetime import datetime
from html import unescape
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_profession,
    html_to_text,
    looks_like_health_concurso,
    state_from_uf,
)

LIST_URL = "https://www.pciconcursos.com.br/vagas/saude/"
# Complementos de volume clínico (mesma listagem HTML).
EXTRA_LIST_URLS = (
    "https://www.pciconcursos.com.br/vagas/enfermagem/",
    "https://www.pciconcursos.com.br/vagas/medico/",
)

DEADLINE_RE = re.compile(r"^(\d{2})/(\d{2})/(\d{4})$")
SALARY_RE = re.compile(r"R\$\s*[\d.]+(?:,\d+)?", re.I)
SOURCE_ID_RE = re.compile(r"/noticias/([^/?#]+)", re.I)


class PciConcursosScraper(BaseScraper):
    """PCI Concursos — analogia BEP para editais/PSS de saúde no BR."""

    slug = "pci_concursos"
    name = "PCI Concursos — Saúde"
    enrich_details: bool = True
    max_detail_fetches: int = 80

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.4)
        try:
            listings = self._collect_listings(client)
            details: dict[str, dict] = {}
            if self.enrich_details:
                for item in listings[: self.max_detail_fetches]:
                    url = item["url"]
                    try:
                        details[url] = self._fetch_detail(client, url)
                    except Exception as exc:  # noqa: BLE001
                        print(f"[{self.slug}] detalhe {url}: {exc}")

            jobs: list[JobPayload] = []
            skipped = 0
            for item in listings:
                detail = details.get(item["url"]) or {}
                title = (detail.get("title") or item["title"] or item["org"]).strip()
                if not title:
                    continue
                company = (item["org"] or "Órgão público").strip()
                description = detail.get("description") or item["summary"] or title
                summary = item.get("summary") or ""
                if not looks_like_health_concurso(
                    title, company, f"{summary} {description[:1200]}"
                ):
                    skipped += 1
                    continue
                requirements = detail.get("requirements")
                salary = detail.get("salary") or self._salary_from_summary(item["summary"])
                contract = guess_contract(f"{title} {description}") or "Concurso"
                state = state_from_uf(item.get("uf"))
                source_id = self._source_id(item["url"])
                jobs.append(
                    JobPayload(
                        title=title[:200],
                        company=company[:160],
                        location_district=state,
                        location_concelho=None,
                        profession=guess_profession(f"{title} {item['summary']}"),
                        specialty=None,
                        sector="publico",
                        contract_type=contract,
                        description=description[:8000],
                        requirements=requirements,
                        salary=salary,
                        application_url=item["url"],
                        source=self.slug,
                        source_id=source_id,
                        published_at=detail.get("published_at"),
                        expires_at=self._deadline_iso(item.get("deadline")),
                    )
                )
            if skipped:
                print(
                    f"[{self.slug}] filtrados {skipped} editais fora da saúde "
                    "(tribunais/Forças Armadas/etc.)"
                )
            return jobs
        finally:
            client.close()

    def _collect_listings(self, client: HttpClient) -> list[dict]:
        by_url: dict[str, dict] = {}
        for url in (LIST_URL, *EXTRA_LIST_URLS):
            try:
                html = client.get_text(url)
            except Exception as exc:  # noqa: BLE001
                print(f"[{self.slug}] listagem {url}: {exc}")
                continue
            for item in self._parse_listing(html):
                by_url[item["url"]] = item
        return list(by_url.values())

    def _parse_listing(self, html: str) -> list[dict]:
        soup = BeautifulSoup(html, "lxml")
        items: list[dict] = []
        seen: set[str] = set()
        for ca in soup.select("div.ca"):
            a = ca.select_one("a[href]")
            if not a:
                continue
            href = (a.get("href") or "").strip()
            if not href or href in seen:
                continue
            if "/noticias/" not in href:
                continue
            seen.add(href)
            org = a.get_text(" ", strip=True)
            title = (a.get("title") or org).strip()
            uf_el = ca.select_one("div.cc")
            summary_el = ca.select_one("div.cd")
            deadline_el = ca.select_one("div.ce")
            items.append(
                {
                    "org": org,
                    "title": unescape(title),
                    "url": href,
                    "uf": uf_el.get_text(strip=True) if uf_el else None,
                    "summary": summary_el.get_text(" ", strip=True) if summary_el else "",
                    "deadline": deadline_el.get_text(strip=True) if deadline_el else None,
                }
            )
        return items

    def _fetch_detail(self, client: HttpClient, url: str) -> dict:
        html = client.get_text(url)
        soup = BeautifulSoup(html, "lxml")
        h1 = soup.select_one("h1") or soup.select_one('[itemprop="headline"]')
        title = h1.get_text(" ", strip=True) if h1 else None
        body = soup.select_one('[itemprop="articleBody"]') or soup.select_one("#conteudo")
        text = html_to_text(str(body)) if body else ""
        requirements = None
        if text:
            # Mantém o corpo; requisitos ficam embutidos no edital narrado.
            requirements = None
        salary = None
        m = SALARY_RE.search(text or "")
        if m:
            salary = m.group(0)
        published = None
        time_el = soup.select_one("time[datetime]") or soup.select_one('[itemprop="datePublished"]')
        if time_el and time_el.get("datetime"):
            published = time_el["datetime"]
        return {
            "title": title,
            "description": text[:8000] if text else None,
            "requirements": requirements,
            "salary": salary,
            "published_at": published,
        }

    @staticmethod
    def _salary_from_summary(summary: str | None) -> str | None:
        if not summary:
            return None
        m = SALARY_RE.search(summary)
        return m.group(0) if m else None

    @staticmethod
    def _deadline_iso(deadline: str | None) -> str | None:
        if not deadline:
            return None
        m = DEADLINE_RE.match(deadline.strip())
        if not m:
            return None
        day, month, year = m.groups()
        try:
            return datetime(int(year), int(month), int(day)).date().isoformat()
        except ValueError:
            return None

    @staticmethod
    def _source_id(url: str) -> str:
        m = SOURCE_ID_RE.search(url)
        if m:
            return m.group(1)[:160]
        path = urlparse(url).path.strip("/").replace("/", "-")
        return path[:160] or url[-80:]
