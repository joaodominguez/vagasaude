"""DOG (Galicia) — Sumario diario en RSS: convocatorias del Servicio Gallego de Salud (Sergas).

https://www.xunta.gal/diario-oficial-galicia/rss/Sumario_es.rss (feed público del DOG; robots.txt solo bloquea
los PDF directos, no se descargan). Es el sumario del día: ejecutar a diario. Sustituye a las listas de
Sergas (solo PDF). Reutilización: aviso legal de la Xunta (citar fuente).
"""
from __future__ import annotations

import re

from ._pub_common import Entry
from ._pub_gazette import GazetteScraper, clean_text, parse_pubdate, rss_items


def parse_feed(raw: bytes, url: str = "") -> list[Entry]:
    entries = []
    for item in rss_items(raw):
        published = parse_pubdate(item["pubDate"])
        link = item["link"] or item["guid"]
        ident = re.search(r"/(Anuncio[^/_]+)(?:_[a-z]{2})?\.html?$", link)
        if not published or not ident:
            continue
        desc = [clean_text(x) for x in re.split(r"<\s*/\s*br\s*/?\s*>|<br\s*/?>", item["description"], flags=re.I)]
        entries.append(
            Entry(
                ident=f"dog-{published:%Y%m%d}-{ident.group(1)}",
                title=item["title"],
                url=link,
                published=published,
                section=desc[0] if desc else "",
                department=desc[-1] if len(desc) > 1 else "",
            )
        )
    return entries


class DogScraper(GazetteScraper):
    slug = "dog"
    name = "DOG Galicia — Convocatorias del Sergas"
    gazette = "DOG"
    region = "Galicia"
    feeds = ("https://www.xunta.gal/diario-oficial-galicia/rss/Sumario_es.rss",)

    def parse(self, raw: bytes, url: str) -> list[Entry]:
        return parse_feed(raw, url)
