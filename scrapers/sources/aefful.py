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
    slugify,
)

BASE = "https://www.aefful.pt"
LIST_URL = f"{BASE}/farmacia/"

# Bolsa de emprego comunitário da AEFFUL. Ingerimos todos os anúncios ainda
# visíveis (não só os marcados NOVO): o soft-expire da ingestão só funciona
# se a página retirar ofertas caducadas.
FOREIGN_PLACES = {
    "noruega",
    "espanha",
    "franca",
    "alemanha",
    "suica",
    "reino unido",
    "holanda",
    "belgica",
    "italia",
    "irlanda",
}

HEADING_SPLIT_RE = re.compile(r"\s+(?:I|\|)\s+")
ROLE_RE = re.compile(
    r"(?:recrutar(?:\s+\d+)?|vaga de emprego para)\s+"
    r"(?:um |uma |uns |umas )?"
    r"(?P<role>.+?)"
    r"(?:\s*[.]|\s*,?\s+para\b)",
    re.I | re.S,
)
EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)


class AeffulScraper(BaseScraper):
    slug = "aefful"
    name = "AEFFUL — Farmácia comunitária"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.35)
        try:
            html = client.get_text(LIST_URL)
            return self._parse(html)
        finally:
            client.close()

    def _parse(self, html: str) -> list[JobPayload]:
        soup = BeautifulSoup(html, "lxml")
        sections = soup.select(".elementor-top-section")
        jobs: list[JobPayload] = []
        seen_ids: set[str] = set()

        for index, section in enumerate(sections):
            heading_el = section.select_one("h2.elementor-heading-title")
            if heading_el is None:
                continue
            heading = re.sub(r"\s+", " ", heading_el.get_text(" ", strip=True)).strip()
            if not heading or not HEADING_SPLIT_RE.search(heading):
                continue

            body_html, body_text = _next_body(sections, index)
            if len(body_text) < 80:
                continue

            company, place = _split_heading(heading)
            if not company:
                continue
            if _is_foreign(place, body_text):
                continue

            role = _extract_role(body_text)
            title = role or "Farmacêutico"
            district = guess_district(place, body_text[:280])
            concelho = _concelho(place, district)
            source_id = _unique_id(heading, company, seen_ids)
            apply_url = _application_url(body_html, body_text, source_id)
            profession = guess_profession(f"{title} {company} {body_text[:280]}")

            jobs.append(
                JobPayload(
                    title=title,
                    company=company,
                    location_district=district,
                    location_concelho=concelho,
                    profession=profession,
                    specialty=None,
                    sector="privado",
                    contract_type=guess_contract(body_text),
                    description=body_text[:8000],
                    requirements=None,
                    salary=None,
                    application_url=apply_url,
                    source=self.slug,
                    source_id=source_id,
                    published_at=None,
                )
            )
        return jobs


def _next_body(sections: list, index: int) -> tuple[str, str]:
    if index + 1 >= len(sections):
        return "", ""
    nxt = sections[index + 1]
    if nxt.select_one("h2.elementor-heading-title"):
        return "", ""
    editors = nxt.select(".elementor-widget-text-editor")
    if not editors:
        return "", ""
    html = "".join(str(block) for block in editors)
    text = html_to_text(html)
    text = re.sub(r"\bf armac[eê]utico", "farmacêutico", text, flags=re.I)
    return html, text


def _split_heading(heading: str) -> tuple[str, str]:
    parts = HEADING_SPLIT_RE.split(heading, maxsplit=1)
    if len(parts) == 2:
        return parts[0].strip(" -–|"), parts[1].strip(" -–|")
    return heading.strip(), ""


def _is_foreign(place: str, body: str) -> bool:
    key = norm(place)
    if key in FOREIGN_PLACES:
        return True
    last = norm(place.split(",")[-1])
    if last in FOREIGN_PLACES:
        return True
    blob = norm(body[:280])
    return bool(
        re.search(
            r"\blocalizad[ao]s?\s+na\s+"
            r"(noruega|espanha|franca|alemanha|suica|holanda|belgica|italia|irlanda)\b",
            blob,
        )
    )


def _extract_role(text: str) -> str | None:
    match = ROLE_RE.search(text)
    if not match:
        return None
    role = re.sub(r"\s+", " ", match.group("role")).strip(" ,;:-")
    role = re.split(
        r"\s*,\s*(?:com |de prefer|para |na zona|a acabar)",
        role,
        maxsplit=1,
        flags=re.I,
    )[0].strip(" ,;:-")
    role = re.sub(r"^(?:um|uma|uns|umas)\s+", "", role, flags=re.I)
    role = re.sub(r"\be um\b", "e", role, flags=re.I)
    role = re.sub(r"\s+\(\s*m\s*/\s*f\s*\)", " (M/F)", role, flags=re.I)
    if len(role) < 8:
        return None
    if len(role) > 72:
        clipped = re.match(r"(?is).{8,72}?\(\s*M\s*/\s*F\s*\)", role)
        if not clipped:
            return None
        role = re.sub(r"\s+", " ", clipped.group(0)).strip()
    return role[0].upper() + role[1:]


def _concelho(place: str, district: str) -> str:
    cleaned = place.strip()
    cleaned = re.sub(r"^concelhos?\s+de\s+", "", cleaned, flags=re.I)
    cleaned = re.split(r"\s+[-–]\s+", cleaned, maxsplit=1)[0]
    cleaned = re.split(r"\s*,\s*", cleaned, maxsplit=1)[0]
    paren = re.search(r"\(([^)]+)\)", cleaned)
    if paren:
        inner = paren.group(1).strip()
        outer = re.sub(r"\s*\([^)]+\)", "", cleaned).strip()
        # "Ribamar (Mafra)" → concelho Mafra; "Faro (Albufeira)" similar.
        hinted = guess_district(inner)
        if hinted != "Portugal":
            return inner
        return outer or inner
    return cleaned or district


def _unique_id(heading: str, company: str, seen: set[str]) -> str:
    base = slugify(heading) or slugify(company) or "oferta"
    source_id = base
    n = 2
    while source_id in seen:
        source_id = f"{base}-{n}"
        n += 1
    seen.add(source_id)
    return source_id


def _application_url(body_html: str, body_text: str, source_id: str) -> str:
    hrefs = re.findall(r'href="([^"]+)"', body_html, flags=re.I)
    mailtos = [href.strip() for href in hrefs if href.lower().startswith("mailto:")]
    if mailtos:
        return mailtos[0]
    emails = EMAIL_RE.findall(body_text)
    if emails:
        return f"mailto:{emails[0]}"
    for href in hrefs:
        url = urljoin(LIST_URL, href.strip())
        if _is_apply_http(url):
            return url
    return f"{LIST_URL}#{source_id}"


def _is_apply_http(url: str) -> bool:
    lower = url.lower()
    if not lower.startswith("http"):
        return False
    if any(host in lower for host in ("alertaemprego.pt", "forms.gle", "docs.google.com")):
        return True
    if "net-empregos.com" in lower and re.search(r"/\d{4,}", lower):
        return True
    return False
