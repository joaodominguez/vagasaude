from __future__ import annotations

import re
from datetime import datetime
from html import unescape
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    extract_concurso_health_roles,
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
# Títulos PCI do tipo "Órgão abre concurso/processo seletivo…" — inúteis para SEO.
BUREAUCRATIC_TITLE_RE = re.compile(
    r"\b(?:abre|divulga|retifica|prorroga|publica|anuncia)\b",
    re.I,
)
ACRONYM_ORG_RE = re.compile(
    r"^([A-ZÁÉÍÓÚÂÊÔÃÕ]{2,}(?:/[A-ZÁÉÍÓÚ]{2,})?)\s*[-–—]\s+",
)


class PciConcursosScraper(BaseScraper):
    """PCI Concursos — analogia BEP para editais/PSS de saúde no BR."""

    slug = "pci_concursos"
    name = "PCI Concursos — Saúde"
    enrich_details: bool = True
    # Listagens saúde+enfermagem+médico ~400 URLs; precisa do corpo para
    # extrair cargo (Médico/Enfermeiro…) e rejeitar editais genéricos.
    max_detail_fetches: int | None = None

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.35)
        try:
            listings = self._collect_listings(client)
            details: dict[str, dict] = {}
            if self.enrich_details:
                targets = self._prioritize_for_detail(listings)
                limit = self.max_detail_fetches
                if limit is not None:
                    targets = targets[: max(0, limit)]
                for item in targets:
                    url = item["url"]
                    try:
                        details[url] = self._fetch_detail(client, url)
                    except Exception as exc:  # noqa: BLE001
                        print(f"[{self.slug}] detalhe {url}: {exc}")

            jobs: list[JobPayload] = []
            skipped = 0
            for item in listings:
                detail = details.get(item["url"]) or {}
                company = (item["org"] or "Órgão público").strip()
                summary = item.get("summary") or ""
                description = (
                    detail.get("description") or summary or item.get("title") or company
                )
                evidence = f"{item.get('title') or ''} {summary} {description[:2500]}"
                if not looks_like_health_concurso(item.get("title") or "", company, evidence):
                    skipped += 1
                    continue
                roles = extract_concurso_health_roles(evidence)
                title = self._compose_title(
                    roles=roles,
                    org=company,
                    uf=item.get("uf"),
                    listing_title=item.get("title") or "",
                    detail_title=detail.get("title") or "",
                )
                if not title:
                    skipped += 1
                    continue

                requirements = detail.get("requirements")
                salary = detail.get("salary") or self._salary_from_summary(summary)
                contract = guess_contract(f"{title} {description}") or "Concurso"
                state = state_from_uf(item.get("uf"))
                source_id = self._source_id(item["url"])
                profession_blob = f"{title} {' '.join(roles)} {summary}"
                jobs.append(
                    JobPayload(
                        title=title[:200],
                        company=company[:160],
                        location_district=state,
                        location_concelho=None,
                        profession=guess_profession(profession_blob),
                        specialty=roles[0] if len(roles) == 1 else None,
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
                    "(sem cargo clínico / tribunais / Forças Armadas)"
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

    def _prioritize_for_detail(self, listings: list[dict]) -> list[dict]:
        """Prioriza editais sem cargo óbvio no resumo (Vários Cargos / título burocrático)."""

        def score(item: dict) -> tuple[int, str]:
            summary = item.get("summary") or ""
            title = item.get("title") or ""
            roles = extract_concurso_health_roles(f"{title} {summary}")
            vague = 0
            if roles:
                vague = 2
            elif BUREAUCRATIC_TITLE_RE.search(title) or re.search(
                r"v[aá]rios\s+cargos", summary, re.I
            ):
                vague = 0
            else:
                vague = 1
            return (vague, item.get("url") or "")

        return sorted(listings, key=score)

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
        title = self._detail_headline(soup)
        body = soup.select_one('[itemprop="articleBody"]') or soup.select_one(
            "article"
        ) or soup.select_one("#conteudo")
        text = html_to_text(str(body)) if body else ""
        # Remove ruído do rodapé PCI (podcast / veja também).
        text = re.split(
            r"\n(?:Tenha a not[ií]cia completa|Ouça Podcast|Veja tamb[eé]m)",
            text,
            maxsplit=1,
            flags=re.I,
        )[0].strip()
        salary = None
        m = SALARY_RE.search(text or "")
        if m:
            salary = m.group(0)
        published = None
        time_el = soup.select_one("time[datetime]") or soup.select_one(
            '[itemprop="datePublished"]'
        )
        if time_el and time_el.get("datetime"):
            published = time_el["datetime"]
        return {
            "title": title,
            "description": text[:8000] if text else None,
            "requirements": None,
            "salary": salary,
            "published_at": published,
        }

    @staticmethod
    def _detail_headline(soup: BeautifulSoup) -> str | None:
        """PCI põe um <h1 id=logo> vazio antes do headline real."""
        headline = soup.select_one('[itemprop="headline"]')
        if headline:
            text = headline.get_text(" ", strip=True)
            if text:
                return text
        for h1 in soup.select("h1"):
            text = h1.get_text(" ", strip=True)
            if text and (h1.get("id") or "").lower() != "logo":
                return text
        if soup.title:
            text = soup.title.get_text(" ", strip=True)
            if text:
                return text.split("|")[0].strip() or None
        return None

    @classmethod
    def _compose_title(
        cls,
        *,
        roles: list[str],
        org: str,
        uf: str | None,
        listing_title: str,
        detail_title: str,
    ) -> str | None:
        short_org = cls._short_org(org)
        uf_bit = f" ({uf.strip().upper()})" if uf and uf.strip() else ""

        if roles:
            role_part = cls._format_roles(roles)
            return f"{role_part} — {short_org}{uf_bit}"

        # Fallback: tentar cargo no título PCI ("… para Enfermeiro").
        for raw in (listing_title, detail_title):
            m = re.search(
                r"\bpara\s+(.+?)(?:\s+com\s+|\s+no\s+|\s+na\s+|\s*$)",
                raw or "",
                re.I,
            )
            if not m:
                continue
            candidate = m.group(1).strip(" .,-–—")
            extracted = extract_concurso_health_roles(candidate)
            if extracted:
                return f"{cls._format_roles(extracted)} — {short_org}{uf_bit}"
            if candidate and not BUREAUCRATIC_TITLE_RE.search(candidate):
                if looks_like_health_concurso(candidate, org, ""):
                    return f"{candidate[:80]} — {short_org}{uf_bit}"

        # Sem cargo clínico: não publicar título burocrático.
        return None

    @staticmethod
    def _format_roles(roles: list[str]) -> str:
        if len(roles) == 1:
            return roles[0]
        if len(roles) == 2:
            paired = f"{roles[0]} e {roles[1]}"
            # ACS + ACE etc. estouram o limite do card — compacta.
            if len(paired) > 42:
                return f"{roles[0]} e outras especialidades"
            return paired
        # Mantém título curto para SEO/cards (shortenJobTitle corta aos 96).
        return f"{roles[0]} e outras especialidades"

    @staticmethod
    def _short_org(org: str) -> str:
        org = re.sub(r"\s+", " ", (org or "").strip())
        if not org:
            return "Órgão público"
        m = ACRONYM_ORG_RE.match(org)
        if m:
            return m.group(1)
        # "Prefeitura do Município de X" / "Prefeitura de X" → cidade
        m = re.match(
            r"^Prefeitura(?:\s+do\s+Munic[ií]pio)?\s+de\s+(.+?)(?:\s*[-–—]|$)",
            org,
            re.I,
        )
        if m:
            city = m.group(1).strip()
            return f"Prefeitura de {city}"[:48]
        if len(org) > 48 and " - " in org:
            return org.split(" - ", 1)[0].strip()[:48]
        return org[:48]

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
