"""BOJA (Andalucía) — sumario 2.2 «Oposiciones, concursos y otras convocatorias»: convocatorias del SAS.

El portal del SAS (sspa.juntadeandalucia.es) responde 403 a nuestro bot (WAF) y se mantiene descartado; el BOJA
sí es público: feed Atom https://www.juntadeandalucia.es/boja/distribucion/boja.xml (último boletín) y las
páginas de sumario del propio boletín (robots.txt solo bloquea /boja/buscador/search.do?, /boja/app y números
históricos concretos). Se leen los últimos WINDOW boletines ordinarios (2 peticiones por boletín).
"""
from __future__ import annotations

import re
from datetime import date, datetime

from common.http import HttpClient
from common.models import BaseScraper, JobPayload

from ._pub_common import Entry, jobs_from_entries
from ._pub_gazette import clean_text, get_bytes

FEED = "https://www.juntadeandalucia.es/boja/distribucion/boja.xml"
BASE = "https://www.juntadeandalucia.es"
WINDOW = 14  # boletines ordinarios hacia atrás (~3 semanas)

_BULLETIN_RE = re.compile(r"Bolet[ií]n n[úu]mero (\d+) de (\d{1,2}) de (\w+) de (\d{4})")
_SECTION_LINK_RE = re.compile(r'<a href="(s\d+)">\s*Oposiciones, concursos y otras convocatorias\s*</a>')
_H1_DATE_RE = re.compile(r"Bolet[ií]n n[úu]mero (\d+) de\s+(\d{2})/(\d{2})/(\d{4})")
_BLOCK_RE = re.compile(
    r'<p class="h5[^"]*">(?P<dept>.*?)</p>|<div class="item[^"]*">\s*<p>(?P<title>.*?)</p>(?P<rest>.*?)(?=<div class="clear">)',
    re.S,
)
_HTML_LINK_RE = re.compile(r'href="(/boja/(\d{4})/(\d+)/(\d+))"\s+class="item_html"')


def latest_bulletin(feed_xml: str) -> tuple[int, int] | None:
    """(año, número) del último boletín ordinario del feed Atom."""
    best = None
    for m in _BULLETIN_RE.finditer(feed_xml):
        number, year = int(m.group(1)), int(m.group(4))
        if number < 1000 and (best is None or (year, number) > best):
            best = (year, number)
    return best


def section_link(bulletin_html: str) -> str | None:
    m = _SECTION_LINK_RE.search(bulletin_html)
    return m.group(1) if m else None


def parse_section(page: str) -> list[Entry]:
    h1 = _H1_DATE_RE.search(page)
    if not h1:
        return []
    published = date(int(h1.group(4)), int(h1.group(3)), int(h1.group(2)))
    entries = []
    department = ""
    for m in _BLOCK_RE.finditer(page):
        if m.group("dept") is not None:
            department = clean_text(m.group("dept"))
            continue
        link = _HTML_LINK_RE.search(m.group("rest") or "")
        if not link:
            continue
        entries.append(
            Entry(
                ident=f"boja-{link.group(2)}-{link.group(3)}-{link.group(4)}",
                title=clean_text(m.group("title")),
                url=BASE + link.group(1),
                published=published,
                section="2.2. Oposiciones, concursos y otras convocatorias",
                department=department,
            )
        )
    return entries


class BojaScraper(BaseScraper):
    slug = "boja"
    name = "BOJA Andalucía — Convocatorias del SAS"
    last_listings_complete = False

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        entries: list[Entry] = []
        try:
            latest = latest_bulletin(get_bytes(client, FEED).decode("utf-8", "replace"))
            if not latest:
                raise RuntimeError("boja: feed sin boletín ordinario")
            year, number = latest
            failures = 0
            for n in range(number, max(number - WINDOW, 0), -1):
                try:
                    page = get_bytes(client, f"{BASE}/boja/{year}/{n}/").decode("utf-8", "replace")
                    link = section_link(page)
                    if not link:
                        continue  # boletín sin sección de oposiciones
                    section = get_bytes(client, f"{BASE}/boja/{year}/{n}/{link}").decode("utf-8", "replace")
                    entries.extend(parse_section(section))
                except Exception:  # noqa: BLE001
                    failures += 1
        finally:
            client.close()
        self.last_listings_complete = False
        return jobs_from_entries(entries, slug=self.slug, gazette="BOJA", region="Andalucía")
