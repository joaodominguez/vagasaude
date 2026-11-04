"""DOCM (Castilla-La Mancha) — sumario diario HTML: convocatorias del SESCAM.

https://docm.jccm.es/portaldocm/sumario.do (sumario público del DOCM; robots.txt solo bloquea PDF concretos).
El sitio del SESCAM (sescam.jccm.es) publica bolsas por PDF y su portal anterior no responde; el DOCM trae
las convocatorias de procesos selectivos / concursos del Servicio de Salud. Solo se lee el sumario del día
(sin PDF): ejecutar a diario.
"""
from __future__ import annotations

import re
from datetime import date

from ._pub_common import Entry
from ._pub_gazette import GazetteScraper, clean_text

_ORG_RE = re.compile(r'<h4 class\s*=\s*"tituloOrganismo">(?P<org>.*?)</h4>', re.S)
_DISP_RE = re.compile(
    r'<div class\s*=\s*"disp_\d+">\s*<p class\s*=\s*"sumario">(?P<body>.*?)</p>.*?detalleDocumento\.do\?idDisposicion=(?P<disp>\d+)',
    re.S,
)
_NID_RE = re.compile(r"\[NID (\d{4})/(\d+)\]")
_RUTA_RE = re.compile(r"ruta=(\d{4})/(\d{2})/(\d{2})/")
_SECTION_PREFIX_RE = re.compile(r"^(?P<sec>[^.]{3,60})\.\s+(?=Resoluci|Orden|Decreto|Acuerdo|Anuncio)")
BASE = "https://docm.jccm.es/portaldocm/"


def parse_sumario(page: str) -> list[Entry]:
    # Posición de cada organismo para asociarlo a las disposiciones que le siguen.
    orgs = [(m.start(), clean_text(m.group("org"))) for m in _ORG_RE.finditer(page)]
    entries = []
    for m in _DISP_RE.finditer(page):
        raw = m.group("body")
        nid = _NID_RE.search(raw)
        ruta = _RUTA_RE.search(raw)
        if not nid or not ruta:
            continue
        text = _NID_RE.sub("", clean_text(raw)).strip()
        section = ""
        sec = _SECTION_PREFIX_RE.match(text)
        if sec:
            section = sec.group("sec")
            text = text[sec.end():]
        org = ""
        for pos, name in orgs:
            if pos < m.start():
                org = name
        entries.append(
            Entry(
                ident=f"docm-{nid.group(1)}-{nid.group(2)}",
                title=text,
                url=f"{BASE}detalleDocumento.do?idDisposicion={m.group('disp')}",
                published=date(int(ruta.group(1)), int(ruta.group(2)), int(ruta.group(3))),
                section=section,
                department=org,
            )
        )
    return entries


class DocmScraper(GazetteScraper):
    slug = "docm"
    name = "DOCM Castilla-La Mancha — Convocatorias del SESCAM"
    gazette = "DOCM"
    region = "Castilla-La Mancha"
    feeds = (BASE + "sumario.do",)

    def parse(self, raw: bytes, url: str) -> list[Entry]:
        return parse_sumario(raw.decode("utf-8", "replace"))
