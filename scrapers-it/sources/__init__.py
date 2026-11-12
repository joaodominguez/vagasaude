"""Registro degli scraper di Offerte Sanita' (Italia).

VUOTO per scelta: le fonti italiane si decideranno dopo la ricerca (docs/it/).
Per aggiungere una fonte:
  1. copiare sources/_template.py e implementare `fetch()`;
  2. importarla qui e registrarla in SCRAPERS (chiave = `slug`);
  3. aggiungere la voce corrispondente in apps/web-it/src/lib/sources.ts.
"""

SCRAPERS: dict = {}
