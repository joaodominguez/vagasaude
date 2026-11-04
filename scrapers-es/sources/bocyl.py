"""BOCYL (Castilla y León) — RSS «I. Comunidad de Castilla y León»: convocatorias de SACYL.

https://bocyl.jcyl.es/rss.do?seccion=I (feed oficial, enlazado desde /indiceRss.do). El feed trae el boletín
del día con todas las disposiciones dentro del <description>; se leen solo los títulos y se enlaza al PDF
oficial (no se descargan: robots.txt desautoriza /boletines/ y /html/). Ejecutar a diario.
"""
from __future__ import annotations

import re
from html import unescape

from ._pub_common import Entry
from ._pub_gazette import GazetteScraper, clean_text, parse_pubdate, rss_items

_LI_RE = re.compile(
    r"<a href=\"(?P<url>https://bocyl\.jcyl\.es/boletines/[^\"]+?BOCYL-D-(?P<id>\d{8}-\d+-\d+)\.pdf)\">(?P<head>.*?)</a></p>\s*"
    r"<p[^>]*>(?P<title>.*?)</p>",
    re.S,
)


def parse_feed(raw: bytes, url: str = "") -> list[Entry]:
    entries = []
    for item in rss_items(raw):
        published = parse_pubdate(item["pubDate"])
        if not published:
            continue
        body = unescape(item["description"])
        for m in _LI_RE.finditer(body):
            head = clean_text(m.group("head"))
            section, _, department = head.partition(" - ")
            entries.append(
                Entry(
                    ident=f"bocyl-{m.group('id')}",
                    title=clean_text(m.group("title")),
                    url=m.group("url"),
                    published=published,
                    section=section,
                    department=department,
                )
            )
    return entries


class BocylScraper(GazetteScraper):
    slug = "bocyl"
    name = "BOCYL — Convocatorias de SACYL"
    gazette = "BOCYL"
    region = "Castilla y León"
    feeds = ("https://bocyl.jcyl.es/rss.do?seccion=I",)

    def parse(self, raw: bytes, url: str) -> list[Entry]:
        return parse_feed(raw, url)
