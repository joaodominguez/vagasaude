"""BOC (Canarias) — RSS «II. Autoridades y personal · Oposiciones y concursos»: convocatorias del SCS.

https://www.gobiernodecanarias.org/boc/feeds/capitulo/autoridades_personal_oposiciones.rss (feed oficial; el
robots.txt solo bloquea PDF y números antiguos). El feed conserva ~1 mes de entradas.
"""
from __future__ import annotations

import re

from ._pub_common import Entry
from ._pub_gazette import GazetteScraper, clean_text, parse_pubdate, rss_items


def parse_feed(raw: bytes, url: str = "") -> list[Entry]:
    entries = []
    for item in rss_items(raw):
        link = item["link"]
        published = parse_pubdate(item["pubDate"])
        ident = re.search(r"/boc/(\d{4})/(\d+)/(\d+)\.html", link)
        if not ident or not published:
            continue
        title = item["title"]
        department = ""
        if ".- " in title:
            department, title = title.split(".- ", 1)
        desc = clean_text(item["description"])
        if not department:
            m = re.search(r"Oposiciones y concursos - ([^<]+?)(?:\s+\d+\s|$)", desc)
            department = m.group(1) if m else ""
        entries.append(
            Entry(
                ident="boc-{}-{}-{}".format(*ident.groups()),
                title=title.strip(),
                url=link,
                published=published,
                section="II. Autoridades y personal - Oposiciones y concursos",
                department=department.strip(),
            )
        )
    return entries


class BocCanariasScraper(GazetteScraper):
    slug = "boc-canarias"
    name = "BOC Canarias — Convocatorias del SCS"
    gazette = "BOC"
    region = "Canarias"
    feeds = ("https://www.gobiernodecanarias.org/boc/feeds/capitulo/autoridades_personal_oposiciones.rss",)

    def parse(self, raw: bytes, url: str) -> list[Entry]:
        return parse_feed(raw, url)
