from __future__ import annotations

import re
from urllib.parse import quote, urljoin

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_profession, html_to_text, norm
from common.title import shorten_job_title
from sources._pt_boards import iso_day, parse_pt_date, stable_id

BASE = "https://www.sesaram.pt"
PAGE = f"{BASE}/portal/o-sesaram/outras-informacoes-sesaram/oportunidades-emprego"
COMPANY = "SESARAM, EPERAM"


class SesaramScraper(BaseScraper):
    slug = "sesaram"
    name = "SESARAM — Oportunidades de emprego"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(timeout=40.0, min_interval=0.8)
        jobs: list[JobPayload] = []
        try:
            for item in parse_sesaram_list(client.get_text(PAGE)):
                detail: dict = {}
                try:
                    detail = parse_sesaram_detail(client.get_text(item["url"]), item["url"])
                except Exception:  # noqa: BLE001 — sem detalhe fica só título + data
                    detail = {}
                jobs.append(_to_payload(item, detail, self.slug))
        finally:
            client.close()
        return jobs


def parse_sesaram_list(html: str) -> list[dict]:
    """Só a secção "Abertas" (ignora "A decorrer" e "Concluídas")."""
    soup = BeautifulSoup(html, "lxml")
    heading = next(
        (h for h in soup.find_all("h2") if norm(h.get_text(" ", strip=True)) == "abertas"),
        None,
    )
    if not heading:
        return []
    items: list[dict] = []
    for el in heading.find_all_next():
        if el.name == "h2":
            break  # próxima secção
        if el.name != "h5" or "el-title" not in (el.get("class") or []):
            continue
        a = el.find("a", href=True)
        title = re.sub(r"\s+", " ", el.get_text(" ", strip=True))
        if not title:
            continue
        item_box = el.find_parent(class_="el-item") or el.parent
        meta = item_box.select_one(".el-meta") if item_box else None
        date_txt = meta.get_text(" ", strip=True) if meta else ""
        url = urljoin(BASE, a["href"]) if a else PAGE
        items.append(
            {
                "title": title,
                "url": url,
                "published": parse_pt_date(date_txt),
                "date_text": date_txt,
            }
        )
    return items


def parse_sesaram_detail(html: str, url: str) -> dict:
    """Texto do aviso + anexos (Aviso Integral, formulário) da página de detalhe."""
    soup = BeautifulSoup(html, "lxml")
    main = soup.select_one("main") or soup
    for bad in main.select("script, style, nav"):
        bad.decompose()
    title_el = main.find("h2")
    # Corpo: o primeiro painel de texto depois do título.
    panel = main.select_one(".uk-panel") or main
    text = html_to_text(panel.decode_contents())
    attachments: list[tuple[str, str]] = []
    for a in main.select("a[href]"):
        href = a["href"]
        if not re.search(r"\.pdf($|\?)", href, re.I):
            continue
        if "Regulamento_Visitas" in href:
            continue
        label = a.get_text(" ", strip=True) or a.get("title") or "Documento"
        full = quote(urljoin(BASE, href), safe=":/?&=#%")
        if full not in {u for _, u in attachments}:
            attachments.append((label, full))
    return {
        "title": title_el.get_text(" ", strip=True) if title_el else "",
        "text": text,
        "attachments": attachments,
        "url": url,
    }


def _short_title(title: str) -> str:
    # "…para Técnico Superior …, profissão de Técnico de X" → "Técnico de X"
    m = re.search(r"profiss[ãa]o\s+de\s+(.{6,140})$", title, re.I)
    if m:
        return m.group(1).strip(" .;")
    return shorten_job_title(title) or title


def _notice_url(attachments: list[tuple[str, str]]) -> str | None:
    for label, url in attachments:
        if re.search(r"aviso", label, re.I) or re.search(r"aviso|Av_", url, re.I):
            return url
    return attachments[0][1] if attachments else None


def _to_payload(item: dict, detail: dict, slug: str) -> JobPayload:
    title_full = item["title"]
    title = _short_title(title_full)
    attachments = detail.get("attachments") or []
    notice = _notice_url(attachments)
    parts = [title_full]
    if item.get("published"):
        parts.append(f"Publicado a {item['published'].strftime('%d/%m/%Y')}")
    if detail.get("text"):
        parts.append(detail["text"])
    if attachments:
        parts.append(
            "Documentos:\n" + "\n".join(f"- {label}: {url}" for label, url in attachments)
        )
    parts.append(f"Página do procedimento: {item['url']}")
    description = "\n\n".join(parts)
    published = item.get("published")
    return JobPayload(
        title=title,
        company=COMPANY,
        location_district="Madeira",
        location_concelho="Funchal",
        profession=guess_profession(title, fallback=title_full),
        specialty=None,
        sector="publico",
        contract_type=guess_contract(detail.get("text", "")[:1200]) or "Contrato",
        description=description,
        requirements=None,
        salary=None,
        application_url=notice or item["url"],
        source=slug,
        source_id=stable_id(title_full, published.isoformat() if published else "", prefix="sesaram-"),
        published_at=iso_day(published),
    )
