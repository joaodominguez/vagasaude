"""Registro de scrapers de VacantesSalud (España).

Orden de implementación recomendado en docs/es/fuentes-empleo-sanidad-es.md.
Para añadir una fuente:
  1. copiar sources/_template.py, implementar `fetch()`;
  2. importarla aquí y registrarla en SCRAPERS (clave = `slug`);
  3. añadir la entrada correspondiente en apps/web-es/src/lib/sources.ts.
"""
from sources.amavir import AmavirScraper
from sources.boe import BoeScraper
from sources.hospiten import HospitenScraper
from sources.osakidetza import OsakidetzaScraper
from sources.sanitas import SanitasScraper

SCRAPERS: dict = {
    AmavirScraper.slug: AmavirScraper,
    BoeScraper.slug: BoeScraper,
    HospitenScraper.slug: HospitenScraper,
    OsakidetzaScraper.slug: OsakidetzaScraper,
    SanitasScraper.slug: SanitasScraper,
}
