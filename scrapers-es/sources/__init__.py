"""Registro de scrapers de VacantesSalud (España).

Orden de implementación recomendado en docs/es/fuentes-empleo-sanidad-es.md.
Para añadir una fuente:
  1. copiar sources/_template.py, implementar `fetch()`;
  2. importarla aquí y registrarla en SCRAPERS (clave = `slug`);
  3. añadir la entrada correspondiente en apps/web-es/src/lib/sources.ts.
"""
from sources.amavir import AmavirScraper
from sources.affidea import AffideaScraper
from sources.clece import CleceScraper
from sources.clinicabaviera import ClinicaBavieraScraper
from sources.domusvi import DomusviScraper
from sources.hla import HlaScraper
from sources.matia import MatiaScraper
from sources.vithas import VithasScraper
from sources.boc_canarias import BocCanariasScraper
from sources.bocm import BocmScraper
from sources.bocyl import BocylScraper
from sources.boib import BoibScraper
from sources.boja import BojaScraper
from sources.borm import BormScraper
from sources.docm import DocmScraper
from sources.doe import DoeScraper
from sources.dog import DogScraper
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
    AffideaScraper.slug: AffideaScraper,
    CleceScraper.slug: CleceScraper,
    ClinicaBavieraScraper.slug: ClinicaBavieraScraper,
    DomusviScraper.slug: DomusviScraper,
    HlaScraper.slug: HlaScraper,
    MatiaScraper.slug: MatiaScraper,
    VithasScraper.slug: VithasScraper,
    BocCanariasScraper.slug: BocCanariasScraper,
    BocmScraper.slug: BocmScraper,
    BocylScraper.slug: BocylScraper,
    BoibScraper.slug: BoibScraper,
    BojaScraper.slug: BojaScraper,
    BormScraper.slug: BormScraper,
    DocmScraper.slug: DocmScraper,
    DoeScraper.slug: DoeScraper,
    DogScraper.slug: DogScraper,
}
