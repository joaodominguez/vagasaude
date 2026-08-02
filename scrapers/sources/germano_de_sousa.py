from __future__ import annotations

import re
from urllib.parse import urljoin

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

BASE = "https://www.germanodesousa.com"
LIST_URL = f"{BASE}/contactos/ofertas-de-emprego/"


class GermanoDeSousaScraper(BaseScraper):
    slug = "germano_de_sousa"
    name = "Germano de Sousa"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.35)
        try:
            items = self._list_offers(client)
            jobs: list[JobPayload] = []
            for item in items:
                job = self._to_job(client, item)
                if job:
                    jobs.append(job)
            return jobs
        finally:
            client.close()

    def _list_offers(self, client: HttpClient) -> list[dict]:
        html = client.get_text(LIST_URL)
        soup = BeautifulSoup(html, "lxml")
        items: list[dict] = []
        seen: set[str] = set()
        for article in soup.select("#vagas article.portfolio-item, #vagas .portfolio-item"):
            link = article.select_one("a[href]")
            title_el = article.select_one("h4")
            if not link or not title_el:
                continue
            href = (link.get("href") or "").strip()
            title = title_el.get_text(" ", strip=True)
            if not href or not title:
                continue
            url = urljoin(BASE, href)
            if url.rstrip("/") == LIST_URL.rstrip("/") or url in seen:
                continue
            seen.add(url)
            zona = _label_value(article, "Zona") or _label_value(article, "Local")
            funcao = _label_value(article, "Função")
            brief = ""
            for p in article.select("p"):
                text = p.get_text(" ", strip=True)
                if text.lower().startswith("descrição"):
                    continue
                if len(text) > 40:
                    brief = text
                    break
            items.append(
                {
                    "title": title,
                    "url": url,
                    "zona": zona,
                    "funcao": funcao,
                    "brief": brief,
                }
            )
        return items

    def _to_job(self, client: HttpClient, item: dict) -> JobPayload | None:
        url = item["url"]
        title = item["title"]
        html = client.get_text(url)
        soup = BeautifulSoup(html, "lxml")

        zona = (
            _label_value(soup, "Local")
            or _label_value(soup, "Zona")
            or item.get("zona")
            or ""
        )
        funcao = _label_value(soup, "Função") or item.get("funcao") or ""
        description = _extract_description(soup) or item.get("brief") or title
        district = _district_from_zona(zona)
        concelho = _concelho_from_zona(zona, district)
        source_id = _source_id_from_url(url)

        return JobPayload(
            title=title,
            company="Grupo Germano de Sousa",
            location_district=district,
            location_concelho=concelho,
            profession=guess_profession(title, funcao),
            specialty=funcao or None,
            sector="privado",
            contract_type=guess_contract(description[:500]),
            description=description[:8000],
            requirements=None,
            salary=None,
            application_url=url,
            source=self.slug,
            source_id=source_id,
            published_at=None,
        )


def _label_value(root, label: str) -> str | None:
    label_l = label.lower()
    for el in root.select("h5, p, li, strong, span, div"):
        text = el.get_text(" ", strip=True)
        if not text:
            continue
        match = re.match(
            rf"^{re.escape(label)}\s*:\s*(.+)$",
            text,
            re.I,
        )
        if match:
            return re.sub(r"\s+", " ", match.group(1)).strip()
        # <strong>Zona:</strong> value as sibling / parent
        strong = el.find("strong") if hasattr(el, "find") else None
        if strong and strong.get_text(strip=True).lower().startswith(label_l):
            full = el.get_text(" ", strip=True)
            parts = re.split(r":\s*", full, maxsplit=1)
            if len(parts) == 2 and parts[1].strip():
                return re.sub(r"\s+", " ", parts[1]).strip()
    return None


def _extract_description(soup: BeautifulSoup) -> str:
    # Coluna esquerda da ficha costuma trazer descrição + perfil.
    for block in soup.select("#content .col-md-6, #content .col_half"):
        text = block.get_text(" ", strip=True)
        if "Descrição da vaga" not in text and "Perfil" not in text:
            continue
        if "Junte-se a nós" in text and "Descrição da vaga" not in text:
            continue
        cleaned = html_to_text(str(block))
        # Remover cabeçalho duplicado (título/função/local) se existir corpo.
        cleaned = re.sub(
            r"(?is)^.*?(Descrição da vaga:\s*)",
            r"\1",
            cleaned,
            count=1,
        )
        cleaned = re.sub(
            r"(?is)\n*Se não se enquadrar.*$",
            "",
            cleaned,
        ).strip()
        cleaned = re.sub(
            r"(?is)\n*Caso queira fazer parte.*$",
            "",
            cleaned,
        ).strip()
        if len(cleaned) > 80:
            return cleaned

    content = soup.select_one("#content")
    if content:
        cleaned = html_to_text(str(content))
        if len(cleaned) > 80:
            return cleaned[:8000]
    return ""


def _district_from_zona(zona: str) -> str:
    key = norm(zona)
    if not key:
        return "Portugal"
    # Zonas comerciais do GDS (podem cruzar vários distritos).
    if "acores" in key or "açores" in key:
        return "Açores"
    if "madeira" in key:
        return "Madeira"
    if "grande lisboa" in key or "lisboa" in key:
        return "Lisboa"
    if "margem sul" in key or "setubal" in key:
        return "Setúbal"
    if "porto" in key or "zona norte" in key or "grande porto" in key:
        return "Porto"
    if "algarve" in key:
        return "Faro"
    if "alentejo" in key:
        return "Évora"
    if "zona centro" in key or "coimbra" in key:
        return "Coimbra"
    return guess_district(zona)


def _concelho_from_zona(zona: str, district: str) -> str:
    if not zona:
        return district
    # Mantém a zona comercial legível na UI.
    return zona.strip()


def _source_id_from_url(url: str) -> str:
    path = url.rstrip("/").split("/")[-1]
    path = re.sub(r"[^a-zA-Z0-9\-]+", "-", path).strip("-").lower()
    return path or url
