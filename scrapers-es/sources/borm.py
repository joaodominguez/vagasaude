"""BORM (Región de Murcia) — RSS del boletín del día: convocatorias del Servicio Murciano de Salud.

https://www.borm.es/rss/boletin.xml (feed oficial; robots.txt sin restricciones). Una entrada por anuncio con
categoría de sección y organismo. Es el boletín del día: ejecutar a diario.
"""
from __future__ import annotations

import re

from ._pub_common import Entry
from ._pub_gazette import GazetteScraper, clean_text, parse_pubdate, rss_items

_NUM_RE = re.compile(r"^\s*\d{1,6}\s+")
_PAGES_RE = re.compile(r"\s*\(\d+\s+p[aá]gina/s\s*-\s*[\d.,]+\s*\w+\)\s*$")


def parse_feed(raw: bytes, url: str = "") -> list[Entry]:
    entries = []
    for item in rss_items(raw):
        guid = item["guid"] or item["link"]
        ident = re.search(r"/anuncio/(\d+)/", guid)
        published = parse_pubdate(item["pubDate"])
        if not ident or not published:
            continue
        cats = item["categories"]
        title = _PAGES_RE.sub("", _NUM_RE.sub("", item["title"]))
        entries.append(
            Entry(
                ident=f"borm-{ident.group(1)}",
                title=title,
                url=guid,
                published=published,
                section=cats[0] if cats else "",
                department=clean_text(item["description"]) or (cats[1] if len(cats) > 1 else ""),
            )
        )
    return entries


class BormScraper(GazetteScraper):
    slug = "borm"
    name = "BORM Murcia — Convocatorias del SMS"
    gazette = "BORM"
    region = "Murcia"
    feeds = ("https://www.borm.es/rss/boletin.xml",)

    def parse(self, raw: bytes, url: str) -> list[Entry]:
        return parse_feed(raw, url)
