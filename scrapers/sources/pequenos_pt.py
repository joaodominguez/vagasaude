"""Sites pequenos de entidades de saúde com página de recrutamento em HTML (WordPress).

Cada site: listagem → links de detalhe; no detalhe, título (og:title), descrição e local.
Adicionado 2026-11-12 (levantamento de fontes novas):
  * Cruz Vermelha Portuguesa — /empregos/<slug>/ (o slug nem sempre corresponde ao título:
    usa-se sempre o título da página de detalhe). Só funções de saúde/cuidados.
  * Irmãs Hospitaleiras — /oportunidades/<slug>/ (unidades de saúde mental e reabilitação).
  * APDP — Associação Protectora dos Diabéticos de Portugal (Lisboa).
Fica de fora o Hospital Cruz Vermelha: só tem anúncios genéricos de "banco" de candidaturas.
robots.txt dos três: só bloqueiam wp-admin. Pedidos com ≥1 s de intervalo.
"""
from __future__ import annotations

import re
from html import unescape

import httpx
from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_profession, html_to_text
from sources._farmacia_pt import resolve_place


class DetailPagesScraper(BaseScraper):
    listing_url: str
    link_pattern: re.Pattern[str]
    company: str
    sector: str = "ipss"
    default_place: tuple[str, str | None] | None = None
    exclude: re.Pattern[str] | None = None

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        try:
            listing = client.get_text(self.listing_url)
            links = []
            for href in re.findall(r'href="([^"]+)"', listing):
                href = unescape(href)
                if self.link_pattern.search(href) and href.rstrip("/") != self.listing_url.rstrip("/") and href not in links:
                    links.append(href)
            for url in links:
                try:
                    html = client.get_text(url)
                except httpx.HTTPError:
                    continue
                job = self._to_job(url, html)
                if job:
                    jobs.append(job)
        finally:
            client.close()
        return jobs

    def title_of(self, soup: BeautifulSoup) -> str:
        og = soup.find("meta", property="og:title")
        raw = og["content"] if og and og.get("content") else (soup.h1.get_text(" ") if soup.h1 else "")
        return re.split(r"\s+[—–-]\s+(?=[^|]*$)", unescape(raw).strip())[0].strip()

    def description_of(self, soup: BeautifulSoup) -> str:
        blocks = soup.select(".elementor-widget-text-editor")
        if blocks:
            return "\n\n".join(html_to_text(str(b)).strip() for b in blocks if b.get_text(strip=True))
        main = soup.select_one(".site-content") or soup.select_one("main") or soup.body
        return html_to_text(str(main)).strip() if main else ""

    def profession_for(self, title: str) -> str:
        return guess_profession(title, "Outros")

    def place_of(self, title: str, description: str) -> tuple[str, str | None] | None:
        tail = title.split("|", 1)[1] if "|" in title else ""
        candidates = [p.strip() for p in re.split(r"[/,]|\s-\s|-(?=[A-ZÁÉÍÓÚ])", tail) if p.strip()]
        return resolve_place(*candidates) or self.default_place

    def _to_job(self, url: str, html: str) -> JobPayload | None:
        soup = BeautifulSoup(html, "html.parser")
        title = self.title_of(soup)
        if not title or (self.exclude and self.exclude.search(title)):
            return None
        description = self.description_of(soup)
        place = self.place_of(title, description)
        if not place:
            return None
        district, concelho = place
        clean_title = re.sub(r"\s*\(M/F\)|\(a\)", "", title, flags=re.I)
        clean_title = re.sub(r"\s+", " ", clean_title).strip()
        if clean_title.isupper():
            clean_title = clean_title.capitalize()
        return JobPayload(
            title=clean_title,
            company=self.company,
            location_district=district,
            location_concelho=concelho,
            profession=self.profession_for(clean_title),
            specialty=None,
            sector=self.sector,
            contract_type=guess_contract(f"{title} {description[:800]}"),
            description=(description or clean_title)[:8000],
            requirements=None,
            salary=None,
            application_url=url,
            source=self.slug,
            source_id=url.rstrip("/").rsplit("/", 1)[-1],
            published_at=None,
        )


class CruzVermelhaScraper(DetailPagesScraper):
    slug = "cruz_vermelha"
    name = "Cruz Vermelha Portuguesa"
    company = "Cruz Vermelha Portuguesa"
    listing_url = "https://www.cruzvermelha.pt/cruz-vermelha-portuguesa/trabalhar-na-cruz-vermelha-portuguesa/"
    link_pattern = re.compile(r"cruzvermelha\.pt/empregos/[^/]+/?$")
    exclude = re.compile(
        r"projet|forma[cç][aã]o|formador|teleassist|coordenador|gestor|administrativ|bolsa", re.I
    )

    def profession_for(self, title: str) -> str:
        if re.search(r"tripulante|ambul[aâ]ncia|a[cç][aã]o direta", title, re.I):
            return "Auxiliares"
        return super().profession_for(title)


class IrmasHospitaleirasScraper(DetailPagesScraper):
    slug = "irmas_hospitaleiras"
    name = "Irmãs Hospitaleiras"
    company = "Irmãs Hospitaleiras"
    listing_url = "https://irmashospitaleiras.pt/trabalhe-connosco/"
    link_pattern = re.compile(r"irmashospitaleiras\.pt/oportunidades/[^/]+/?$")

    def title_of(self, soup: BeautifulSoup) -> str:
        base = super().title_of(soup)
        if base.isupper():
            base = base.capitalize()
        m = re.search(r"Irm[ãa]s Hospitaleiras\s+([^|\n]{2,40}?)\s*\|", soup.get_text(" "))
        unit = m.group(1).strip() if m else ""
        return f"{base} – {unit}" if unit and unit.lower() not in base.lower() else base

    def place_of(self, title: str, description: str) -> tuple[str, str | None] | None:
        # "Irmãs Hospitaleiras Idanha | Sintra" (Idanha = Belas, Sintra; não Idanha-a-Nova).
        m = re.search(r"Irm[ãa]s Hospitaleiras\s+[^|\n]{0,40}\|\s*([A-ZÁÉÍÓÚ][\wÀ-ú ]{2,30})", description)
        return (resolve_place(m.group(1).strip()) if m else None) or ("Lisboa", None)


class ApdpScraper(DetailPagesScraper):
    slug = "apdp"
    name = "APDP — Associação Protectora dos Diabéticos de Portugal"
    company = "APDP — Associação Protectora dos Diabéticos de Portugal"
    listing_url = "https://apdp.pt/apdp/recrutamento/"
    link_pattern = re.compile(r"apdp\.pt/apdp/recrutamento/[^/]+/?$")
    default_place = ("Lisboa", "Lisboa")

    def title_of(self, soup: BeautifulSoup) -> str:
        base = super().title_of(soup)  # og:title genérico ("Médico/a")
        text = re.sub(r"\s+", " ", soup.get_text(" "))
        m = re.search(re.escape(base) + r"[^.]{0,100}?(?=\s+Voltar)", text)
        return m.group(0).strip() if m else base

    def place_of(self, title: str, description: str) -> tuple[str, str | None] | None:
        return self.default_place
