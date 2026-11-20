"""Chiavi di dedupe delle fonti regionali (ARES Sardegna, ESTAR Toscana, ARCS FVG e os leitores de Lazio/Campania) per inPA e Gazzetta Ufficiale.

inPA e GU rileggono le chiavi di queste fonti (piu' ricche, dal sito dell'ente) e scartano i propri doppioni.
Una fonte in errore non blocca le altre. Gli elenchi sono letti una sola volta per processo (cache nei moduli).
"""
from __future__ import annotations

from datetime import datetime

from common.http import HttpClient

from . import aorn_colli, ares_sardegna, arcs_fvg, asl_napoli3sud, asl_roma1, asl_roma2, asl_roma3, asl_roma5, estar_toscana

MODULES = (ares_sardegna, estar_toscana, arcs_fvg, asl_roma1, asl_roma2, asl_roma3, asl_roma5, asl_napoli3sud, aorn_colli)


def priority_keys(client: HttpClient, now: datetime | None = None) -> list:
    keys: list = []
    for module in MODULES:
        try:
            keys.extend(module.priority_keys(client, now=now))
        except Exception:  # noqa: BLE001
            continue
    return keys
