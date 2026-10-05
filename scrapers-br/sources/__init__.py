from sources.agsus import AgsusScraper
from sources.einstein import EinsteinScraper
from sources.fleury import FleuryScraper
from sources.gupy import (
    AacdScraper,
    BpScraper,
    DasaScraper,
    DavitaScraper,
    FidiScraper,
    HaocScraper,
    HapvidaScraper,
    IrsslScraper,
    MoinhosScraper,
    RedeAmericasScraper,
    RedeDorScraper,
    SabinScraper,
    SantaCasaBaScraper,
    SantaCasaBhScraper,
    SantaCasaPoaScraper,
    SeconciSpScraper,
    SpdmScraper,
)
from sources.hcor import HcorScraper
from sources.hsl_sirio import HslSirioScraper
from sources.inca import IncaScraper
from sources.mater_dei import MaterDeiScraper
from sources.pci_concursos import PciConcursosScraper

SCRAPERS = {
    RedeDorScraper.slug: RedeDorScraper,
    HapvidaScraper.slug: HapvidaScraper,
    IrsslScraper.slug: IrsslScraper,
    SantaCasaBhScraper.slug: SantaCasaBhScraper,
    SantaCasaPoaScraper.slug: SantaCasaPoaScraper,
    SantaCasaBaScraper.slug: SantaCasaBaScraper,
    AacdScraper.slug: AacdScraper,
    RedeAmericasScraper.slug: RedeAmericasScraper,
    MoinhosScraper.slug: MoinhosScraper,
    BpScraper.slug: BpScraper,
    EinsteinScraper.slug: EinsteinScraper,
    FleuryScraper.slug: FleuryScraper,
    HaocScraper.slug: HaocScraper,
    HcorScraper.slug: HcorScraper,
    MaterDeiScraper.slug: MaterDeiScraper,
    HslSirioScraper.slug: HslSirioScraper,
    PciConcursosScraper.slug: PciConcursosScraper,
    AgsusScraper.slug: AgsusScraper,
    IncaScraper.slug: IncaScraper,
    SpdmScraper.slug: SpdmScraper,
    DavitaScraper.slug: DavitaScraper,
    SeconciSpScraper.slug: SeconciSpScraper,
    DasaScraper.slug: DasaScraper,
    SabinScraper.slug: SabinScraper,
    FidiScraper.slug: FidiScraper,
}
