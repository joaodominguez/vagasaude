# VacantesSalud (apps/web-es)

Versión española (es-ES) de VagaSaúde, para el dominio **vacantessalud.es**
(todavía no comprado). Derivada de `apps/web` (Portugal). Next.js 16 (App Router):
leer `AGENTS.md` y `node_modules/next/dist/docs/` antes de usar APIs de Next.

```bash
npm ci
DATA_DIR=/tmp/vs-es-data NEXT_PUBLIC_SITE_URL=http://localhost:3020 npm run dev -- -p 3020
npx tsc --noEmit -p .
DATA_DIR=/tmp/vs-es-data npm run build
```

- Rutas: `/empleo`, `/empleo/[slug]`, `/empleo/[profesion|comunidad]/[…]`, `/alertas`,
  `/favoritos`, `/como-funciona`, `/privacidad`.
- Taxonomía: `src/lib/taxonomies.ts` (profesiones) y `src/lib/spain-map.ts`
  (comunidades autónomas). El campo interno sigue llamándose `district`
  (contrato con los scrapers: `location_district`).
- Scrapers: `../../scrapers-es/`. Planificación: `../../docs/es/`.
- GA4 / Clarity: sin ID por defecto; definir variables de entorno propias.
