"""Parser dei PDF del BURERT (Emilia-Romagna): incarichi vacanti ruolo unico / ES 118 / PLS.

Il PDF e' testo vero (non scansione). Struttura: "Azienda USL ..." > "Distretto/Area/Ambito ..." >
voci "- 5001   28" con nota facoltativa nella riga seguente. Il codice numerico dell'incarico non si pubblica.
Solo ambiti e numeri di posti: nessun dato personale presente nel documento.
"""
import re
import subprocess

SKIP = re.compile(r"BOLLETTINO UFFICIALE|^\s*(Ruolo Unico di Assistenza primaria|Emergenza sanitaria territoriale|Pediatria di Libera Scelta)\s*$|^\s*\d+\s*$|Numero (incarichi|ambiti)", re.I)


def pdf_text(path):
    return subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True, text=True, check=True).stdout


def title_asl(s):
    s = re.sub(r"\s+", " ", s.strip())
    s = re.sub(r"^azienda usl", "AUSL", s, flags=re.I)
    s = s.replace("DELLA ROMAGNA - DIPARTIMENTO DI", "della Romagna - Dipartimento di")
    s = re.sub(r"^AUSL di ", "AUSL ", s)
    return s.replace("AUSL DELLA", "AUSL della").replace("FORLI'-CESENA", "Forli'-Cesena").replace("RAVENNA", "Ravenna").replace("RIMINI", "Rimini")


def parse_section(text, start_pat, nth=0, end_pat=r"^\s*Allegato B\s*$"):
    lines = text.splitlines()
    i0 = [i for i, l in enumerate(lines) if re.search(start_pat, l)][nth]
    out, asl, ctx, ambito = [], None, "", ""
    last = None
    collecting_ambito = False
    for l in lines[i0 + 1:]:
        if re.search(end_pat, l):
            break
        if SKIP.search(l):
            continue
        s = l.strip()
        if not s:
            collecting_ambito = False
            continue
        m = re.match(r"^Azienda USL.*", s, re.I)
        if m and not re.match(r"^-", s):
            asl = title_asl(s)
            ctx, ambito, last = "", "", None
            continue
        m = re.match(r"^-\s+\d+\s+(\d+)\s*$", s)
        if m:
            last = {"asl": asl, "ambito": (ctx + (" - " + ambito if ambito else "")).strip(" -"), "posti": int(m.group(1)), "note": ""}
            out.append(last)
            collecting_ambito = False
            continue
        m = re.match(r"^Ambito territoriale:\s*(.*)", s)
        if m:
            ambito = m.group(1)
            collecting_ambito = True
            last = None
            continue
        if collecting_ambito:
            ambito += " " + s
            continue
        if re.match(r"^(Distretto|Area|Ambito)\b", s, re.I):
            ctx, ambito, last = s, "", None
            continue
        if last is not None:
            last["note"] = (last["note"] + " " + s).strip()
    for e in out:
        e["ambito"] = re.sub(r"\s+", " ", e["ambito"]).strip() or "Intero territorio aziendale"
        e["note"] = re.sub(r"\s+", " ", e["note"]).strip()
    # aggrega righe con stesso (asl, ambito)
    agg = {}
    for e in out:
        k = (e["asl"], e["ambito"])
        if k in agg:
            agg[k]["posti"] += e["posti"]
            if e["note"] and e["note"] not in agg[k]["note"]:
                agg[k]["note"] = (agg[k]["note"] + " | " + e["note"]).strip(" |")
        else:
            agg[k] = dict(e)
    return list(agg.values())


if __name__ == "__main__":
    import sys, json
    t = pdf_text(sys.argv[1])
    for spec in sys.argv[2:]:
        pat, nth = spec.split("#")
        r = parse_section(t, pat, int(nth))
        print(pat, len(r), sum(x["posti"] for x in r))
        for x in r[:6]:
            print("  ", x)
