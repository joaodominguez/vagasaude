"""BOCM (Comunidad de Madrid) — sumario «B) Autoridades y personal · Consejería de Sanidad»: SERMAS.

El portal de bolsas del SERMAS (sede.comunidad.madrid) devuelve 404 a nuestro bot; el BOCM sí es público:
RSS https://www.bocm.es/boletines.rss (últimos 20 boletines) y las páginas HTML de sumario del propio
boletín. robots.txt del BOCM pide Crawl-delay: 10 (se respeta) y bloquea /boletin/CM_Boletin_BOCM/ (PDF/XML,
no se tocan). Por boletín: 1 petición de sumario + 1 de la Consejería de Sanidad si aparece en el apartado B.
"""
from __future__ import annotations

import re
from datetime import date
from urllib.parse import quote

from common.http import HttpClient
from common.models import BaseScraper, JobPayload

from ._pub_common import Entry, jobs_from_entries
from ._pub_gazette import clean_text, get_bytes

BASE = "https://www.bocm.es"
FEED = f"{BASE}/boletines.rss"
WINDOW = 12  # boletines (~2,5 semanas); 2 peticiones c/u con Crawl-delay 10
CRAWL_DELAY = 10.0

_BULLETIN_LINK_RE = re.compile(r"<link>(https://www\.bocm\.es/boletin/bocm-(\d{8})-(\d+))</link>")
_SANIDAD_LINK_RE = re.compile(r'href="(/boletin-completo/[^"]*b%29-autoridades-y-personal/consejer%C3%ADa-de-sanidad)"')
_ARTICLE_RE = re.compile(
    r'<div class="field-content sub-organismo">(?P<dept>.*?)</div>\s*<article[^>]*about="/(?P<id>bocm-\d{8}-\d+)".*?'
    r'field-name-field-short-description.*?<div class="field-item even">(?P<desc>.*?)</div>',
    re.S,
)


def bulletin_refs(feed_xml: str) -> list[tuple[str, date, str]]:
    """[(url del sumario, fecha, número)] más recientes primero."""
    refs = []
    for m in _BULLETIN_LINK_RE.finditer(feed_xml):
        d = m.group(2)
        refs.append((m.group(1), date(int(d[:4]), int(d[4:6]), int(d[6:])), m.group(3)))
    return refs


def sanidad_link(summary_html: str) -> str | None:
    m = _SANIDAD_LINK_RE.search(summary_html)
    return m.group(1) if m else None


def parse_department_page(page: str, published: date) -> list[Entry]:
    entries = []
    for m in _ARTICLE_RE.finditer(page):
        desc = clean_text(re.sub(r"<br\s*/?>", " ", m.group("desc")))
        kind, _, body = desc.partition("– ")
        text = body.strip() if body else desc
        entries.append(
            Entry(
                ident=m.group("id"),
                title=text,
                url=f"{BASE}/{m.group('id')}",
                published=published,
                section="B) Autoridades y personal",
                department=clean_text(m.group("dept")),
            )
        )
    return entries


class BocmScraper(BaseScraper):
    slug = "bocm"
    name = "BOCM Madrid — Convocatorias del SERMAS"
    last_listings_complete = False

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=CRAWL_DELAY)
        entries: list[Entry] = []
        try:
            refs = bulletin_refs(get_bytes(client, FEED).decode("utf-8", "replace"))[:WINDOW]
            if not refs:
                raise RuntimeError("bocm: feed sin boletines")
            for url, day, _number in refs:
                try:
                    summary = get_bytes(client, url).decode("utf-8", "replace")
                    link = sanidad_link(summary)
                    if not link:
                        continue
                    page = get_bytes(client, BASE + quote(link, safe="/%:?=&")).decode("utf-8", "replace")
                    entries.extend(parse_department_page(page, day))
                except Exception:  # noqa: BLE001
                    continue
        finally:
            client.close()
        self.last_listings_complete = False
        return jobs_from_entries(entries, slug=self.slug, gazette="BOCM", region="Madrid")
