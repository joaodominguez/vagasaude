# Plan de lanzamiento — VacantesSalud (es-ES)

Estado a 2026-11-03. Rama `es/inicial`. **Nada desplegado, dominio no comprado, servidor sin tocar.**

## 1. Hecho (en la rama)
- `apps/web-es`: copia de `apps/web` (PT) adaptada a España. UI, metadatos, JSON-LD, emails de alertas,
  intros/FAQ de landings, breadcrumbs, footer y home en español. `html lang="es"`, `og:locale es_ES`,
  moneda EUR (`es-ES`), `SITE_URL` por defecto `https://vacantessalud.es`, nombre **VacantesSalud** (propuesto).
- Rutas en español: `/empleo`, `/empleo/[slug]`, `/privacidad`, `/alertas/gestionar` (+ `/como-funciona`, `/alertas`, `/favoritos`).
  Parámetros: `comunidad`, `profesion`, `sector`, `contrato`, `periodo`, `ordenar`.
- Taxonomía ES (`taxonomies.ts`): 17 profesiones (Enfermería, Medicina, TCAE, Fisioterapia, Técnico sanitario,
  Farmacia, Técnico de farmacia, Celador, Psicología, Nutrición, Odontología, Veterinaria, Trabajo social,
  Formación, Comercial/Farma, Gestión y apoyo, Administrativo) y sectores Público/Privado/**Concertado** (sustituye a IPSS).
- Regiones: 17 CCAA + Ceuta y Melilla. Mapa de la home = cartograma de teselas (no hay GeoJSON en el repo).
- Eliminado/neutralizado: logos de socios PT, `salary-benchmarks` (mecanismo conservado, **sin datos** → `null`),
  scrapers PT, `pt-locative` (→ `es-locative`, trivial), reparación de URLs BEP, tabla de scrapers del admin
  (ahora derivada de `sources.ts`), `shorten-job-title` (reducido a limpieza genérica), **IDs por defecto de
  GA4 / Clarity / AdSense de PT eliminados** (si no, el tráfico ES contaminaría PT).
- `scrapers-es/`: esqueleto sin fuentes, `normalize.py` ES (provincia/ciudad→CCAA, `guess_profession`,
  `guess_contract`) con tests; `INGEST_BASE_URL` obligatorio (el 3010 es PT).
- Digest de alertas: zona horaria por defecto `Europe/Madrid`.
- Footer: enlaces "También en Portugal / Brasil".
- Docs: `docs/es/fuentes-empleo-sanidad-es.md` (investigación de fuentes).

## 2. Falta antes de salir a producción
**Infraestructura (requiere decisión/acción del propietario)**
1. Comprar `vacantessalud.es` (y valorar `.com`/`vacantessalud.com` defensivo). *.es requiere NIF/NIE español o UE vinculado → ver §3.*
2. DNS en Cloudflare (misma cuenta que PT/BR): zona nueva, proxy, SSL Full(strict), reglas de caché HTML como en PT (`next.config.ts`).
3. Servidor: vhost Apache nuevo (`deploy/apache/`) + proceso Next en **tmux/systemd en un puerto libre** (PT usa 3010; comprobar BR) con su propio `DATA_DIR`, `.env.production` y usuario/ruta (`/var/www/vacantessalud`). No reutilizar `/var/www/vagasaude/data`.
4. Scripts de deploy: adaptar `deploy/package-web.sh`, `deploy-release.sh`, `run-scrapers.sh` (rutas, puerto, `INGEST_BASE_URL`) en una copia `-es`; añadir cron de scrapers y digest.
5. **GA4**: nueva propiedad + `NEXT_PUBLIC_GA_MEASUREMENT_ID`. **Clarity**: nuevo proyecto. AdSense: decidir (sitio nuevo, política de contenidos).
6. **Search Console**: propiedad de dominio (DNS TXT), enviar `sitemap.xml`; (opcional) Indexing API como en PT (`tools/indexing_notify.py`, cuenta de servicio propia).
7. **Resend**: dominio de envío `vacantessalud.es` (SPF/DKIM/DMARC), `EMAIL_FROM`, clave de API propia.
8. Generar `ADMIN_PASSWORD` y `SCRAPER_API_TOKEN` nuevos (distintos de PT/BR).

**Producto / contenido**
9. **Scrapers**: escribir los primeros (orden en `fuentes-empleo-sanidad-es.md` §4): BOE API, SERMAS bolsas, Sergas, ICS, Osakidetza, SAS, Amavir/Sanitas, Hospiten, Ribera/HM. Registrar en `scrapers-es/sources/__init__.py` y en `apps/web-es/src/lib/sources.ts`.
10. **Tipo de oferta** (OPE / bolsa / oferta puntual): las fuentes públicas españolas son mayoritariamente bolsas permanentes; decidir si se muestra en la ficha (campo nuevo o prefijo en el título).
11. Datos salariales ES (`salary-benchmarks.ts`, ahora vacío): convenios y tablas retributivas de los Servicios de Salud.
12. `shorten-job-title.ts`: versión ES para títulos de convocatorias BOE/OPE (hoy sin recorte).
13. Revisión de textos por un hablante nativo de es-ES (traducción hecha por IA); logotipo/marca (el isotipo "V+" es el de VagaSaúde).
14. **Legal**: aviso legal (LSSI-CE), política de cookies y **banner de consentimiento** (AEPD exige consentimiento previo para GA/Clarity), política de privacidad con responsable real (RGPD/LOPDGDD). El texto actual es un borrador técnico.
15. Pruebas: `next build` con datos reales, Lighthouse/CWV, revisión de landings (umbral `CATEGORY_MIN_JOBS = 3`).
16. Mejoras de i18n opcionales: `hreflang` entre PT/BR/ES no aplica (idiomas distintos) pero sí enlaces de pie.

## 3. Decisiones que debe tomar el propietario
1. **Nombre**: `VacantesSalud` (propuesto) vs `EmpleoSalud`, `VacantesSanidad`, `TrabajoSanitario`… ("vacantes" es más usado en LatAm; en España se busca más "empleo", "ofertas", "bolsa de empleo", "oposiciones"). Si cambia, tocar `SITE_NAME` en `seo.ts`, `logo.tsx`, `email.ts` y dominios en textos.
2. **Dominio**: `.es` exige titular con vínculo con España/UE; confirmar quién lo registra. ¿`.com` también?
3. **Rutas**: se ha usado `/empleo` (más buscado que `/vacantes`; alternativas `/ofertas`, `/vacantes`). Renombrar es un `sed` sobre `src` + mover carpetas. Cambiar tras el lanzamiento = redirecciones 301.
4. **Granularidad geográfica**: **recomendación: comunidades autónomas para landings** (19 páginas, con volumen suficiente por combinación profesión×comunidad desde el principio; los Servicios de Salud están organizados por CCAA, así que las fuentes públicas casan 1:1) y **provincia como filtro/segundo nivel** más adelante cuando haya volumen (50 provincias × 17 profesiones diluyen en landings casi vacías y bajo `CATEGORY_MIN_JOBS`). Las búsquedas locales fuertes ("enfermero Madrid", "TCAE Barcelona") se cubren con Madrid/Cataluña porque son uniprovinciales/dominantes; para Andalucía, Castilla y León y Galicia habrá que añadir provincias antes.
5. **Sectores**: "Concertado" (Cruz Roja, San Juan de Dios, fundaciones) en lugar de IPSS; ¿hace falta "Universidad/Investigación"?
6. **Profesiones**: confirmar la lista (p. ej. separar Matrona, Terapia ocupacional/Logopedia, TES de "Técnico sanitario"; hoy TO/logopedia/TES caen en "Técnico sanitario").
7. **Oposiciones/OPE**: ¿se publican en el mismo listado que las ofertas o en una sección propia (`/oposiciones`)? Mucho tráfico SEO en "oposiciones enfermería/TCAE".
8. **Servidor**: ¿mismo VPS (91.99.167.243) con otro puerto o servidor nuevo?
9. **AdSense / monetización** en ES y banner de cookies (herramienta de consentimiento).
10. **Fuentes de pago/acuerdos**: ¿pedir feeds a grupos (Quirónsalud, Sanitas, DomusVi) o solo scraping de portales propios?
