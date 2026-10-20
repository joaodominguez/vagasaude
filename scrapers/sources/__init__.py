from sources.elo_farma import EloFarmaScraper
from sources.factorial_farmacias import FarmaciasCuidoScraper, QuatroFarmaScraper
from sources.farmacias_silveira import FarmaciasSilveiraScraper
from sources.reis_barata import ReisBarataScraper
from sources.affidea import AffideaScraper
from sources.anicura import AnicuraScraper
from sources.domusvi import DomusviScraper
from sources.ess_porto import EssPortoScraper
from sources.fresenius import FreseniusScraper
from sources.ivc_evidensia import IvcEvidensiaScraper
from sources.omv import OmvScraper
from sources.ordem_enfermeiros import OrdemEnfermeirosScraper
from sources.sesaram import SesaramScraper
from sources.sword_health import SwordHealthScraper
from sources.synlab import SynlabScraper
from sources.unilabs import UnilabsScraper
from sources.unisana import UnisanaScraper
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
    # Fontes adicionadas em 2026-10 (empregadores, ordens e escolas).
    IvcEvidensiaScraper.slug: IvcEvidensiaScraper,
    AnicuraScraper.slug: AnicuraScraper,
    AffideaScraper.slug: AffideaScraper,
    SwordHealthScraper.slug: SwordHealthScraper,
    UnilabsScraper.slug: UnilabsScraper,
    FreseniusScraper.slug: FreseniusScraper,
    DomusviScraper.slug: DomusviScraper,
    SynlabScraper.slug: SynlabScraper,
    UnisanaScraper.slug: UnisanaScraper,
    OmvScraper.slug: OmvScraper,
    EssPortoScraper.slug: EssPortoScraper,
    SesaramScraper.slug: SesaramScraper,
    OrdemEnfermeirosScraper.slug: OrdemEnfermeirosScraper,
    # Farmácias (só farmacêutico e técnico de farmácia).
    FarmaciasCuidoScraper.slug: FarmaciasCuidoScraper,
    QuatroFarmaScraper.slug: QuatroFarmaScraper,
    EloFarmaScraper.slug: EloFarmaScraper,
    ReisBarataScraper.slug: ReisBarataScraper,
    FarmaciasSilveiraScraper.slug: FarmaciasSilveiraScraper,
}
