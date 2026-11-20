"""Parser dell'Allegato A (tabella con righe) della D.D. Regione Piemonte n. 349/2026 (BU n. 23 dell'11/06/2026).

Richiede pdfplumber. Colonne: ASL (cella unita, etichetta in alto) | ambito carente | comuni/zona con apertura obbligatoria | posti.
L'ASL di ogni riga e' l'ultima etichetta di colonna 0 che compare sopra (o alla stessa altezza) della riga.
"""
import re

ASL_NAMES = {
    "CITTA DI TORINO": "ASL Città di Torino", "TO3": "ASL TO3", "TO4": "ASL TO4", "TO5": "ASL TO5",
    "BI": "ASL BI (Biella)", "NO": "ASL NO (Novara)", "VC": "ASL VC (Vercelli)", "VCO": "ASL VCO (Verbano-Cusio-Ossola)",
    "CN1": "ASL CN1 (Cuneo)", "CN2": "ASL CN2 (Alba-Bra)", "AT": "ASL AT (Asti)", "AL": "ASL AL (Alessandria)",
}


def parse(pdf_path):
    import pdfplumber
    out = []
    cur = "ASL Città di Torino"
    with pdfplumber.open(pdf_path) as pdf:
        for p in pdf.pages:
            txt = p.extract_text() or ""
            if "AMBITO TERRITORIALE CARENTE" not in txt:
                continue
            labels = []
            for w in p.extract_words():
                if w["x1"] < 68 and w["top"] > 140:
                    labels.append((w["top"], w["text"]))
            # unisci "Città di Torino"
            lab = []
            for top, t in labels:
                key = t.upper()
                if key in ASL_NAMES:
                    lab.append((top, ASL_NAMES[key]))
                elif key == "TORINO":
                    lab.append((top - 10, ASL_NAMES["CITTA DI TORINO"]))
            for tb in p.find_tables():
                for row in tb.rows:
                    pass
                data = tb.extract()
                for r, rowobj in zip(data, tb.rows):
                    if not r or len(r) < 4 or (r[0] or "").startswith("A.S.L.") or not (r[3] or "").strip().isdigit():
                        continue
                    top = rowobj.bbox[1]
                    for ltop, name in sorted(lab):
                        if ltop <= top + 3:
                            cur = name
                    out.append({
                        "asl": cur,
                        "ambito": re.sub(r"\s+", " ", (r[1] or "").replace("\n", " ")).strip(),
                        "posti": int(r[3].strip()),
                        "note": re.sub(r"\s+", " ", (r[2] or "").replace("\n", " ")).strip(),
                    })
    return out


if __name__ == "__main__":
    import sys, collections
    rows = parse(sys.argv[1])
    c = collections.Counter()
    for r in rows:
        c[r["asl"]] += r["posti"]
    print(len(rows), sum(c.values()))
    for k, v in c.items():
        print(" ", k, v)
    for r in rows[:3] + rows[-3:]:
        print(r)
