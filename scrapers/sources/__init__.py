from sources.aefful import AeffulScraper
from sources.bep import BepScraper
from sources.champalimaud import ChampalimaudScraper
from sources.cuf import CufScraper
from sources.cvwarehouse import HolonScraper, LuzSaudeScraper, LusiadasScraper
from sources.dre import DreScraper
from sources.germano_de_sousa import GermanoDeSousaScraper
from sources.hpa import HpaScraper
from sources.iefp import IefpScraper
from sources.inem import InemScraper
from sources.ipo_porto import IpoPortoScraper
from sources.ipst import IpstScraper
from sources.joaquim_chaves import JoaquimChavesScraper
from sources.net_empregos import NetEmpregosScraper
from sources.pharmabsc import PharmabscScraper
from sources.sapo_emprego import SapoEmpregoScraper
from sources.scm_esposende import ScmEsposendeScraper
from sources.scm_faro import ScmFaroScraper
from sources.scml import ScmlScraper
from sources.scmp import ScmpScraper
from sources.trofa import TrofaSaudeScraper
from sources.uls_sao_joao import UlsSaoJoaoScraper
from sources.uls_sns import UlsCoimbraScraper, UlsSaoJoseScraper

SCRAPERS = {
    BepScraper.slug: BepScraper,
    DreScraper.slug: DreScraper,
    IefpScraper.slug: IefpScraper,
    IpoPortoScraper.slug: IpoPortoScraper,
    ScmlScraper.slug: ScmlScraper,
    ScmEsposendeScraper.slug: ScmEsposendeScraper,
    ScmpScraper.slug: ScmpScraper,
    ScmFaroScraper.slug: ScmFaroScraper,
    CufScraper.slug: CufScraper,
    LuzSaudeScraper.slug: LuzSaudeScraper,
    LusiadasScraper.slug: LusiadasScraper,
    TrofaSaudeScraper.slug: TrofaSaudeScraper,
    JoaquimChavesScraper.slug: JoaquimChavesScraper,
    ChampalimaudScraper.slug: ChampalimaudScraper,
    GermanoDeSousaScraper.slug: GermanoDeSousaScraper,
    HpaScraper.slug: HpaScraper,
    HolonScraper.slug: HolonScraper,
    AeffulScraper.slug: AeffulScraper,
    PharmabscScraper.slug: PharmabscScraper,
    NetEmpregosScraper.slug: NetEmpregosScraper,
    SapoEmpregoScraper.slug: SapoEmpregoScraper,
    IpstScraper.slug: IpstScraper,
    InemScraper.slug: InemScraper,
    UlsSaoJoseScraper.slug: UlsSaoJoseScraper,
    UlsCoimbraScraper.slug: UlsCoimbraScraper,
    UlsSaoJoaoScraper.slug: UlsSaoJoaoScraper,
}
