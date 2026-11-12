# Scraper Offerte Sanità (Italia)

Scheletro **senza fonti attive**: il registro `sources/__init__.py` è vuoto. Le fonti italiane
si decideranno dopo la ricerca in `../docs/it/`. Derivato da `../scrapers-es` (framework: `common/`,
`run.py`, `tools/`, `sources/_template.py`).

- `common/normalize.py`: normalizzazione IT. `guess_district` (comune/provincia/sigla -> una delle
  20 regioni, oppure "Italia" se non riconosciuta), `guess_profession` (restituisce l'**etichetta**
  della tassonomia dell'app; `PROFESSION_SLUGS` / `profession_slug()` danno lo slug URL),
  `guess_contract` (Tempo indeterminato, Tempo determinato, Part-time, Full-time, Turni,
  Libero professionale, Apprendistato, Tirocinio, Contratto). Da mantenere sincronizzata con
  `apps/web-it/src/lib/taxonomies.ts` e `guessProfession` in `apps/web-it/src/lib/job-store.ts`.
- `run.py`: esegue le fonti e le invia a `POST {INGEST_BASE_URL}/api/ingest`.
  `INGEST_BASE_URL` è obbligatorio, senza valore predefinito (3014 = sito IT, solo in futuro).
- `run-scrapers.sh`: helper cron, **solo segnaposto** (nessun deploy fatto).

```bash
cd scrapers-it
python3 -m pip install -r requirements.txt pytest
python3 -m pytest -q
INGEST_BASE_URL=http://127.0.0.1:3014 SCRAPER_API_TOKEN=... python3 run.py --source all --dry-run
```
