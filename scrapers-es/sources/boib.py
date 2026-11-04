"""BOIB (Illes Balears) — Sección II «Autoridades y personal»: convocatorias del IB-Salut.

Feed RSS oficial https://www.caib.es/eboibfront/indexrss.do?lang=ca (lista de boletines recientes) y páginas de
sumario del propio BOIB (robots.txt del caib.es permite /eboibfront). Por boletín: 1 petición del índice y 1 de
la sección II. Se leen los últimos WINDOW boletines.
"""
from __future__ import annotations

import re
from datetime import date

from common.http import HttpClient
from common.models import BaseScraper, JobPayload

from ._pub_common import Entry, jobs_from_entries
from ._pub_gazette import clean_text, get_bytes, parse_pubdate, rss_items

BASE = "https://www.caib.es"
FEED = f"{BASE}/eboibfront/indexrss.do?lang=ca"
WINDOW = 10

_BULLETIN_RE = re.compile(r"/eboibfront/\w+/(\d{4})/(\d+)")
_SECTION_II_RE = re.compile(r'href="(/eboibfront/es/\d{4}/\d+/seccion-ii-autoridades-y-personal/\d+)"')
_ORG_RE = re.compile(r'<h3 class="organisme">(?P<org>.*?)</h3>(?P<rest>.*?)(?=<h3 class="organisme">|$)', re.S)
_RES_RE = re.compile(
    r'<li>\s*<p>(?P<title>.*?)</p>\s*<p class="registre">.*?'
    r'href="(?P<html>https://www\.caib\.es/eboibfront/es/(?P<year>\d{4})/(?P<bid>\d+)/(?P<doc>\d+)/[^"]*)"',
    re.S,
)


def bulletins(feed_xml: bytes) -> list[tuple[str, str, date]]:
    """[(año, id de boletín, fecha)] del feed, más recientes primero."""
    out = []
    for item in rss_items(feed_xml):
        m = _BULLETIN_RE.search(item["link"])
        day = parse_pubdate(item["pubDate"])
        if m and day:
            out.append((m.group(1), m.group(2), day))
    return out


def section_ii_link(index_html: str) -> str | None:
    m = _SECTION_II_RE.search(index_html)
    return m.group(1) if m else None


def parse_section(page: str, published: date) -> list[Entry]:
    entries = []
    for org in _ORG_RE.finditer(page):
        department = clean_text(org.group("org"))
        for m in _RES_RE.finditer(org.group("rest")):
            entries.append(
                Entry(
                    ident=f"boib-{m.group('year')}-{m.group('doc')}",
                    title=clean_text(m.group("title")),
                    url=m.group("html"),
                    published=published,
                    section="II. Autoridades y personal",
                    department=department,
                )
            )
    return entries


class BoibScraper(BaseScraper):
    slug = "boib"
    name = "BOIB Baleares — Convocatorias del IB-Salut"
    last_listings_complete = False

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        entries: list[Entry] = []
        try:
            refs = bulletins(get_bytes(client, FEED))[:WINDOW]
            if not refs:
                raise RuntimeError("boib: feed sin boletines")
            for year, bid, day in refs:
                try:
                    index = get_bytes(client, f"{BASE}/eboibfront/es/{year}/{bid}").decode("utf-8", "replace")
                    link = section_ii_link(index)
                    if not link:
                        continue
                    page = get_bytes(client, BASE + link).decode("utf-8", "replace")
                    entries.extend(parse_section(page, day))
                except Exception:  # noqa: BLE001
                    continue
        finally:
            client.close()
        self.last_listings_complete = False
        return jobs_from_entries(entries, slug=self.slug, gazette="BOIB", region="Islas Baleares")
