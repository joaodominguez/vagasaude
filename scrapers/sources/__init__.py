from sources.bep import BepScraper
from sources.champalimaud import ChampalimaudScraper
from sources.cuf import CufScraper
from sources.cvwarehouse import LuzSaudeScraper, LusiadasScraper
from sources.dre import DreScraper
from sources.germano_de_sousa import GermanoDeSousaScraper
from sources.hpa import HpaScraper
from sources.iefp import IefpScraper
from sources.ipo_porto import IpoPortoScraper
from sources.joaquim_chaves import JoaquimChavesScraper
from sources.scm_esposende import ScmEsposendeScraper
from sources.scml import ScmlScraper
from sources.trofa import TrofaSaudeScraper

SCRAPERS = {
    BepScraper.slug: BepScraper,
    DreScraper.slug: DreScraper,
    IefpScraper.slug: IefpScraper,
    IpoPortoScraper.slug: IpoPortoScraper,
    ScmlScraper.slug: ScmlScraper,
    ScmEsposendeScraper.slug: ScmEsposendeScraper,
    CufScraper.slug: CufScraper,
    LuzSaudeScraper.slug: LuzSaudeScraper,
    LusiadasScraper.slug: LusiadasScraper,
    TrofaSaudeScraper.slug: TrofaSaudeScraper,
    JoaquimChavesScraper.slug: JoaquimChavesScraper,
    ChampalimaudScraper.slug: ChampalimaudScraper,
    GermanoDeSousaScraper.slug: GermanoDeSousaScraper,
    HpaScraper.slug: HpaScraper,
}
