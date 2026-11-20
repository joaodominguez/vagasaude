"""Parser dei Comunicati di Giunta regionale (BURL, Serie Avvisi e Concorsi) con gli incarichi vacanti
del ruolo unico di assistenza primaria e dei pediatri di libera scelta, per ASST. Richiede pdfplumber.
Righe: ASST | ambito | posti | vincoli di apertura. Le righe "Totale" servono a verificare la somma per ASST.
"""
import re
import collections


def _clean(s):
    return re.sub(r"\s+", " ", (s or "").replace("\n", " ")).strip()


def _key(s):
    return re.sub(r"[^A-Z0-9]", "", s.upper())


NAMES = {  # chiave normalizzata -> nome
    "VALLEOLONA": "Valle Olona", "MELEGNANOMARTESANA": "Melegnano e della Martesana", "MILANOFBFSACCO": "Fatebenefratelli-Sacco",
    "MILANONIGUARDA": "Niguarda", "MILANOSANTIPAOLOCARLO": "Santi Paolo e Carlo", "PAPAGIOVANNIXXIII": "Papa Giovanni XXIII",
    "VALTELLINAALTOLARIO": "Valtellina e Alto Lario", "SPEDALICIVILI": "Spedali Civili di Brescia", "NORDMILANO": "Nord Milano",
    "OVESTMILANESE": "Ovest Milanese", "SETTELAGHI": "Sette Laghi", "BERGAMOEST": "Bergamo Est", "BERGAMOOVEST": "Bergamo Ovest",
}


def _asst(s):
    s = _clean(s)
    k = _key(s)
    return "ASST " + NAMES.get(k, s.title())


def parse(pdf_path):
    import pdfplumber
    rows = {"ru": [], "pls": []}
    decl = {"ru": collections.Counter(), "pls": collections.Counter()}
    grand = {}
    sec, last = None, None
    with pdfplumber.open(pdf_path) as pdf:
        for p in pdf.pages:
            t = p.extract_text() or ""
            if re.search(r"(INCARICHI VACANTI DI ASSISTENZA PRIMARIA|Medici ruolo unico)", t, re.I):
                sec = "ru"
            if re.search(r"(Incarichi vacanti Pediatria di libera scelta|Pediatria di libera scelta - )", t, re.I):
                sec = "pls"
            if sec is not None and "SEDI DI CONVOCAZIONE" in t.upper():
                break
            if sec is None:
                continue
            for tb in p.find_tables():
                for r in tb.extract():
                    if not r or len(r) < 3:
                        continue
                    a, amb, n = _clean(r[0]), _clean(r[1]), _clean(r[2]).replace(".", "")
                    if not n.isdigit() or a.upper() == "ASST":
                        continue
                    n = int(n)
                    if "complessivo" in (a + amb).lower():
                        grand[sec] = n
                        continue
                    m = re.match(r"(.+?)\s+Totale$", a, re.I)
                    if m:
                        decl[sec][_asst(m.group(1))] = n
                        continue
                    if a.upper() == "TOTALE":
                        if last:
                            decl[sec][last] = n
                        continue
                    if a == "":
                        a_name = last
                    else:
                        a_name = _asst(a)
                        last = a_name
                    if not amb or n == 0 or not a_name:
                        continue
                    rows[sec].append({"asl": a_name, "ambito": amb, "posti": n, "note": _clean(r[3]) if len(r) > 3 else ""})
    # verifica per ASST contro i totali dichiarati dal documento
    warn = []
    for sec in rows:
        c = collections.Counter()
        for r in rows[sec]:
            c[r["asl"]] += r["posti"]
        tot = sum(c.values())
        for a, n in list(decl[sec].items()):
            if n == tot and c.get(a, 0) != n and sec not in grand:
                grand[sec] = n  # riga finale "Totale" dell'intera tabella, non di un'ASST
                del decl[sec][a]
                continue
            if n and c.get(a, 0) != n:
                warn.append(f"{sec} {a}: righe={c.get(a, 0)} dichiarato={n}")
        # Valle Olona: il documento ha un solo totale "VALLEOLONA Totale"
    return rows, grand, warn


if __name__ == "__main__":
    import sys
    rows, grand, warn = parse(sys.argv[1])
    for k, r in rows.items():
        print(k, len(r), sum(x["posti"] for x in r), "complessivo dichiarato:", grand.get(k))
    print("avvisi:", warn)
