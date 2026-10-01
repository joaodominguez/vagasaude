from sources.einstein import EinsteinScraper
from sources.gupy import (
    BpScraper,
    HaocScraper,
    HapvidaScraper,
    IrsslScraper,
    MoinhosScraper,
    RedeAmericasScraper,
    RedeDorScraper,
    SantaCasaBhScraper,
)
from sources.hcor import HcorScraper
from sources.hsl_sirio import HslSirioScraper
from sources.mater_dei import MaterDeiScraper

SCRAPERS = {
    RedeDorScraper.slug: RedeDorScraper,
    HapvidaScraper.slug: HapvidaScraper,
    IrsslScraper.slug: IrsslScraper,
    SantaCasaBhScraper.slug: SantaCasaBhScraper,
    RedeAmericasScraper.slug: RedeAmericasScraper,
    MoinhosScraper.slug: MoinhosScraper,
    BpScraper.slug: BpScraper,
    EinsteinScraper.slug: EinsteinScraper,
    HaocScraper.slug: HaocScraper,
    HcorScraper.slug: HcorScraper,
    MaterDeiScraper.slug: MaterDeiScraper,
    HslSirioScraper.slug: HslSirioScraper,
}
