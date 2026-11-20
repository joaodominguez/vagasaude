#!/usr/bin/env python3
"""Health check delle zone carenti: avvisa quando una Regione pubblica un nuovo elenco (o la pagina cambia struttura).

I dati veri sono nel dataset versionato (apps/web-it/src/data/zone-carenti/*.json, generato da build_dataset.py dopo
verifica umana dei PDF). Questo script NON modifica il sito: apre le pagine ufficiali (1 richiesta per pagina, UA identificato,
rispettando robots.txt delle pagine usate), estrae i riferimenti alle pubblicazioni e li confronta con quelli gia' incorporati.

Uso (run-scrapers.sh, al massimo una volta ogni 20 h):
    python3 zone_carenti/watch.py /var/www/offertesanita/data
Esce 0 sempre; stampa e (se Resend configurato) manda email interna solo quando l'insieme dei segnali cambia.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

UA = "Mozilla/5.0 (compatible; OffertesanitaBot/1.0; +https://offertesanita.it)"

# Riferimenti gia' incorporati nel dataset (stato al 2026-11-20). Un riferimento nuovo = nuova pubblicazione da verificare.
WATCH = {
    "toscana": {
        "url": "https://www.regione.toscana.it/it/sst/procedure/opportunita-e-scadenze",
        "pattern": r'href="https://www\.regione\.toscana\.it/-/([a-z0-9-]*(?:ambiti|incarichi|ruolo-unico|assistenza-pediatrica|emergenza)[a-z0-9-]*2026[a-z0-9-]*)',
        "known": [
            "avviso-per-medici-del-ruolo-unico-di-assistenza-primaria-anno-2026",
            "avviso-per-assistenza-pediatrica-2026-seconda-pubblicazione",
            "pubblicazione-ambiti-territoriali-carenti-assistenza-pediatrica-2026",
            "incarichi-vacanti-di-emergenza-sanitaria-territoriale-primo-semestre-2026",
            "incarichi-vacanti-di-emergenza-sanitaria-territoriale-secondo-semestre-2026",
        ],
    },
    "piemonte": {
        "url": "https://www.regione.piemonte.it/web/temi/sanita/organizzazione-strutture-sanitarie/incarichi-vacanti-ruolo-unico-assistenza-primaria",
        "pattern": r'href="https://www\.regione\.piemonte\.it/governo/bollettino/abbonati/(2026/\d+/siste/\d+)\.htm"[^>]*>\s*([^<]*vacanti[^<]*)',
        "known": ["2026/23/siste/00000035", "2026/38/siste/00000045", "2026/41/siste/00000044"],
        "group": 1,
    },
    "emilia-romagna": {
        "url": "https://salute.regione.emilia-romagna.it/ssr/carriera-e-formazione/medicina-convenzionata/incarichi-vacanti/avvisi-e-moduli",
        "pattern": r'href="https://bur\.regione\.emilia-romagna\.it/dettaglio-inserzione\?i=([0-9a-f]{32})"',
        "known": ["fb18d94306ab49f3abc460a835531692", "4c88022364dd4db384bc14ceefe8d625"],
    },
    "lombardia": {
        "url": "https://omceomi.it/medicina-generale-continuita-assistenziale-e-118/",
        "pattern": r'href="https://omceomi\.it/wp-content/uploads/(2026/\d\d/[^"]*(?:incarichi-vacanti|ambiti)[^"]*\.pdf)"',
        "known": [
            "2026/10/Pubblicazione-incarichi-vacanti-per-medici-ruolo-unico-assistenza-primaria-e-pls-DIREZIONE-GENERALE-WELFARE-BURL-28.10.2026-1.pdf",
            "2026/04/Pubblicazione-incarichi-vacanti-per-medici-di-ruolo-unico-di-assistenza-primaria-e-per-pls-COMUNICATO-GIUNTA-REGIONALE-24.3.2026.pdf",
        ],
    },
    "lazio": {
        "url": "https://www.regione.lazio.it/notizie/salute/Assegnazione-incarichi-vacanti-medico-ruolo-unico-assistenza-primaria",
        "pattern": r"(n\. \d+ suppl\. \d+, [^<]{0,40}determinazione n\. G\d+ del \d+ \w+ \d{4})",
        "known": ["n. 90 suppl. 1, è stata pubblicata la determinazione n. G15489 del 6 novembre 2026"],
    },
}


def extract(cfg: dict, html: str) -> set[str]:
    found = set()
    for m in re.finditer(cfg["pattern"], html):
        found.add(m.group(1).strip())
    return found


def send_email(subject: str, body: str) -> None:
    key, sender, to = os.environ.get("RESEND_API_KEY"), os.environ.get("EMAIL_FROM"), os.environ.get("ALERTS_TO")
    if not (key and sender and to):
        return
    httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {key}"},
        json={"from": sender, "to": [a.strip() for a in to.split(",") if a.strip()], "subject": subject, "text": body},
        timeout=30,
    ).raise_for_status()


def main() -> int:
    data_dir = Path(sys.argv[1])
    state_path = data_dir / "zone-carenti-watch.json"
    try:
        state = json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        state = {}
    now = time.time()
    if now - state.get("checkedAt", 0) < 20 * 3600 and "--force" not in sys.argv:
        print("[zone-carenti] controllo recente, salto")
        return 0
    signals: dict[str, str] = {}
    with httpx.Client(headers={"User-Agent": UA}, follow_redirects=True, timeout=45) as client:
        for region, cfg in WATCH.items():
            try:
                r = client.get(cfg["url"])
                r.raise_for_status()
            except httpx.HTTPError as exc:
                signals[f"{region}:errore"] = f"pagina non raggiungibile ({exc.__class__.__name__})"
                continue
            found = extract(cfg, r.text)
            known = set(cfg["known"])
            if not found and region != "lazio":
                signals[f"{region}:struttura"] = "nessun riferimento 2026 trovato: la pagina e' cambiata?"
            if region == "lazio" and not found:
                signals["lazio:struttura"] = "riferimento al BUR non trovato nella pagina"
            for ref in sorted(found - known):
                signals[f"{region}:nuovo:{ref}"] = f"nuova pubblicazione o riferimento non presente nel dataset: {ref}"
            time.sleep(3)
    for k, v in sorted(signals.items()):
        print(f"[zone-carenti] SEGNALE {k}: {v}")
    if not signals:
        print("[zone-carenti] nessuna novita': dataset allineato con le pagine ufficiali")
    previous = set(state.get("signals", []))
    current = set(signals)
    if current != previous and current:
        body = "Zone carenti: segnali da verificare (aggiornare il dataset con build_dataset.py e fare deploy):\n" + "\n".join(f"- {k}: {v}" for k, v in sorted(signals.items()))
        try:
            send_email("[Offerte Sanità] zone carenti: nuova pubblicazione da verificare", body)
        except httpx.HTTPError as exc:
            print(f"[zone-carenti] email fallita: {exc}")
    state_path.write_text(
        json.dumps({"checkedAt": now, "checkedAtIso": datetime.now(timezone.utc).isoformat(), "signals": sorted(current)}),
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
