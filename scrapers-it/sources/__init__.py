"""Registro degli scraper di Offerte Sanita' (Italia).

Per aggiungere una fonte:
  1. copiare sources/_template.py e implementare `fetch()`;
  2. importarla qui e registrarla in SCRAPERS (chiave = `slug`);
  3. aggiungere la voce corrispondente in apps/web-it/src/lib/sources.ts.

Fonti pubbliche (ordine di priorita' contro i duplicati: Veneto > inPA > Gazzetta Ufficiale;
vedi sources/_it_pub.py: i lettori a priorita' piu' bassa rileggono le chiavi di quelli piu' ricchi).
"""
from .affidea import AffideaScraper
from .ares_sardegna import AresSardegnaScraper
from .arcs_fvg import ArcsFvgScraper
from .aorn_colli import AornColliScraper
from .asl_napoli3sud import AslNapoli3SudScraper
from .asl_roma1 import AslRoma1Scraper
from .asl_roma2 import AslRoma2Scraper
from .asl_roma3 import AslRoma3Scraper
from .asl_roma5 import AslRoma5Scraper
from .estar_toscana import EstarToscanaScraper
from .anicura import AnicuraScraper
from .auxologico import AuxologicoScraper
from .bianalisi import BianalisiScraper
from .cerba import CerbaScraper
from .clariane import ClarianeScraper
from .fatebenefratelli import FatebenefratelliScraper
from .fresenius import FreseniusScraper
from .gemelli import GemelliScraper
from .habilita import HabilitaScraper
from .gu_s4 import GuS4Scraper
from .gvm import GvmScraper
from .humanitas import HumanitasScraper
from .ieo import IeoScraper
from .inpa import InpaScraper
from .kos_group import KosGroupScraper
from .maugeri import MaugeriScraper
from .veneto_concorsi import VenetoConcorsiScraper
from .plone_er import SCRAPER_CLASSES as PLONE_ER_SCRAPERS
from .randstad import RandstadScraper
from .synlab import SynlabScraper

SCRAPERS: dict = {
    scraper.slug: scraper
    for scraper in (VenetoConcorsiScraper, InpaScraper, GuS4Scraper, HumanitasScraper, ClarianeScraper, AnicuraScraper, CerbaScraper, FreseniusScraper,
                    AffideaScraper, MaugeriScraper, AuxologicoScraper, FatebenefratelliScraper, BianalisiScraper, IeoScraper, HabilitaScraper, *PLONE_ER_SCRAPERS, RandstadScraper,
                    # Fontes regionais novas (2026-11-20): ver _it_regional.py / regional.py.
                    AresSardegnaScraper, EstarToscanaScraper, ArcsFvgScraper,
                    # Lote 1 da fase 2 (2026-11-20): Lazio e Campania, leitores a medida (ver regional.py).
                    AslRoma1Scraper, AslRoma2Scraper, AslRoma3Scraper, AslRoma5Scraper, AslNapoli3SudScraper, AornColliScraper,
                    # Intervieweb: autorizzati dai gruppi il 2026-11-17 (vedi _intervieweb.py).
                    GemelliScraper, GvmScraper, SynlabScraper,
                    # Gruppo KOS (RSA/riabilitazione): lista HTML publica, sem descrizione (2026-11-20).
                    KosGroupScraper,)
}

# Fonti private (settore "privato", tipo "offerta"): vedi sources/_it_priv.py.
