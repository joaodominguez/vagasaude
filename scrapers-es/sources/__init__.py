"""Registro de scrapers de VacantesSalud (España).

Orden de implementación recomendado en docs/es/fuentes-empleo-sanidad-es.md.
Para añadir una fuente:
  1. copiar sources/_template.py, implementar `fetch()`;
  2. importarla aquí y registrarla en SCRAPERS (clave = `slug`);
  3. añadir la entrada correspondiente en apps/web-es/src/lib/sources.ts.
"""
from sources.amavir import AmavirScraper
from sources.anicura import AnicuraScraper
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
from sources.ivc_evidensia import IvcEvidensiaScraper
from sources.osakidetza import OsakidetzaScraper
from sources.sanitas import SanitasScraper
from sources.sne import SneScraper
from sources.csi import CsiScraper
from sources.cst import CstScraper
from sources.hospital_del_mar import HospitalDelMarScraper
from sources.salut_emporda import SalutEmpordaScraper
from sources.csdm import CsdmScraper
from sources.clinic_barcelona import ClinicBarcelonaScraper
from sources.althaia import AlthaiaScraper
from sources.csa import CsaScraper
from sources.multiopticas import MultiopticasScraper
from sources.gaes import GaesScraper
from sources.cigna import CignaScraper
from sources.mutua_navarra import MutuaNavarraScraper
from sources.corachan import CorachanScraper
from sources.colisee import ColiseeScraper
from sources.efisioterapia import EfisioterapiaScraper
from sources.talentsalud import TalentSaludScraper
from sources.endivo import EndivoScraper
from sources.winid import WinidScraper
from sources.fresenius import FreseniusEsScraper
from sources.ascires import AsciresScraper
from sources.ics import IcsScraper
from sources.sespa import SespaScraper
# Ballesol (sources/ballesol.py) fora do registo: empleo.ballesol.es responde com desafio Cloudflare
# (403 cf-mitigated) a IPs de servidor — não se contorna. O ficheiro fica (vitalia usa os helpers).
from sources.vitalia import VitaliaScraper

SCRAPERS: dict = {
    FreseniusEsScraper.slug: FreseniusEsScraper,
    AsciresScraper.slug: AsciresScraper,
    IcsScraper.slug: IcsScraper,
    SespaScraper.slug: SespaScraper,
    VitaliaScraper.slug: VitaliaScraper,
    AmavirScraper.slug: AmavirScraper,
    AnicuraScraper.slug: AnicuraScraper,
    BoeScraper.slug: BoeScraper,
    HospitenScraper.slug: HospitenScraper,
    IvcEvidensiaScraper.slug: IvcEvidensiaScraper,
    OsakidetzaScraper.slug: OsakidetzaScraper,
    SanitasScraper.slug: SanitasScraper,
    SneScraper.slug: SneScraper,
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
    CsiScraper.slug: CsiScraper,
    CstScraper.slug: CstScraper,
    HospitalDelMarScraper.slug: HospitalDelMarScraper,
    SalutEmpordaScraper.slug: SalutEmpordaScraper,
    CsdmScraper.slug: CsdmScraper,
    ClinicBarcelonaScraper.slug: ClinicBarcelonaScraper,
    AlthaiaScraper.slug: AlthaiaScraper,
    CsaScraper.slug: CsaScraper,
    MultiopticasScraper.slug: MultiopticasScraper,
    GaesScraper.slug: GaesScraper,
    CignaScraper.slug: CignaScraper,
    MutuaNavarraScraper.slug: MutuaNavarraScraper,
    CorachanScraper.slug: CorachanScraper,
    ColiseeScraper.slug: ColiseeScraper,
    EfisioterapiaScraper.slug: EfisioterapiaScraper,
    TalentSaludScraper.slug: TalentSaludScraper,
    EndivoScraper.slug: EndivoScraper,
    WinidScraper.slug: WinidScraper,
}
