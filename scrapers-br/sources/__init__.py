from sources.einstein import EinsteinScraper
from sources.gupy import (
    BpScraper,
    HapvidaScraper,
    IrsslScraper,
    MoinhosScraper,
    RedeAmericasScraper,
    RedeDorScraper,
    SantaCasaBhScraper,
)

SCRAPERS = {
    RedeDorScraper.slug: RedeDorScraper,
    HapvidaScraper.slug: HapvidaScraper,
    IrsslScraper.slug: IrsslScraper,
    SantaCasaBhScraper.slug: SantaCasaBhScraper,
    RedeAmericasScraper.slug: RedeAmericasScraper,
    MoinhosScraper.slug: MoinhosScraper,
    BpScraper.slug: BpScraper,
    EinsteinScraper.slug: EinsteinScraper,
}
