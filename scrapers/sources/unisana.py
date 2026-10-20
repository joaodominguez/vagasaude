from __future__ import annotations

import re

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

PAGE = "https://unisanahospitais.pt/recrutamento/"
GROUP = "Unisana Hospitais"

NON_HEALTH = {"Outros", "Administrativo", "Gestão & suporte"}
HEALTH_RE = re.compile(
    r"enfermeir|fisioterap|terapeuta|terapia da fala|t[eé]cnic[oa]\s+auxiliar\s+de\s+sa[uú]de|"
    r"m[eé]dic|psic[oó]log|nutricion|farmac|radiolog|ort[oó]ptic",
    re.I,
)
SKIP_RE = re.compile(r"higiene e seguran|manuten|limpeza|cozinh|contabil", re.I)

# Classe "rh-<zona>" de cada vaga -> (distrito, concelho).
ZONAS: dict[str, tuple[str, str]] = {
    "rh-oeste": ("Lisboa", "Torres Vedras"),
    "rh-lisboa": ("Lisboa", "Lisboa"),
    "rh-porto": ("Porto", "Porto"),
    "rh-santarem": ("Santarém", "Santarém"),
    "rh-almada": ("Setúbal", "Almada"),
}
HOSPITAIS = (
    ("hospital da ordem terceira", "Hospital da Ordem Terceira"),
    ("hospital do oeste", "Hospital do Oeste"),
    ("hospital da lapa", "Hospital da Lapa"),
    ("hospital de almada", "Hospital de Almada"),
)


class UnisanaScraper(BaseScraper):
    slug = "unisana"
    name = "Unisana Hospitais"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(timeout=40.0)
        try:
            html = client.get_text(PAGE)
        finally:
            client.close()
        return parse_unisana_jobs(html, source=self.slug)


def _is_health(title: str) -> bool:
    if SKIP_RE.search(title):
        return False
    return guess_profession(title) not in NON_HEALTH or bool(HEALTH_RE.search(title))


def _company(intro: str, zonas: list[str]) -> str:
    # Hospital específico só quando a vaga é de uma única unidade.
    if len(zonas) > 1:
        return GROUP
    key = norm(intro)
    found = [name for needle, name in HOSPITAIS if needle in key]
    if len(found) == 1:
        return found[0]
    return GROUP


def _clean_text(text: str) -> str:
    # Remove espaços deixados por <strong>/<a> inline ("Clinic , ...").
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+([,.;:])", r"\1", text)
    return re.sub(r"[ \t]{2,}", " ", text)


def _contract(title: str, description: str) -> str | None:
    # "prestação de cuidados" engana o guess_contract: só título + secção de oferta.
    offer = re.search(r"(?is)(oferecemos|condi[cç][oõ]es)\s*:?(.*?)(\n\n[^\n-]|$)", description)
    text = f"{title}\n{offer.group(2) if offer else ''}"
    if re.search(r"part[- ]?time|tempo parcial", description, re.I):
        text += "\npart-time"
    return guess_contract(text)


def _location(classes: list[str], title: str) -> tuple[str, str | None]:
    for cls in classes:
        if cls in ZONAS:
            return ZONAS[cls]
    place = re.split(r"\s[–-]\s", title, maxsplit=1)
    place_text = place[1] if len(place) == 2 else ""
    return guess_district(place_text), (place_text or None)


def parse_unisana_jobs(html: str, source: str = "unisana") -> list[JobPayload]:
    soup = BeautifulSoup(html, "lxml")
    jobs: list[JobPayload] = []
    seen: set[str] = set()
    for panel in soup.select("div.fusion-faq-post"):
        classes = panel.get("class") or []
        post_id = next(
            (c.rsplit("-", 1)[-1] for c in classes if re.fullmatch(r"fusion-faq-post-\d+", c)),
            None,
        )
        title_el = panel.select_one(".entry-title") or panel.select_one(".fusion-toggle-heading")
        title = re.sub(r"\s+", " ", title_el.get_text(" ", strip=True) if title_el else "").strip()
        if not post_id or not title or post_id in seen:
            continue
        seen.add(post_id)
        if not _is_health(title):
            continue

        body = panel.select_one(".panel-body")
        description = _clean_text(html_to_text(str(body))) if body else ""
        description = description or title
        updated = panel.select_one(".updated")
        published = updated.get_text(strip=True) if updated else None
        district, concelho = _location(classes, title)

        # Sem página individual (faq-items redireciona para /recrutamento/):
        # usa a âncora do acordeão.
        toggle = panel.select_one("a[data-target]")
        anchor = (toggle.get("data-target") if toggle else "") or f"#faq-{post_id}"

        intro = description.split("\n", 1)[0]
        jobs.append(
            JobPayload(
                title=title,
                company=_company(intro, [c for c in classes if c in ZONAS]),
                location_district=district,
                location_concelho=concelho,
                profession=guess_profession(title),
                specialty=None,
                sector="privado",
                contract_type=_contract(title, description),
                description=description,
                requirements=None,
                salary=None,
                application_url=f"{PAGE}{anchor}",
                source=source,
                source_id=post_id,
                published_at=published,
            )
        )
    return jobs
