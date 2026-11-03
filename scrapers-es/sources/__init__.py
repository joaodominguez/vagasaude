"""Registro de scrapers de VacantesSalud (España).

VACÍO a propósito: todavía no hay scrapers ES. Orden de implementación
recomendado en docs/es/fuentes-empleo-sanidad-es.md. Para añadir una fuente:
  1. copiar sources/_template.py, implementar `fetch()`;
  2. importarla aquí y registrarla en SCRAPERS (clave = `slug`);
  3. añadir la entrada correspondiente en apps/web-es/src/lib/sources.ts.
"""

SCRAPERS: dict = {}
