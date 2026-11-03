# Fuentes de empleo sanitario en España — investigación para VacantesSalud

Fecha de la investigación: 2026-11-03. Método: búsquedas web + lectura de `robots.txt` y páginas oficiales.
**Limitación honesta:** las herramientas de búsqueda devolvieron resultados desiguales; todo lo marcado
como *(verificar)* no se ha comprobado en vivo (volumen, estructura HTML, ATS exacto, términos de uso).
Antes de escribir cada scraper hay que (1) leer `robots.txt` y los términos de la fuente, (2) inspeccionar
la página real, (3) decidir si se scrapea o se pide permiso/feed. Esto no es asesoramiento jurídico.

## 0. Cómo es el mercado (diferencias clave con Portugal)

1. **Sector público = bolsas permanentes, no "ofertas".** En España el personal estatutario temporal se
   contrata desde *bolsas/listas* gestionadas por cada Servicio de Salud (17 CCAA + INGESA). Muchas están
   "abiertas permanentemente" y el candidato se inscribe una vez; la oferta concreta se hace por teléfono.
   Lo scrapeable y útil para el usuario son: (a) las **fichas de bolsa por categoría** (inscripción
   abierta), (b) las **ofertas puntuales** que algunos servicios publican (Sergas, ICS, Osakidetza), y
   (c) las **convocatorias OPE/oposiciones** en boletines oficiales. Conviene modelar en el producto
   "tipo de oferta": *oposición (OPE)*, *bolsa de contratación temporal*, *oferta puntual*.
2. **Sector privado fragmentado** en grandes grupos (Quirónsalud, HM, Vithas, Sanitas, Ribera, HLA,
   Hospiten, Viamed, Ascires) con portales propios sobre ATS.
3. **Residencias y dependencia** (DomusVi, Amavir, Emeis/Orpea, Sanitas Mayores, Vitalia, Ballesol…) son
   el mayor volumen de TCAE/gerocultor, enfermería y fisioterapia. Alta rotación = muchas ofertas.
4. **Portales generalistas dominantes** (InfoJobs, Indeed, LinkedIn) — no scrapear (ver §5).

## 1. Prioridad A — scrapear primero (alto valor / viabilidad técnica)

| # | Fuente | URL | Tipo | Qué lista | Cómo scrapear | Notas / caveats |
|---|---|---|---|---|---|---|
| 1 | **BOE — Sumario diario (OPE sanitarias)** | https://www.boe.es/datosabiertos/api/api.php — endpoint `GET /datosabiertos/api/boe/sumario/{aaaammdd}` | Público (boletín) | Convocatorias de procesos selectivos de la AGE, universidades y CCAA publicadas en BOE (sección II.B "Oposiciones y concursos"); resoluciones de OEP | **API oficial JSON/XML** (verificada). Filtrar por departamento/título (enfermer*, médic*, facultativ*, TCAE, "cuidados auxiliares", Servicio de Salud…) | Reutilización sujeta al aviso legal del BOE (licencia no nombrada en la página de la API: verificar). `robots.txt` bloquea muchas rutas de documento y `xml.php`; usar la API, no el HTML. Las OPE autonómicas **no** están todas en BOE: complementar con boletines autonómicos (§2). Modelo: tipo "oposición" |
| 2 | **SERMAS Madrid — Bolsas únicas** | `https://sede.comunidad.madrid/oferta-empleo/<categoría>` (p.ej. `/oferta-empleo/tecnico-cuidados-auxiliares-enfermeria-2`, `/medico-familia-primaria`, `/fisioterapeuta-1`) | Público | Una ficha por categoría (TCAE, enfermería SUMMA 112, TES, médicos, fisio, TS, lab…), plazo "abierto permanentemente", fecha de corte de méritos | HTML estático de la sede (Drupal). Listado enumerable desde `/oferta-empleo`  *(verificar)* | Son bolsas, no vacantes. Algunas fichas llevan >1 año sin actualizar. Contacto bolsa: candidatos.bolsa@salud.madrid.org. Revisar `robots.txt` de sede.comunidad.madrid |
| 3 | **ICS (Cataluña) — Convocatòries de treball temporal / Treball fix** | https://ics.gencat.cat/ca/lics/treballeu-a-lics/treball-temporal/ · `.../convocatories-de-treball-temporal/` · `.../treball-fix/` | Público | Convocatorias de treball temporal (p. ej. FEA, medicina de familia) con plaza concreta; OPE (2025: 6.037 plazas, 74 categorías) | HTML (gencat). Listado de convocatorias vigentes/resueltas *(verificar estructura)* | Contenido en catalán → traducir títulos / mantener literal. Borsa de treball es por inscripción nominal (no scrapeable) |
| 4 | **Sergas (Galicia) — Ofertas de contratación temporal** | https://www.sergas.es/Recursos-Humanos/OFERTA-FEAS-2025 · https://www.sergas.gal/Recursos-Humanos/Emprego-publico-Seleccion-temporal · listados: https://www.sergas.es/Recursos-Humanos/Listaxes-de-contrataci%C3%B3n | Público | Ofertas mensuales de contratación temporal (FEA y otras categorías), listados de contratación | HTML (portal propio) + PDFs *(verificar)* | Páginas por año (cambia la URL cada año → descubrir por índice). Redirige `.es`→`.gal` |
| 5 | **Osakidetza (País Vasco) — Contratación temporal / OPE** | https://www.osakidetza.euskadi.eus/contratacion-temporal/webosk00-procon/es/ · OPE: https://www.osakidetza.euskadi.eus/oferta-publica-de-empleo-ope-2020-21-22-estabilizacion/webosk00-procon/es/ | Público | Avisos de apertura de inscripción en listas por titulación, OPE, convocatorias de puestos (Osatek: `.../convocatoria-de-puestos/webosk00-otkcon/es/`) | HTML (euskadi.eus); listas de avisos | Bilingüe es/eu. País Vasco publica también en BOPV (datos abiertos Euskadi) |
| 6 | **SAS (Andalucía) — Bolsa de empleo / OPE** | https://www.sspa.juntadeandalucia.es/servicioandaluzdesalud/profesionales/ofertas-de-empleo/bolsa-de-empleo | Público | Convocatorias de bolsa (inscripción online; bolsa permanente con corte anual 31-oct), OEP | HTML del portal SSPA; convocatorias en BOJA | Mayor servicio de salud por plantilla. Las ofertas concretas se hacen por teléfono (no hay "anuncio" por plaza). Útil como fuente de *convocatorias* y como landing "cómo inscribirse" |
| 7 | **Quirónsalud** | https://www.quironsalud.com/es/empleo (enlaza a portal de ofertas y envío de CV; algunos centros publican por separado) | Privado (≈ mayor grupo) | Ofertas de todo el grupo; ~282 en InfoJobs (referencia de volumen, no de su portal) | Portal propio/ATS *(verificar: la web devolvió 403 a un fetch genérico)* | Las ofertas suelen duplicarse en InfoJobs → deduplicar |
| 8 | **Ribera Salud** | https://empleo.riberasalud.com/ ("Orbio Apply Site") | Privado (+ concesiones públicas: Torrejón, Elche, Ferrol…) | Ofertas de hospitales Ribera | ATS **Orbio**; inspeccionar si hay JSON-LD / API pública *(verificar)* | |
| 9 | **Sanitas (hospitales, clínicas dentales, mayores)** | https://empleo.sanitas.es/ · https://empleo.sanitas.es/jobs (~114 vacantes en una captura) | Privado | Hospitales, Sanitas Dental, Sanitas Mayores | URL tipo `/jobs/<id>-<slug>`: patrón compatible con **Teamtailor** (en PT la CUF usa Teamtailor con feed JSON) — probar `/jobs.rss`/JSON *(verificar)* | |
| 10 | **Amavir** (residencias) | https://empleo.amavir.es/ · https://empleo.amavir.es/jobs (~149 vacantes) | Privado | Medicina, enfermería, gerocultor/TCAE, fisio, psicología, TS, farmacia | Mismo patrón de plataforma que Sanitas (`/jobs/<id>-<slug>`, `/locations/<centro>`) → un único parser reutilizable *(verificar)* | Buen volumen de TCAE/gerocultores. Aporta ubicación por centro |

## 2. Prioridad B — siguientes oleadas

### 2.1 Servicios de salud autonómicos y boletines (resto de CCAA)
| Fuente | URL | Notas |
|---|---|---|
| SACYL (Castilla y León) | https://www.saludcastillayleon.es/profesionales/en/ofertasconcursos | Procesos selectivos y bolsas; páginas con material antiguo (verificar vigencia) |
| SESCAM (Castilla-La Mancha) | http://sescam.castillalamancha.es/content/bolsa-de-empleo | Información posiblemente desactualizada (último ítem 2019 en el resultado) |
| SERMAS — portal de salud / SUMMA 112 | https://www.comunidad.madrid/ (sede) | Ver §1 fila 2 |
| Servicio Aragonés (Salud Aragón), SESPA (Asturias), IB-Salut (Baleares), SCS (Canarias), SES (Extremadura), SMS (Murcia), Navarra (Salud Navarra), Salud La Rioja, Servicio Cántabro (SCS), Valenciana (Conselleria de Sanitat, bolsa de trabajo) | *no investigados en esta pasada* | Cada uno con su sede/bolsa. Cubrir tras los 5-6 grandes |
| Boletines autonómicos: BOJA, DOGC, DOG, BOCM, BOPV, DOCV, BOA, BOCYL, DOCM, BON, BOIB, BOC, BOR, BORM, DOE, BOPA, BOC (Cantabria) | cada boletín | Muchos ofrecen RSS/ELI; extraer solo resoluciones de procesos selectivos sanitarios. Mejor tras BOE |
| INGESA (Ceuta y Melilla) | https://ingesa.sanidad.gob.es/ *(verificar)* | Volumen pequeño pero cubre Ceuta/Melilla |
| Sanidad penitenciaria, Defensa, Cruz Roja (concertado), Ministerio de Sanidad | varios | Residuales |

### 2.2 Grandes grupos privados
| Grupo | URL | ATS / forma | Notas |
|---|---|---|---|
| HM Hospitales | https://www.hmhospitales.com/trabaja-con-nosotros/ofertas-de-trabajo/ ; CV: careers.talentclue.com | Listado propio en web + TalentClue (verificado por enlaces) | Listado propio HTML, probablemente scrapeable |
| Vithas | https://www.vithas.es/corporativa/trabaja-con-nosotros | Formulario de CV + ofertas | Verificar si hay listado de vacantes |
| Hospiten | https://jobs.hospiten.com/ | URLs `/go/<categoría>/<id>/` → **SAP SuccessFactors** (Career Site Builder) | SuccessFactors suele tener feed XML/sitemap; categorías: Facultativos, Enfermería… |
| HLA | https://www.hla.es/ *(sección empleo: verificar)* | — | |
| Viamed, Ascires, Grupo Hospitalario Recoletas, IMED, Clínica Universidad de Navarra, Jiménez Díaz (Quirón), Quirón Prevención, Cruz Roja, San Juan de Dios (concertado) | webs respectivas | no investigado | San Juan de Dios y Cruz Roja → sector "Concertado" |

### 2.3 Residencias / dependencia (alto volumen TCAE)
| Grupo | URL | Notas |
|---|---|---|
| DomusVi | web de empleo propia *(la URL `domusvi.es/trabaja-con-nosotros/` dio 404; localizar la correcta)* ; 209 ofertas en InfoJobs como referencia | Mayor operador del sector; publica en InfoJobs → buscar portal propio |
| Emeis (ex-Orpea) España | https://www.emeis.com/ *(verificar sede ES)* | |
| Sanitas Mayores | cubierto por empleo.sanitas.es | |
| Vitalia, Ballesol, Caser Residencial, Colisée, Mensajeros de la Paz | no investigado | |

### 2.4 Farmacia
- **Portal de empleo del Consejo General de COF (Organización Farmacéutica Colegial)** — según una noticia de julio 2026 reúne ~1.120 ofertas activas (mayoritariamente farmacéutico y técnico en farmacia); los colegios canalizan ofertas a él. Es la fuente nº 1 de farmacia comunitaria. Ver https://www.farmaceuticos.com/ (localizar URL del portal; ver términos: es de una corporación colegial). *(verificar)*
- Bolsas de colegios: COF Madrid https://www.cofm.es/es/empleo ; MICOF Valencia https://www.micof.es/ver/771/acceso-a-la-bolsa-de-empleo.html ; SEFAC (solo socios → no).
- Cadenas / redes: Lloyds Farmacia, Farmacias Aliadas / Cofares (Farmacia Cofares), Hefame, Bidafarma, Alliance Healthcare (distribución), Dosfarma. No se localizó bolsa propia de Cofares/Alliance. Muchas usan ATS tipo Factorial (en PT ya hay scrapers `factorial_farmacias`, reutilizable).

### 2.5 Laboratorios, diálisis, imagen
- Synlab España, Unilabs, Eurofins, Cerba, Echevarne, Affidea, Cruz Roja… — no se localizaron portales en la búsqueda; reutilizar los scrapers PT por tipo de ATS (en PT existen `synlab.py`, `unilabs.py`, `affidea.py`, `fresenius.py` que muestran el patrón, pero **los portales ES son distintos**).
- Diálisis: Fresenius Medical Care (España), Diaverum, NefroCare/Nephrocare — buscar su portal Workday/SuccessFactors *(verificar)*.

### 2.6 Otras bolsas
- Colegios oficiales de Enfermería (CGE, COE Madrid, Barcelona…), de Médicos (OMC, ICOMEM), Fisioterapeutas (CGCFE), Psicología (COP), Nutricionistas: bolsas colegiales, con acceso a menudo solo a colegiados.
- Universidades y centros de investigación (CSIC, ISCIII, Fundaciones de investigación biomédica): ofertas técnicas/investigación; baja prioridad.

## 3. Agregadores y portales generalistas (InfoJobs, Indeed, LinkedIn, Jooble…)

- **InfoJobs:** su `robots.txt` (leído 2026-11-03) **desautoriza para `User-agent: *`** casi todas las rutas de listado y ficha de oferta (`/ofertas_lista.cfm`, `/ver-oferta.xhtml`, `/buscar.empleo/`, `/lista-ofertas/`, etc.) y bloquea por completo a crawlers de IA y a jobrapido. → **No scrapear.** Las ofertas de grupos privados aparecen también en sus propios portales, que sí se pueden tratar.
- **Indeed:** `robots.txt` bloquea `/viewjob`, `/rc/` (clicks), `/company/*` y URLs con `&start=` para bots genéricos. Fuentes de terceros afirman que sus términos prohíben el scraping (no verificado contra los términos reales). → **No scrapear.** En el proyecto PT ya se decidió lo mismo ("Indeed: no integrado").
- **LinkedIn, Jooble, Jobijoba, Adzuna…:** mismos riesgos; vía legítima = **API/feeds con acuerdo** (p. ej. programa de partners de Jooble) o enlaces de salida. Fuera de alcance de la fase 1.
- **Servicio Público de Empleo (SEPE / Empléate, SAE, Lanbide…):** portales de empleo públicos; ofertas generales con filtro sanitario. Revisar términos y datos abiertos (datos.gob.es). Candidato a fase 2 (como en PT el IEFP).

## 4. Orden recomendado (top 10 a escribir primero)

1. **BOE sumario (API)** — fácil, estable, cubre OPE nacionales y de muchas CCAA.
2. **SERMAS bolsas únicas** (sede.comunidad.madrid) — HTML simple, Madrid concentra mucho tráfico.
3. **Sergas ofertas temporales** — publica ofertas puntuales reales.
4. **ICS convocatòries** (Cataluña).
5. **Osakidetza** contratación temporal/OPE.
6. **SAS bolsa/OPE** (Andalucía).
7. **Amavir** (parser reutilizable para Sanitas).
8. **Sanitas empleo** (mismo patrón).
9. **Hospiten (SuccessFactors)**.
10. **Ribera (Orbio)** — o **HM Hospitales** si el listado propio resulta más sencillo; **Quirónsalud** pasa a primer puesto del siguiente bloque en cuanto se resuelva el acceso.

Para el bloque privado, adelantar además el **portal de empleo del Consejo General de COF** (farmacia) y **DomusVi** (volumen TCAE) en cuanto se localicen sus URL/ATS.

## 5. Notas técnicas y legales

- **Identificación:** User-Agent propio (`VacantesSaludBot/…`), throttle ≥0,4 s (ya en `scrapers-es/common/http.py`), respetar `robots.txt`.
- **RGPD / LOPDGDD:** las ofertas no deberían contener datos personales; descartar emails/teléfonos de personas físicas en descripciones.
- **Derechos de base de datos (art. 133 LPI) y términos de uso:** para fuentes privadas, enlazar siempre a la oferta original (como en PT) y valorar escribir a los grupos para pedir feed/autorización (Quirónsalud, Sanitas, DomusVi…) — suele aceptarse porque aporta candidatos.
- **Reutilización de información pública (Ley 37/2007):** BOE y boletines autonómicos permiten reutilización con las condiciones de su aviso legal; citar fuente.
- **Deduplicación:** el campo `AGGREGATOR_SOURCES` en `apps/web-es/src/lib/job-store.ts` está vacío; si más adelante se integra algún agregador, añadirlo ahí para que prevalezca la oferta del empleador.

## 6. Fuentes consultadas
- API datos abiertos BOE: https://www.boe.es/datosabiertos/api/api.php ; robots: https://www.boe.es/robots.txt
- InfoJobs robots: https://www.infojobs.net/robots.txt ; Indeed robots: https://es.indeed.com/robots.txt ; Indeed crawlers: https://www.indeed.com/about/indeed-crawlers
- SAS: https://www.sspa.juntadeandalucia.es/servicioandaluzdesalud/profesionales/ofertas-de-empleo/bolsa-de-empleo/normativa-de-bolsa-de-empleo
- SERMAS (sede): https://sede.comunidad.madrid/oferta-empleo/tecnico-cuidados-auxiliares-enfermeria-2
- ICS: https://ics.gencat.cat/ca/lics/treballeu-a-lics/treball-temporal/borsa-de-treball/
- Osakidetza: https://www.osakidetza.euskadi.eus/contratacion-temporal/webosk00-procon/es/
- Sergas: https://www.sergas.es/Recursos-Humanos/OFERTA-FEAS-2025?idioma=es
- SACYL: https://www.saludcastillayleon.es/profesionales/en/ofertasconcursos ; SESCAM: http://sescam.castillalamancha.es/content/bolsa-de-empleo
- Quirónsalud: https://www.quironsalud.com/es/empleo ; HM: https://www.hmhospitales.com/trabaja-con-nosotros/ofertas-de-trabajo/ ; Hospiten: https://jobs.hospiten.com/ ; Ribera: https://empleo.riberasalud.com/ ; Sanitas: https://empleo.sanitas.es/jobs ; Vithas: https://www.vithas.es/corporativa/trabaja-con-nosotros ; Amavir: https://empleo.amavir.es/jobs
- Farmacia: https://www.cofm.es/es/empleo ; https://www.micof.es/ver/771/acceso-a-la-bolsa-de-empleo.html
