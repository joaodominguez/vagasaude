from sources.bep import BepScraper
from sources.cuf import CufScraper
from sources.cvwarehouse import LuzSaudeScraper, LusiadasScraper
from sources.joaquim_chaves import JoaquimChavesScraper
from sources.trofa import TrofaSaudeScraper

SCRAPERS = {
    BepScraper.slug: BepScraper,
    CufScraper.slug: CufScraper,
    LuzSaudeScraper.slug: LuzSaudeScraper,
    LusiadasScraper.slug: LusiadasScraper,
    TrofaSaudeScraper.slug: TrofaSaudeScraper,
    JoaquimChavesScraper.slug: JoaquimChavesScraper,
}
