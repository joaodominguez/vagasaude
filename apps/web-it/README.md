# Offerte Sanità (apps/web-it)

Versione italiana (it-IT) di VagaSaúde, per il dominio **offertesanita.it**
(non ancora acquistato/configurato). Derivata da `apps/web-es`. Next.js 16 (App Router):
leggere `AGENTS.md` e `node_modules/next/dist/docs/` prima di usare API di Next.

```bash
npm ci
DATA_DIR=/tmp/os-it-data NEXT_PUBLIC_SITE_URL=http://localhost:3013 npm run dev -- -p 3013
npx tsc --noEmit -p .
npm run lint
DATA_DIR=/tmp/os-it-data npm run build
```

- Rotte: `/offerte`, `/offerte/[slug]`, `/offerte/[professione|regione]/[...]`, `/concorsi`, `/aziende`,
  `/dati`, `/stipendi`, `/contatti`, `/privacy`, `/cookie`, `/note-legali`, `/avvisi`, `/preferiti`.
- Tassonomie: `src/lib/taxonomies.ts` (professioni) e `src/lib/italy-map.ts` (regioni).
  Il campo interno si chiama ancora `district` (contratto con gli scraper: `location_district`).
- Scraper: `../../scrapers-it/`. Note del progetto: vedere `README-IT.md` (PT-PT).
- GA4 / Clarity: nessun ID di default; definire variabili d'ambiente proprie.
- Casella `contatti@offertesanita.it`: **non esiste ancora**.
