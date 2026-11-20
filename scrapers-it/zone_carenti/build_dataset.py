#!/usr/bin/env python3
"""Costruisce i dataset JSON delle zone carenti / incarichi vacanti (assistenza primaria) per regione.

Fonti: pubblicazioni ufficiali delle Regioni (BUR + pagina istituzionale). Dati della PA riutilizzabili (CAD art. 52),
si cita sempre la fonte. Si estraggono SOLO ambiti, posti e scadenze: mai nomi, graduatorie nominative o punteggi.

Uso:  python3 build_dataset.py --cache /tmp/zc-cache --out ../../apps/web-it/src/data/zone-carenti
Richiede: pdftotext (poppler) e pdfplumber. Il download usa uno User-Agent identificato e ritmo lento.
"""
import argparse
import collections
import datetime
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parse_er, parse_piemonte, parse_toscana, parse_lombardia  # noqa: E402

UA = "Mozilla/5.0 (compatible; OffertesanitaBot/1.0; +https://offertesanita.it)"

TIPI = {
    "ruolo-unico": "Ruolo unico di assistenza primaria (medicina generale, ex continuità assistenziale)",
    "pls": "Pediatria di libera scelta",
    "emergenza-territoriale": "Emergenza sanitaria territoriale (118)",
}


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
        f.write(r.read())
    time.sleep(2)
    return dest


def by_asl(entries):
    d = collections.OrderedDict()
    for e in entries:
        x = d.setdefault(e["asl"], {"asl": e["asl"], "posti": 0, "ambiti": 0})
        x["posti"] += e["posti"]
        x["ambiti"] += 1
    return list(d.values())


def pub(id, tipo, titolo, edizione, pubblicato, bollettino, scadenza, scad_calc, page, pdf, bur, entries, current, ufficiale=None, nota=""):
    entries = [dict(e, note=e["note"][:300]) for e in entries]
    p = {
        "id": id, "tipo": tipo, "titolo": titolo, "edizione": edizione, "anno": 2026,
        "pubblicatoIl": pubblicato, "bollettino": bollettino, "scadenza": scadenza, "scadenzaCalcolata": scad_calc,
        "paginaUrl": page, "pdfUrl": pdf, "bollettinoUrl": bur,
        "totalePosti": sum(e["posti"] for e in entries), "totaleUfficiale": ufficiale, "nota": nota,
        "corrente": current, "perAsl": by_asl(entries),
    }
    if current:
        p["voci"] = entries
    return p


def build(cache, out):
    os.makedirs(out, exist_ok=True)
    cd = lambda n: os.path.join(cache, n)

    # ---------------- Emilia-Romagna ----------------
    er_mar = fetch("https://bur.regione.emilia-romagna.it/area-bollettini/medici-ambiti-territoriali-31.03/bollettino_view/++widget++form.widgets.pdf_firmato/@@download/", cd("er-73-2026.pdf"))
    er_ott = fetch("https://bur.regione.emilia-romagna.it/area-bollettini/n-275-del-22-10-2026-parte-terza/bollettino_view/++widget++form.widgets.pdf_firmato/@@download/", cd("er-275-2026.pdf"))
    t_mar, t_ott = parse_er.pdf_text(er_mar), parse_er.pdf_text(er_ott)
    ru = parse_er.parse_section(t_mar, "Numero incarichi vacanti", 0)
    es1 = parse_er.parse_section(t_mar, "Numero incarichi vacanti", 1)
    pls1 = parse_er.parse_section(t_mar, "Numero ambiti territoriali carenti", 0)
    es2 = parse_er.parse_section(t_ott, "Numero incarichi vacanti", 0)
    pls2 = parse_er.parse_section(t_ott, "Numero ambiti territoriali carenti", 0)
    bur73 = "https://bur.regione.emilia-romagna.it/area-bollettini/medici-ambiti-territoriali-31.03"
    pdf73 = bur73 + "/bollettino_view/++widget++form.widgets.pdf_firmato/@@download/"
    bur275 = "https://bur.regione.emilia-romagna.it/dettaglio-inserzione?i=fb18d94306ab49f3abc460a835531692"  # PLS (det. 20083)
    bur275es = "https://bur.regione.emilia-romagna.it/dettaglio-inserzione?i=4c88022364dd4db384bc14ceefe8d625"  # ES (det. 20082)
    pdf275 = "https://bur.regione.emilia-romagna.it/area-bollettini/n-275-del-22-10-2026-parte-terza/bollettino_view/++widget++form.widgets.pdf_firmato/@@download/"
    page_er = "https://salute.regione.emilia-romagna.it/ssr/carriera-e-formazione/medicina-convenzionata/incarichi-vacanti/avvisi-e-moduli"
    er = {
        "slug": "emilia-romagna", "nome": "Emilia-Romagna", "ente": "Regione Emilia-Romagna - Area Medicina convenzionata",
        "paginaUfficiale": page_er, "bollettinoNome": "BURERT",
        "ultimoAggiornamentoFonte": "2026-10-23",
        "note": ["Le Aziende USL dell'Emilia-Romagna sono 8 (Piacenza, Parma, Reggio Emilia, Modena, Bologna, Imola, Ferrara, Romagna). Le domande si presentano online tramite il portale regionale indicato nell'avviso."],
        "esclusi": ["Graduatorie regionali e punteggi dei medici: non pubblicati (dati personali)."],
        "pubblicazioni": [
            pub("er-ru-2026-03", "ruolo-unico", "Incarichi vacanti di medici del ruolo unico di assistenza primaria 2026", "prima pubblicazione 2026", "2026-03-31", "BURERT n. 73 del 31/03/2026 (parte terza), determinazione n. 5841 del 25/03/2026", "2026-04-20", True, bur73, pdf73, bur73, ru, True, nota="Scadenza: 20 giorni dalla pubblicazione sul BURERT (calcolata)."),
            pub("er-pls-2026-10", "pls", "Ulteriori ambiti territoriali carenti di pediatria di libera scelta 2026", "ulteriori ambiti, ottobre 2026", "2026-10-22", "BURERT n. 275 del 22/10/2026 (parte terza), determinazione n. 20083 del 16/10/2026", "2026-11-11", False, page_er, pdf275, bur275, pls2, True),
            pub("er-pls-2026-03", "pls", "Ambiti territoriali carenti di pediatria di libera scelta 2026", "prima pubblicazione 2026", "2026-03-31", "BURERT n. 73 del 31/03/2026 (parte terza), determinazione n. 5847 del 25/03/2026", "2026-04-20", True, bur73, pdf73, bur73, pls1, False),
            pub("er-es-2026-10", "emergenza-territoriale", "Incarichi vacanti di emergenza sanitaria territoriale, 2° semestre 2026", "2° semestre 2026", "2026-10-22", "BURERT n. 275 del 22/10/2026 (parte terza), determinazione n. 20082 del 16/10/2026", "2026-11-11", False, page_er, pdf275, bur275es, es2, True),
            pub("er-es-2026-03", "emergenza-territoriale", "Incarichi vacanti di emergenza sanitaria territoriale, 1° semestre 2026", "1° semestre 2026", "2026-03-31", "BURERT n. 73 del 31/03/2026 (parte terza), determinazione n. 5842 del 25/03/2026", "2026-04-20", True, bur73, pdf73, bur73, es1, False),
        ],
    }

    # ---------------- Piemonte ----------------
    pie = fetch("https://www.regione.piemonte.it/governo/bollettino/abbonati/2026/23/attach/dda1400000349_11200.pdf", cd("pie-bu23-2026.pdf"))
    pie_rows = parse_piemonte.parse(pie)
    for r in pie_rows:
        if len(r["note"]) > 300:
            r["note"] = "Posti ripartiti per distretto e AFT (vedi allegato A ufficiale)."
    page_pie = "https://www.regione.piemonte.it/web/temi/sanita/organizzazione-strutture-sanitarie/incarichi-vacanti-ruolo-unico-assistenza-primaria"
    piemonte = {
        "slug": "piemonte", "nome": "Piemonte", "ente": "Regione Piemonte - Sanità, Sistemi organizzativi e risorse umane del SSR",
        "paginaUfficiale": page_pie, "bollettinoNome": "BUR Piemonte",
        "ultimoAggiornamentoFonte": "2026-10-15",
        "note": ["In Piemonte la pubblicazione ordinaria avviene di norma a marzo e le carenze possono essere ripubblicate durante l'anno (nel 2026 il BU n. 23 è del 11 giugno). La domanda si invia solo con l'applicativo regionale GRMED (SPID, CIE o CNS)."],
        "esclusi": [
            "Graduatorie provvisoria e definitiva e assegnazioni 2026 (BU n. 38 e n. 41): nominative, non pubblicate qui.",
            "Pediatria di libera scelta ed emergenza territoriale: non trovata una pubblicazione 2026 equivalente sulle pagine regionali verificate.",
        ],
        "pubblicazioni": [
            pub("pie-ru-2026-06", "ruolo-unico", "Incarichi vacanti 2026 del ruolo unico di assistenza primaria", "pubblicazione 2026", "2026-06-11", "BUR Piemonte n. 23 dell'11/06/2026, D.D. n. 349 del 04/06/2026", "2026-07-01", True, page_pie, "https://www.regione.piemonte.it/governo/bollettino/abbonati/2026/23/attach/dda1400000349_11200.pdf", "https://www.regione.piemonte.it/governo/bollettino/abbonati/2026/23/siste/00000035.htm", pie_rows, True, nota="Domande per 20 giorni dal giorno successivo alla pubblicazione (scadenza calcolata)."),
        ],
    }

    # ---------------- Toscana ----------------
    base = "https://www.regione.toscana.it"
    tos_ru = parse_toscana.parse(fetch(base + "/documents/d/guest/avviso-incarichi-vacanti-ruolo-unico-assistenza-primaria_-2026", cd("tos-ru.pdf")))
    tos_pls2 = parse_toscana.parse(fetch(base + "/documents/d/guest/avviso-seconda-pubblicazione-2026-ambiti-territoriali-carenti-pediatria", cd("tos-pls2.pdf")))
    tos_pls1 = parse_toscana.parse(fetch(base + "/documents/d/guest/avviso-ambiti-territoriali-carenti-pls_2026", cd("tos-pls1.pdf")))
    tos_es2 = parse_toscana.parse(fetch(base + "/documents/d/guest/avviso-incarichi-est-secondo-semestre-2026", cd("tos-es2.pdf")), es=True)
    tos_es1 = parse_toscana.parse(fetch(base + "/documents/d/guest/avviso-incarichi-est-primo-semestre-2026", cd("tos-es1.pdf")), es=True)
    toscana = {
        "slug": "toscana", "nome": "Toscana", "ente": "Regione Toscana - Settore Risorse umane SSR, Formazione, Relazioni sindacali",
        "paginaUfficiale": base + "/it/sst/procedure/opportunita-e-scadenze", "bollettinoNome": "BURT",
        "ultimoAggiornamentoFonte": "2026-11-04",
        "note": ["In Toscana gli avvisi sono 3 aziende USL (Toscana Centro, Nord Ovest, Sud Est). Per l'emergenza territoriale l'avviso pubblica il totale per azienda, senza ambiti. Le domande in bollo si inviano via PEC."],
        "esclusi": ["Graduatorie regionali, punteggi e assegnazioni: non pubblicati (dati personali)."],
        "pubblicazioni": [
            pub("tos-pls-2026-11", "pls", "Avviso per l'assistenza pediatrica 2026 - seconda pubblicazione", "seconda pubblicazione 2026", "2026-11-04", "BURT n. 44 del 04/11/2026 (parte terza)", "2026-11-24", False, base + "/-/avviso-per-assistenza-pediatrica-2026-seconda-pubblicazione", base + "/documents/d/guest/avviso-seconda-pubblicazione-2026-ambiti-territoriali-carenti-pediatria", None, tos_pls2, True),
            pub("tos-ru-2026-09", "ruolo-unico", "Avviso per medici del ruolo unico di assistenza primaria - anno 2026", "pubblicazione 2026", "2026-09-23", "BURT n. 38 del 23/09/2026 (parte terza)", "2026-10-13", False, base + "/-/avviso-per-medici-del-ruolo-unico-di-assistenza-primaria-anno-2026", base + "/documents/d/guest/avviso-incarichi-vacanti-ruolo-unico-assistenza-primaria_-2026", None, tos_ru, True),
            pub("tos-es-2026-10", "emergenza-territoriale", "Incarichi vacanti di emergenza sanitaria territoriale - secondo semestre 2026", "2° semestre 2026", "2026-10-28", "BURT n. 43 del 28/10/2026 (parte terza)", "2026-11-17", False, base + "/-/incarichi-vacanti-di-emergenza-sanitaria-territoriale-secondo-semestre-2026", base + "/documents/d/guest/avviso-incarichi-est-secondo-semestre-2026", None, tos_es2, True),
            pub("tos-pls-2026-04", "pls", "Pubblicazione ambiti territoriali carenti assistenza pediatrica 2026", "prima pubblicazione 2026", "2026-04-29", "BURT n. 17 del 29/04/2026 (parte terza)", "2026-05-19", False, base + "/-/pubblicazione-ambiti-territoriali-carenti-assistenza-pediatrica-2026", base + "/documents/d/guest/avviso-ambiti-territoriali-carenti-pls_2026", None, tos_pls1, False),
            pub("tos-es-2026-04", "emergenza-territoriale", "Incarichi vacanti di emergenza sanitaria territoriale - primo semestre 2026", "1° semestre 2026", "2026-04-22", "BURT n. 16 del 22/04/2026 (parte terza)", "2026-05-12", False, base + "/-/incarichi-vacanti-di-emergenza-sanitaria-territoriale-primo-semestre-2026", base + "/documents/d/guest/avviso-incarichi-est-primo-semestre-2026", None, tos_es1, False),
        ],
    }

    # ---------------- Lombardia ----------------
    lo = fetch("https://omceomi.it/wp-content/uploads/2026/10/Pubblicazione-incarichi-vacanti-per-medici-ruolo-unico-assistenza-primaria-e-pls-DIREZIONE-GENERALE-WELFARE-BURL-28.10.2026-1.pdf", cd("lom-ott.pdf"))
    lm = fetch("https://omceomi.it/wp-content/uploads/2026/04/Pubblicazione-incarichi-vacanti-per-medici-di-ruolo-unico-di-assistenza-primaria-e-per-pls-COMUNICATO-GIUNTA-REGIONALE-24.3.2026.pdf", cd("lom-mar.pdf"))
    ro, go, wo = parse_lombardia.parse(lo)
    rm, gm, wm = parse_lombardia.parse(lm)
    page_lo = "https://www.regione.lombardia.it/sanita/personale-sanitario-e-sociosanitario/concorsi-e-avvisi-presso-enti-sanitari/pubblicazione-ambiti-carenti-di-assistenza-primaria-a-ciclo-di-scelta-e-pediatria-e-ore-vacanti-di-assistenza-primaria-ad-attivit--oraria-e-di-emergenza-territoriale"
    burl = "https://www.regione.lombardia.it/burl-bollettino-ufficiale-regione-lombardia"
    cp_note = "Il PDF è la copia del comunicato pubblicata dall'OMCeO di Milano; l'atto ufficiale è nel BURL."
    lombardia = {
        "slug": "lombardia", "nome": "Lombardia", "ente": "Regione Lombardia - Direzione Generale Welfare",
        "paginaUfficiale": page_lo, "bollettinoNome": "BURL",
        "ultimoAggiornamentoFonte": "2026-10-28",
        "note": ["In Lombardia gli incarichi sono ripartiti per ASST e le domande si presentano sulla piattaforma regionale Bandi e Servizi. Dal 2026 il ruolo unico comprende l'attività a ciclo di scelta e quella oraria (ex continuità assistenziale)."],
        "esclusi": [
            "Incarichi vacanti di emergenza sanitaria territoriale (118) 2026: la pagina regionale elenca solo i comunicati 2024; non trovato il comunicato 2026, quindi nessun dato.",
            "Graduatorie regionali e punteggi dei medici: non pubblicati (dati personali).",
        ],
        "pubblicazioni": [
            pub("lom-ru-2026-10", "ruolo-unico", "Incarichi vacanti per i medici del ruolo unico di assistenza primaria - ottobre 2026", "ottobre 2026", "2026-10-28", "BURL Serie Avvisi e Concorsi n. 44 del 28/10/2026, comunicato regionale n. 77 del 22/10/2026", "2026-11-17", False, page_lo, "https://omceomi.it/wp-content/uploads/2026/10/Pubblicazione-incarichi-vacanti-per-medici-ruolo-unico-assistenza-primaria-e-pls-DIREZIONE-GENERALE-WELFARE-BURL-28.10.2026-1.pdf", burl, ro["ru"], True, ufficiale=go.get("ru"), nota=cp_note + " Nel documento la somma delle righe di ASST Brianza supera di 1 il totale dichiarato."),
            pub("lom-pls-2026-10", "pls", "Incarichi vacanti per i pediatri di libera scelta - ottobre 2026", "ottobre 2026", "2026-10-28", "BURL Serie Avvisi e Concorsi n. 44 del 28/10/2026, comunicato regionale n. 77 del 22/10/2026", "2026-11-17", False, page_lo, "https://omceomi.it/wp-content/uploads/2026/10/Pubblicazione-incarichi-vacanti-per-medici-ruolo-unico-assistenza-primaria-e-pls-DIREZIONE-GENERALE-WELFARE-BURL-28.10.2026-1.pdf", burl, ro["pls"], True, ufficiale=go.get("pls"), nota=cp_note),
            pub("lom-ru-2026-03", "ruolo-unico", "Incarichi vacanti per i medici del ruolo unico di assistenza primaria - marzo 2026", "marzo 2026 (pubblicazione ordinaria)", "2026-04-01", "BURL Serie Avvisi e Concorsi n. 14 del 01/04/2026, comunicato regionale n. 27 del 24/03/2026", "2026-04-20", False, page_lo, "https://omceomi.it/wp-content/uploads/2026/04/Pubblicazione-incarichi-vacanti-per-medici-di-ruolo-unico-di-assistenza-primaria-e-per-pls-COMUNICATO-GIUNTA-REGIONALE-24.3.2026.pdf", burl, rm["ru"], False, ufficiale=gm.get("ru"), nota=cp_note),
            pub("lom-pls-2026-03", "pls", "Incarichi vacanti per i pediatri di libera scelta - marzo 2026", "marzo 2026 (pubblicazione ordinaria)", "2026-04-01", "BURL Serie Avvisi e Concorsi n. 14 del 01/04/2026, comunicato regionale n. 27 del 24/03/2026", "2026-04-20", False, page_lo, "https://omceomi.it/wp-content/uploads/2026/04/Pubblicazione-incarichi-vacanti-per-medici-di-ruolo-unico-di-assistenza-primaria-e-per-pls-COMUNICATO-GIUNTA-REGIONALE-24.3.2026.pdf", burl, rm["pls"], False, ufficiale=gm.get("pls"), nota=cp_note),
        ],
    }
    avvisi = [("lombardia ott", wo), ("lombardia mar", wm)]

    for reg in (lombardia, piemonte, toscana, emilia_romagna := er):
        reg["generatoIl"] = datetime.date.today().isoformat()
        for p in reg["pubblicazioni"]:
            assert p["totalePosti"] > 0, (reg["slug"], p["id"])
        with open(os.path.join(out, reg["slug"] + ".json"), "w", encoding="utf-8") as f:
            json.dump(reg, f, ensure_ascii=False, indent=1)
        print(reg["slug"], [(p["id"], p["totalePosti"], len(p["perAsl"])) for p in reg["pubblicazioni"]])
    for n, w in avvisi:
        if w:
            print("AVVISO controllo", n, w)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default="/tmp/zc-cache")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    build(a.cache, a.out)
