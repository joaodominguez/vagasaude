from sources.cuf import CufScraper
from sources.cvwarehouse import LuzSaudeScraper, LusiadasScraper
from sources.trofa import TrofaSaudeScraper

SCRAPERS = {
    CufScraper.slug: CufScraper,
    LuzSaudeScraper.slug: LuzSaudeScraper,
    LusiadasScraper.slug: LusiadasScraper,
    TrofaSaudeScraper.slug: TrofaSaudeScraper,
}
