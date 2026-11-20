"""Parser degli avvisi PDF della Regione Toscana (BURT parte III): ruolo unico, PLS, ES 118.

Richiede pdfplumber. Tabelle con righe: ambito | posti | vincolo di zona, raggruppate per "AZIENDA USL TOSCANA ...".
Per l'ES (118) l'avviso pubblica solo il totale per Azienda (nessun ambito).
"""
import re


def _clean(s):
    return re.sub(r"\s+", " ", (s or "").replace("\n", " ")).strip()


def _asl(s):
    s = _clean(s)
    m = re.match(r"AZIENDA USL (TOSCANA )?(.+)", s, re.I)
    return ("AUSL Toscana " + m.group(2).title()) if m else None


def parse(pdf_path, es=False):
    import pdfplumber
    out, cur, seen = [], None, False
    with pdfplumber.open(pdf_path) as pdf:
        for p in pdf.pages:
            got = 0
            for tb in p.find_tables():
                for r in tb.extract():
                    if not r:
                        continue
                    a = _asl(r[0]) if r[0] else None
                    if es:
                        if a and len(r) >= 2 and _clean(r[1]).isdigit():
                            out.append({"asl": a, "ambito": "Intero territorio aziendale", "posti": int(_clean(r[1])), "note": ""})
                            got += 1
                        continue
                    if a and not (len(r) > 1 and _clean(r[1]).isdigit()):
                        cur = a
                        continue
                    if len(r) >= 3 and cur and _clean(r[1]).isdigit() and _clean(r[0]) and not _clean(r[0]).upper().startswith("AMBITO"):
                        out.append({"asl": cur, "ambito": _clean(r[0]), "posti": int(_clean(r[1])), "note": _clean(r[2])})
                        got += 1
            if seen and got == 0:
                break
            seen = seen or got > 0
    return out


if __name__ == "__main__":
    import sys, collections
    rows = parse(sys.argv[1], es=len(sys.argv) > 2)
    c = collections.Counter()
    for r in rows:
        c[r["asl"]] += r["posti"]
    print(len(rows), sum(c.values()), dict(c))
    for r in rows[:2] + rows[-2:]:
        print(r)
