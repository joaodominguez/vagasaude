# Scrapers VacantesSalud (España)

Esqueleto sin fuentes activas todavía. Derivado de `../scrapers` (Portugal) pero **sin ningún scraper PT**.

- `common/normalize.py`: normalización ES (provincia/ciudad → comunidad autónoma, `guess_profession`
  con las profesiones de `apps/web-es/src/lib/taxonomies.ts`, `guess_contract`). Debe mantenerse
  sincronizado con `guessProfession` en `apps/web-es/src/lib/job-store.ts`.
- `sources/_template.py`: plantilla para nuevas fuentes. `sources/__init__.py`: registro (vacío).
- `run.py`: ejecuta fuentes y las envía a `POST {INGEST_BASE_URL}/api/ingest`.
  `INGEST_BASE_URL` es obligatorio y NO tiene valor por defecto (el 3010 es el sitio PT en el servidor).
- Fuentes candidatas y orden recomendado: `../docs/es/fuentes-empleo-sanidad-es.md`.

```bash
cd scrapers-es
python3 -m pip install -r requirements.txt
python3 -I -m unittest discover -s tests   # tests de normalización
INGEST_BASE_URL=http://127.0.0.1:3020 SCRAPER_API_TOKEN=... python3 run.py --source all --dry-run
```
