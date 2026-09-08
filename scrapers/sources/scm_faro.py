from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_profession, html_to_text

FEED = "https://misericordiafaro.pt/category/ofertas-de-emprego/feed/"
BASE = "https://misericordiafaro.pt"

SLUG_HINTS = {
    "aj-lar": "Ajudante de Lar",
    "ajudante-lar": "Ajudante de Lar",
    "enfermeiro": "Enfermeiro/a",
    "auxiliar": "Auxiliar de Ação Médica",
    "fisioterapeuta": "Fisioterapeuta",
}


class ScmFaroScraper(BaseScraper):
    slug = "scm_faro"
    name = "Misericórdia de Faro"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(timeout=40.0, min_interval=0.35)
        try:
            xml = client.get_text(FEED)
        finally:
            client.close()

        root = ET.fromstring(xml)
        jobs: list[JobPayload] = []
        for item in root.findall("./channel/item"):
            link = (item.findtext("link") or "").strip()
            raw_title = (item.findtext("title") or "").strip() or "Oferta de Emprego"
            title = _title_from_item(raw_title, link)
            desc = html_to_text(item.findtext("description") or "") or (
                f"{title} na Santa Casa da Misericórdia de Faro. "
                "Consulta o anúncio e candidata-te no site da instituição."
            )
            published = None
            pub = item.findtext("pubDate")
            if pub:
                try:
                    published = parsedate_to_datetime(pub).isoformat()
                except (TypeError, ValueError, IndexError):
                    published = None
            source_id = link.rstrip("/").rsplit("/", 1)[-1] or raw_title
            jobs.append(
                JobPayload(
                    title=title,
                    company="Santa Casa da Misericórdia de Faro",
                    location_district="Faro",
                    location_concelho="Faro",
                    profession=guess_profession(title),
                    specialty=None,
                    sector="ipss",
                    contract_type=None,
                    description=desc[:4000],
                    requirements=None,
                    salary=None,
                    application_url=link or BASE,
                    source=self.slug,
                    source_id=source_id,
                    published_at=published,
                )
            )
        return jobs


def _title_from_item(raw_title: str, link: str) -> str:
    if raw_title.lower() not in {"oferta de emprego", "emprego", "oferta"}:
        return raw_title
    slug = link.rstrip("/").rsplit("/", 1)[-1].lower()
    for key, label in SLUG_HINTS.items():
        if key in slug:
            return f"{label} — Misericórdia de Faro"
    slug_clean = re.sub(r"^oferta-de-emprego-?", "", slug).replace("-", " ").strip()
    # Ignore numeric-only leftovers from generic slugs (...-2, ...-7).
    if slug_clean and not re.fullmatch(r"\d+", slug_clean):
        return f"{slug_clean.title()} — Misericórdia de Faro"
    return "Oferta de emprego — Misericórdia de Faro"
