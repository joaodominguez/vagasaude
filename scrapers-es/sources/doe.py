"""DOE (Extremadura) — RSS sección II «Autoridades y personal»: convocatorias del Servicio Extremeño de Salud.

https://doe.juntaex.es/rss/rss.php?seccion=2 (feed oficial enlazado desde la portada del DOE; robots.txt solo
bloquea PDF concretos antiguos). Codificación ISO-8859-1. Es el diario del día: ejecutar a diario.
"""
from __future__ import annotations

import re

from ._pub_common import Entry
from ._pub_gazette import GazetteScraper, clean_text, parse_pubdate, rss_items


def parse_feed(raw: bytes, url: str = "") -> list[Entry]:
    entries = []
    for item in rss_items(raw):
        link = item["link"]
        ident = re.search(r"/([^/]+)\.pdf$", link, re.I)
        published = parse_pubdate(item["pubDate"])
        if not ident or not published:
            continue
        desc = clean_text(item["description"])
        department = desc.split(".", 1)[0] if desc else ""  # "SERVICIO EXTREMEÑO DE SALUD. Nombramientos.- ..."
        entries.append(
            Entry(
                ident=f"doe-{ident.group(1)}",
                title=item["title"],
                url=link.replace("http://", "https://", 1),
                published=published,
                section=item["categories"][0] if item["categories"] else "",
                department=department,
            )
        )
    return entries


class DoeScraper(GazetteScraper):
    slug = "doe"
    name = "DOE Extremadura — Convocatorias del SES"
    gazette = "DOE"
    region = "Extremadura"
    feeds = ("https://doe.juntaex.es/rss/rss.php?seccion=2",)

    def parse(self, raw: bytes, url: str) -> list[Entry]:
        return parse_feed(raw, url)
