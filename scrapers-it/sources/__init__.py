"""Registro degli scraper di Offerte Sanita' (Italia).

Per aggiungere una fonte:
  1. copiare sources/_template.py e implementare `fetch()`;
  2. importarla qui e registrarla in SCRAPERS (chiave = `slug`);
  3. aggiungere la voce corrispondente in apps/web-it/src/lib/sources.ts.

Fonti pubbliche (ordine di priorita' contro i duplicati: Veneto > inPA > Gazzetta Ufficiale;
vedi sources/_it_pub.py: i lettori a priorita' piu' bassa rileggono le chiavi di quelli piu' ricchi).
"""
from .anicura import AnicuraScraper
from .clariane import ClarianeScraper
from .gu_s4 import GuS4Scraper
from .humanitas import HumanitasScraper
from .inpa import InpaScraper
from .veneto_concorsi import VenetoConcorsiScraper

SCRAPERS: dict = {
    scraper.slug: scraper
    for scraper in (VenetoConcorsiScraper, InpaScraper, GuS4Scraper, HumanitasScraper, ClarianeScraper, AnicuraScraper,)
}

# Fonti private (settore "privato", tipo "offerta"): vedi sources/_it_priv.py.
