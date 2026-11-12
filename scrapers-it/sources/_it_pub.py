"""Utilita' comuni dei lettori del settore PUBBLICO italiano (portale Veneto, inPA, Gazzetta Ufficiale S4).

- date italiane, numeri in lettere, filtri sanitari ed esclusione di atti che non sono bandi aperti;
- tipo di procedura (Concorso pubblico | Selezione pubblica | Avviso a tempo determinato | Mobilita' |
  Incarico libero-professionale): la PRIMA parola del titolo deve far classificare l'offerta in
  apps/web-it/src/lib/job-type.ts, quindi qui si costruiscono titoli "<Tipo> per <n> posti di <Profilo> – <Disciplina> — <Ente>";
- ente: nome proprio + sigla + regione/provincia;
- chiave di confronto (ente + profilo/disciplina + posti/scadenza) per non pubblicare due volte lo stesso bando
  quando compare in piu' fonti. Priorita': portale Veneto > inPA > Gazzetta Ufficiale.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

from common.models import JobPayload
from common.normalize import (
    PROVINCE_TO_REGION,
    REGIONS,
    SIGLA_TO_REGION,
    _PROVINCES,
    guess_district,
    guess_profession,
    norm,
)

# --- date --------------------------------------------------------------------------------------

MONTHS = {
    "gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4, "maggio": 5, "giugno": 6, "luglio": 7,
    "agosto": 8, "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12,
}
_DATE_RE = re.compile(r"(\d{1,2})\s+(" + "|".join(MONTHS) + r")\s+(\d{4})", re.I)
_DATE_NUM_RE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})")


def parse_it_date(text: str | None) -> date | None:
    """"3 Dicembre 2026", "07 Dicembre 2026  23:59", "03/12/2026" -> date."""
    if not text:
        return None
    m = _DATE_RE.search(text)
    if m:
        try:
            return date(int(m.group(3)), MONTHS[m.group(2).lower()], int(m.group(1)))
        except ValueError:
            return None
    m = _DATE_NUM_RE.search(text)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            return None
    return None


def end_of_day(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, 23, 59, tzinfo=timezone.utc)


def start_of_day(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


def fmt_date(d: date | None) -> str:
    if not d:
        return ""
    months = list(MONTHS)
    return f"{d.day} {months[d.month - 1]} {d.year}"


# --- numeri --------------------------------------------------------------------------------------

_UNITS = {"un": 1, "uno": 1, "una": 1, "due": 2, "tre": 3, "quattro": 4, "cinque": 5, "sei": 6, "sette": 7,
          "otto": 8, "nove": 9, "dieci": 10, "undici": 11, "dodici": 12, "tredici": 13, "quattordici": 14,
          "quindici": 15, "sedici": 16, "diciassette": 17, "diciotto": 18, "diciannove": 19}
_TENS = {"venti": 20, "trenta": 30, "quaranta": 40, "cinquanta": 50, "sessanta": 60, "settanta": 70,
         "ottanta": 80, "novanta": 90}


def it_number_word(word: str) -> int | None:
    w = norm(word).replace(" ", "")
    if w in _UNITS:
        return _UNITS[w]
    if w in _TENS:
        return _TENS[w]
    if w == "cento":
        return 100
    for tens, value in _TENS.items():
        stem = tens[:-1]  # "vent" + "uno"/"otto" (elisione: ventuno, ventotto)
        for prefix in (tens, stem):
            if w.startswith(prefix):
                rest = w[len(prefix):]
                if rest in _UNITS and _UNITS[rest] < 10:
                    return value + _UNITS[rest]
    m = re.fullmatch(r"(due|tre|quattro|cinque|sei|sette|otto|nove)?cento(?:([a-z]+))?", w)
    if m:
        hundreds = (_UNITS[m.group(1)] if m.group(1) else 1) * 100
        rest = it_number_word(m.group(2)) if m.group(2) else 0
        return hundreds + (rest or 0)
    return None


_NUM_WORDS = "|".join(sorted(list(_UNITS) + list(_TENS) + ["cento"], key=len, reverse=True))
_POSTI_RE = re.compile(
    r"(?:\bn\.?\s*(\d{1,4})\b|\b(\d{1,4})\b|\b((?:" + _NUM_WORDS + r")[a-z]*))\s*(?:\(\d+\)\s*)?post[oi]\b",
    re.I,
)


def posts_from(text: str) -> int | None:
    """Numero di posti dichiarato ("n. 15 posti", "un posto", "ventidue posti"); None se non indicato."""
    for m in _POSTI_RE.finditer(text or ""):
        if m.group(1) or m.group(2):
            return int(m.group(1) or m.group(2))
        value = it_number_word(m.group(3))
        if value:
            return value
    return None


# --- filtri sanitari ---------------------------------------------------------------------------

def _undot(text: str) -> str:
    return re.sub(r"\b([A-Za-z])\.(?=[A-Za-z]\.|\s|$)", r"\1", text).replace(".", "") if "." in text else text


HEALTH_ENTE_RE = re.compile(
    r"\b(asl|ausl|usl|ulss|asst|ats|ast|aou|aoui|ao|irccs|estar|ares|arcs|apss|sabes|asdaa|azienda zero|asrem|asur|"
    r"policlinico|ospedale|ospedali|ospedaliero|ospedaliera|ospedaliere|azienda sanitaria|azienda unita sanitaria|"
    r"unita sanitaria locale|unita locale socio sanitaria|azienda socio sanitaria|azienda usl|agenzia di tutela della salute|"
    r"istituto zooprofilattico|zooprofilattico|istituto ortopedico|istituto oncologico|istituto nazionale tumori|"
    r"istituto neurologico|istituti fisioterapici|ospedali riuniti|presidio ospedaliero|asp sanitaria|azienda sanitaria provinciale)\b",
    re.I,
)
# Enti che NON sono datori di lavoro sanitari (universita', enti di ricerca, ministeri) a meno di sigla sanitaria esplicita.
NON_HEALTH_ENTE_RE = re.compile(
    r"universit|politecnico|consiglio nazionale delle ricerche|\bcnr\b|ministero|scuola normale|accademia|conservatorio|"
    r"tribunale|prefettura|questura|\bcomune di\b|provincia di|citta metropolitana|camera di commercio",
    re.I,
)
HEALTH_PROFILE_RE = re.compile(
    r"dirigent[ei] medic|\bmedic[oi]\b|\bmedica\b|dirigent[ei] (farmacist|biolog|psicolog|veterinar|chimic|fisic|odontoiatr|delle professioni sanitarie)|"
    r"infermier|ostetric|operator[ei] socio ?sanitar|\boss\b|tecnic[oi] sanitari|tecnic[oi] (di|della|dell) (laboratorio|radiologia|neurofisio|prevenzione|riabilitazione|audio|fisiopatolog|emodialisi|anatomia)|"
    r"tecnic[oi] audiometrist|tecnic[oi] audioprotesist|fisioterapist|farmacist|veterinar|psicolog|biolog|logoped|dietist|podolog|"
    r"ortottist|igienist[ai] dental|odontoiatr|assistent[ei] sanitari|collaborator[ei] professional[ei] sanitari|"
    r"educator[ei] professional[ei] (socio ?sanitari|sanitari)|terapist[ai]|fisiatr|anestesi|chirurg|pediatr|cardiolog|radiolog|"
    r"puericultric|massofisioterap|perfusionist|tsrm",
    re.I,
)
ACADEMIC_RE = re.compile(
    r"ricercator|borsa di (studio|ricerca)|assegn[oi] di ricerca|professor[ei] (di|ordinari|associat)|docent|dottorato|"
    r"tenure track|\brtd\b|chiamata di un professore|\bcnr\b",
    re.I,
)
# Atti successivi o che non sono un bando aperto (graduatorie, esiti, diari, ammessi, rettifiche...).
NOT_OPEN_RE = re.compile(
    r"^(approvazione|esito|esiti|ammissione|diario|calendario|convocazion|elenco (degli )?(ammessi|candidati|idonei)|"
    r"nomina (della )?commissione|rettifica|errata|proroga|riapertura dei termini|sospensione|revoca|annullamento|"
    r"avviso di (convocazione|rettifica)|comunicazione|graduatoria (finale|definitiva|provvisoria|di merito)|"
    r"avviso (di )?(esito|ammissione)|scorrimento)|"
    r"diario delle prove|calendario (delle )?prove|elenco ammessi|esito (della )?(prova|selezione)|"
    r"approvazione (degli )?atti|graduatoria (finale|definitiva) (del|di)|ammessi (alla|al)",
    re.I,
)


ACADEMIC_ENTE_RE = re.compile(r"universit|politecnico|consiglio nazionale delle ricerche|\bcnr\b|\buni\b|accademia|conservatorio|scuola normale|scuola superiore", re.I)
# Avvisi che non sono offerte di lavoro (nomine in organismi, incarichi di ricerca...).
NOT_JOB_RE = re.compile(
    r"organismo indipendente di valutazione|\boiv\b|componenti (dell|del)|nucleo di valutazione|collegio sindacale|revisor[ei] (dei conti|legale)|"
    r"incarico di ricerca|art\.? ?22 ?(ter|l)|assegn[oi] di ricerca|borsa di (studio|ricerca)|manifestazione di interesse per (la )?(nomina|individuazione)",
    re.I,
)


_HEALTH_STRONG_RE = re.compile(r"\b(ospedalier\w*|ospedale|azienda sanitaria|ausl|asl|ulss|asst|ats|ast|aou|aoui|ao|irccs|policlinico)\b")


def is_academic_ente(ente: str) -> bool:
    plain = norm(_undot(ente))
    return bool(ACADEMIC_ENTE_RE.search(plain)) and not _HEALTH_STRONG_RE.search(plain)


def is_not_job(text: str) -> bool:
    return bool(NOT_JOB_RE.search(text or ""))


def is_health_ente(ente: str) -> bool:
    plain = norm(_undot(ente))
    if NON_HEALTH_ENTE_RE.search(plain) and not _HEALTH_STRONG_RE.search(plain):
        return False
    return bool(HEALTH_ENTE_RE.search(plain))


def is_health_profile(text: str) -> bool:
    return bool(HEALTH_PROFILE_RE.search(text or ""))


def is_not_open_call(text: str) -> bool:
    return bool(NOT_OPEN_RE.search(text.strip()))


# --- tipo di procedura ---------------------------------------------------------------------------

KIND_CONCORSO = "Concorso pubblico"
KIND_SELEZIONE = "Selezione pubblica"
KIND_TEMPO_DET = "Avviso a tempo determinato"
KIND_MOBILITA = "Mobilità"
KIND_INCARICO = "Incarico libero-professionale"
KINDS = (KIND_CONCORSO, KIND_SELEZIONE, KIND_TEMPO_DET, KIND_MOBILITA, KIND_INCARICO)

_MOBILITA_RE = re.compile(r"mobilit[aà]|passaggio diretto|trasferimento (volontario|tra aziende)", re.I)
_CONCORSO_RE = re.compile(r"\bconcors[oi]\b", re.I)
_INCARICO_RE = re.compile(
    r"libero[- ]professional|co\.?\s?co\.?\s?co|collaborazione coordinata|lavoro autonomo|prestazion[ei] (d['’ ]opera|occasional)|"
    r"incarico di collaborazione|contratto di consulenza",
    re.I,
)
_TEMPO_DET_RE = re.compile(r"tempo determinato|a termine|sostituzion|supplenz|incarico a tempo|incarichi a tempo|temporane", re.I)


def classify_kind(text: str) -> str:
    """Tipo di procedura dal testo ufficiale. L'ordine segue la priorita' di job-type.ts."""
    t = text
    if _MOBILITA_RE.search(t):
        return KIND_MOBILITA
    if _CONCORSO_RE.search(t):
        return KIND_CONCORSO
    if _INCARICO_RE.search(t):
        return KIND_INCARICO
    if _TEMPO_DET_RE.search(t):
        return KIND_TEMPO_DET
    return KIND_SELEZIONE


# --- profilo e disciplina ------------------------------------------------------------------------

_PROFILE_WORDS = (
    "dirigent|collaborator|infermier|ostetric|operator|tecnic|fisioterap|farmacist|medic|psicolog|biolog|"
    "veterinar|assistent|educator|logoped|dietist|podolog|ortottist|terapist|igienist|odontoiatr|coadiutor|"
    "direttor|ingegner|analist|programmator|ausiliar|puericult|fisico|chimic|statistic|sociolog|architett|"
    "geometr|avvocat|funzionari|istruttor|specialist|autist|cuoc|commess|perfusionist|massofisio|audio"
)
_PROFILE_START_RE = re.compile(r"\b(?:" + _PROFILE_WORDS + r")\w*", re.I)
_PROFILE_END_RE = re.compile(
    r"(?:[,;.(]|\s[-–—]\s|\so\s(?:di\s)?(?=(?:" + _PROFILE_WORDS + r")\w*)|\sconseguit|\sa tempo\b|\sper (?:le|il|la|l'|l’|i|gli|titoli|esami|soli|la copertura|conto|una|un)\b|\spresso\b|\sriservat|"
    r"\sda assegnar|\sarea\b|\scon\b|\sdisciplina\b|\sin (?:regime|autonomia|qualit|possesso)|\sdella (?:asl|aziend|u\.o|uoc|struttura|sc\b)|"
    r"\sdel (?:dipartimento|servizio|distretto|presidio)|\sappartenent|\scategoria\b|\sbanda\b|\sfascia\b|\sruolo\b|"
    r"\sdi cui\b|\sprofilo\b|\sdestinat|\sai sensi|\sdi livello|\sdella durata|\sdella\s+durata)",
    re.I,
)
_DISCIPLINE_RE = re.compile(
    r"\bdisciplin[ae]\b\s*(?:di|in|:)?\s*(?:[“\"«']\s*)?([^,.;(”\"»]+?)(?=\s*(?:[,.;(”\"»]|\sa tempo\b|\sper\s|\spresso\b|\sarea\b|\ssettore\b|\sin\s|\s-\s|\s–\s|$))",
    re.I,
)
_SMALL = {"negli", "nei", "nelle", "sul", "sulla", "sui", "tra", "fra", "di", "e", "del", "della", "delle", "dei", "degli", "dello", "dell", "in", "per", "a", "ed", "il", "la", "le", "lo", "da", "al", "alla", "nel", "nella", "con", "o"}


_ACCENT = {"a": "à", "e": "è", "i": "ì", "o": "ò", "u": "ù", "A": "À", "E": "È", "I": "Ì", "O": "Ò", "U": "Ù"}


def fix_accents(text: str) -> str:
    """La G.U. scrive gli accenti come apostrofi: "unita'", "sanita'", "Universita'" -> "unità", "sanità"."""
    return re.sub(r"(?<=[A-Za-z])([aeiouAEIOU])'(?=[\s,.;:)»\"]|$)", lambda m: _ACCENT[m.group(1)], text)


def nice_case(text: str) -> str:
    text = fix_accents(re.sub(r"\s+", " ", text.replace("’", "'"))).strip(" .,;:-–—")
    if not text:
        return text
    if text.isupper() or text.islower() or sum(1 for c in text if c.isupper()) > len(text) / 3:
        words = []
        for i, w in enumerate(text.lower().split(" ")):
            if "'" in w:
                head, _, tail = w.partition("'")
                w = head + "'" + (tail[:1].upper() + tail[1:] if tail else "")
                words.append(w if i else w[:1].upper() + w[1:])
            elif w in _SMALL and i:
                words.append(w)
            else:
                words.append("-".join(x[:1].upper() + x[1:] for x in w.split("-")))
        text = " ".join(words)
    return text[:1].upper() + text[1:]


def extract_discipline(text: str) -> str | None:
    m = _DISCIPLINE_RE.search(text or "")
    if not m:
        return None
    d = re.sub(r"\s+", " ", m.group(1)).strip(" .,;:-–—")
    if not d or len(d) > 90 or re.match(r"(?i)^(varie|vari|diverse|ed|e)\b", d):
        return None
    return nice_case(d)


def extract_profile(text: str) -> str | None:
    """Profilo professionale ("Dirigente Medico", "Infermiere", "Collaboratore Professionale Sanitario – Infermiere").

    Parte dalla prima parola di un profilo noto DOPO "posto/posti" (se presente), cosi' non prende "Direttore generale"
    dell'intestazione.
    """
    text = re.sub(r"\s+", " ", (text or "").replace("’", "'")).strip()
    m = re.search(r"profilo professionale\s*(?:di\s+)?[“\"«']?\s*([^”\"»',.;(]+)", text, re.I)
    if m:
        return nice_case(m.group(1))
    uoc = re.search(
        r"(?:direttore|direzione)\s+(?:medico\s+)?(?:di\s+|della\s+|dell['’]\s*)?(?:unit[aà]'?\s+operativa\s+complessa|struttura complessa|u\.?o\.?c\.?)\s*(?:di\s+)?"
        r"([^,.;(]+?)(?=,|\.|;|\(|\sdel\sdipartimento|\sdisciplin|\sarea\b|\sdella\sdurata|\sp\.o\.|$)", text, re.I)
    if uoc and len(uoc.group(1)) < 80:
        return "Direttore UOC " + nice_case(uoc.group(1))
    start_at = 0
    pm = re.search(r"\bpost[oi]\b", text, re.I)
    if pm:
        start_at = pm.end()
    sm = _PROFILE_START_RE.search(text, start_at) or _PROFILE_START_RE.search(text)
    if not sm:
        return None
    rest = text[sm.start():]
    em = _PROFILE_END_RE.search(rest, 3)
    snippet = rest[: em.start()] if em else rest
    # "Collaboratore Professionale Sanitario – Infermiere" / ", Infermiere": il profilo continua dopo il trattino.
    if re.match(r"(?i)collaborator[ei] professional[ei] sanitari[oi]?$", snippet.strip()) and em:
        tail = rest[em.end():]
        nm = re.match(r"\s*(?:[-–—,]\s*)?([A-Za-zÀ-ÿ' ]+?)(?=[,.;(]|\sa tempo\b|\sarea\b|\sper\b|$)", tail)
        if nm and re.search(r"infermier|ostetric|tecnic|fisioterap|dietist|logoped|educator|podolog|ortottist|terapist|igienist|assistent", nm.group(1), re.I):
            snippet = f"{snippet.strip()} – {nm.group(1).strip()}"
    # "Infermiere o di Operatore Socio Sanitario": due profili alternativi.
    if em:
        alt = re.match(r"\so\s(?:di\s)?((?:" + _PROFILE_WORDS + r")\w*[^,.;(]*?)(?=\sconseguit|\sper\s|\sa tempo\b|[,.;(]|$)", rest[em.start():], re.I)
        if alt and len(alt.group(1)) < 40:
            snippet = f"{snippet.strip()} o {alt.group(1).strip()}"
    snippet = snippet.strip(" ,;.-–—")
    if len(snippet) < 4 or len(snippet) > 90:
        return None
    return nice_case(snippet)


_STEM_STOP = {"di", "del", "della", "delle", "dei", "degli", "e", "ed", "in", "per", "a", "il", "la", "le", "lo", "dell", "d", "area", "settore",
              "disciplina", "disc", "posto", "posti", "tempo", "pieno", "indeterminato", "determinato", "n", "un", "una", "uno", "varie", "vari",
              "professionale", "sanitario", "sanitaria", "professionisti", "salute", "funzionari", "ruolo", "unita", "operativa", "complessa"}


def stems(text: str | None) -> frozenset[str]:
    out = set()
    for tok in norm(text or "").split():
        if tok in _STEM_STOP or tok.isdigit() or len(tok) < 3:
            continue
        out.add(tok[:5])
    return frozenset(out)


# --- ente --------------------------------------------------------------------------------------

def _ulss(m: "re.Match[str]") -> str:
    return f"ULSS {m.group(1)} {nice_case(m.group(2))}".strip()


def _asl_n(m: "re.Match[str]") -> str:
    return f"ASL {m.group(1)} {nice_case(m.group(2))}".strip()


_ENTE_SHORT = [
    (re.compile(r"^azienda (?:unit[aà]'? )?locale socio[- ]?sanitaria n\.?\s*(\d+)\s*([A-Za-zÀ-ÿ' ]*)", re.I), _ulss),
    (re.compile(r"^azienda ulss n\.?\s*(\d+)\s*([A-Za-zÀ-ÿ' ]*)", re.I), _ulss),
    (re.compile(r"^ulss n?\.?\s*(\d+)\s*([A-Za-zÀ-ÿ' ]*)", re.I), _ulss),
    (re.compile(r"^azienda (?:unit[aà]'? sanitaria locale|sanitaria locale) n\.?\s*(\d+)\s*(?:di |del |della )?([A-Za-zÀ-ÿ' ]*)", re.I), _asl_n),
    (re.compile(r"^azienda socio[- ]?sanitaria territoriale\s*(?:della |dei |di |del )?", re.I), "ASST "),
    (re.compile(r"^azienda sanitaria territoriale\s*(?:di |del |della )?", re.I), "AST "),
    (re.compile(r"^azienda usl\s*(?:della |di |del )?", re.I), "AUSL "),
    (re.compile(r"^azienda (?:unit[aà]'? sanitaria locale|sanitaria locale)\s*(?:della |di |del )?", re.I), "ASL "),
    (re.compile(r"^azienda ospedaliero[- ]universitaria integrata\s*(?:di |del )?", re.I), "AOUI "),
    (re.compile(r"^azienda ospedaliero[- ]universitaria\s*", re.I), "AOU "),
    (re.compile(r"^azienda ospedaliera di rilievo nazionale\s*", re.I), "AORN "),
    (re.compile(r"^azienda ospedaliera\s*", re.I), "AO "),
    (re.compile(r"^agenzia di tutela della salute\s*(?:della |di |del )?", re.I), "ATS "),
    (re.compile(r"^fondazione irccs\s*", re.I), "IRCCS "),
]
_ACRONYM_FIX = re.compile(r"^(ASST|AST|AUSL|ASL|AOUI|AOU|AORN|AO|ATS|IRCCS)\s+(.*)$")


_ACRONYMS = ("ASL", "ASST", "AUSL", "ULSS", "IRCCS", "ESTAR", "AOU", "AOUI", "AORN", "ATS", "ARES", "ARCS", "APSS", "USL", "AO", "AST", "ASP", "IZS", "AUSS", "ASUGI", "ASUFC", "ASFO", "ASUIT", "SABES")


def _fix_acronyms(text: str) -> str:
    for a in _ACRONYMS:
        text = re.sub(rf"\b{a}\b", a, text, flags=re.I)
    return text


def short_ente(name: str) -> str:
    """"AZIENDA SOCIO SANITARIA TERRITORIALE DI CREMONA" -> "ASST Cremona"; "Azienda ULSS n. 6 Euganea" -> "ULSS 6 Euganea"."""
    raw = re.sub(r"\s+", " ", name.replace("’", "'").replace("«", "").replace("»", "").replace("“", "").replace("”", "")).strip()
    raw = re.sub(r"^A\.?\s?O\.?\s+(?=Universitaria|Ospedale)", "Azienda Ospedaliera ", raw, flags=re.I)
    for rx, repl in _ENTE_SHORT:
        m = rx.match(raw)
        if m:
            out = repl(m) if callable(repl) else repl + raw[m.end():]
            out = re.sub(r"\s+", " ", out).strip()
            head = _ACRONYM_FIX.match(out)
            if head:
                out = head.group(1) + " " + nice_case(head.group(2))
            return _fix_acronyms(out)[:60]
    return _fix_acronyms(nice_case(raw))[:60]


def nice_ente(name: str) -> str:
    """Nome ufficiale leggibile (maiuscole normalizzate, senza virgolette editoriali)."""
    raw = re.sub(r"\s+", " ", name.replace("’", "'")).strip()
    raw = raw.replace("«", "").replace("»", "").replace("“", "").replace("”", "")
    raw = nice_case(raw)
    raw = re.sub(r"\bN\.", "n.", raw)
    return _fix_acronyms(raw)[:120]


_ENTE_TYPE_MAP = [
    (re.compile(r"azienda zero"), "azero"),
    (re.compile(r"\bestar\b"), "estar"),
    (re.compile(r"\bulss\b|unita locale socio sanitaria"), "ulss"),
    (re.compile(r"azienda socio sanitaria territoriale|\basst\b"), "asst"),
    (re.compile(r"azienda sanitaria territoriale|\bast\b"), "ast"),
    (re.compile(r"agenzia di tutela della salute|\bats\b"), "ats"),
    (re.compile(r"azienda ospedaliero universitaria|azienda ospedale universita|\baoui?\b|a o universitaria|\bpoliclinico\b"), "aou"),
    (re.compile(r"azienda ospedaliera|\bao\b|azienda ospedale"), "ao"),
    (re.compile(r"unita sanitaria locale|azienda usl|\bausl\b|\busl\b|\basl\b|azienda sanitaria locale|azienda sanitaria provinciale|\basp\b"), "asl"),
    (re.compile(r"\birccs\b|istituto di ricovero"), "irccs"),
]
_ENTE_STOP = {"azienda", "aziende", "unita", "locale", "socio", "sanitaria", "sanitario", "territoriale", "ospedaliero", "ospedaliera", "universitaria",
              "universita", "di", "del", "della", "dei", "degli", "delle", "e", "ed", "il", "la", "le", "lo", "n", "ulss", "asl", "ausl", "usl", "asst", "ast",
              "ats", "aou", "aoui", "ao", "irccs", "estar", "azero", "zero", "fondazione", "istituto", "ospedale", "ospedali", "riuniti", "agenzia",
              "tutela", "salute", "regione", "provinciale", "rilievo", "nazionale", "aorn", "presidio", "dipartimento", "area", "vasta", "centro", "ordine",
              "scientifico", "ricovero", "cura", "carattere", "pubblico", "di", "dell", "d", "al", "alla"}


@dataclass(frozen=True)
class EnteKey:
    kind: str | None
    numbers: frozenset[str]
    names: frozenset[str]


def ente_key(name: str) -> EnteKey:
    plain = norm(_undot(name))
    plain = re.sub(r"\bn\s+(\d)", r"\1", plain)
    kind = None
    for rx, k in _ENTE_TYPE_MAP:
        if rx.search(plain):
            kind = k
            break
    numbers = frozenset(re.findall(r"\b\d{1,2}\b", plain))
    names = frozenset(t for t in plain.split() if t not in _ENTE_STOP and not t.isdigit() and len(t) > 2)
    return EnteKey(kind, numbers, names)


def ente_match(a: EnteKey, b: EnteKey) -> bool:
    if a.kind and b.kind and a.kind != b.kind:
        # AOU/AO/IRCCS/ASL sono usati in modo intercambiabile nei bandi: stesso toponimo = stessa azienda.
        if not (a.names and b.names and (a.names <= b.names or b.names <= a.names) and len(a.names & b.names) >= 2):
            return False
    if a.numbers and b.numbers and a.numbers != b.numbers:
        return False
    if a.kind == "ulss" or b.kind == "ulss":
        if a.numbers and b.numbers:
            return True
    if not a.names or not b.names:
        return bool(a.kind and a.kind == b.kind and a.numbers and a.numbers == b.numbers)
    inter = a.names & b.names
    return bool(inter) and (a.names <= b.names or b.names <= a.names or len(inter) / min(len(a.names), len(b.names)) >= 0.5)


# --- chiave del bando (dedupe tra fonti) ---------------------------------------------------------

@dataclass
class CallKey:
    entes: list[EnteKey]
    prof: frozenset[str]
    disc: frozenset[str]
    posts: set[int] = field(default_factory=set)  # posti totali dichiarati
    deadline: date | None = None
    ente_posts: list[int | None] = field(default_factory=list)  # posti per ente (bandi aggregati), parallelo a `entes`


def make_key(
    entes: list[str], profile: str | None, discipline: str | None, posts: list[int | None], deadline: date | None,
    ente_posts: list[int | None] | None = None,
) -> CallKey:
    return CallKey(
        entes=[ente_key(e) for e in entes],
        prof=stems(profile),
        disc=stems(discipline),
        posts={p for p in posts if p},
        deadline=deadline,
        ente_posts=list(ente_posts) if ente_posts is not None else [None] * len(entes),
    )


def keys_match(a: CallKey, b: CallKey) -> bool:
    """Stesso bando? ente + profilo/disciplina + (posti e/o scadenza)."""
    pairs = [(i, j) for i, x in enumerate(a.entes) for j, y in enumerate(b.entes) if ente_match(x, y)]
    if not pairs:
        return False
    if not a.prof or not b.prof or len(a.prof & b.prof) / min(len(a.prof), len(b.prof)) < 0.6:
        return False
    disc_known = bool(a.disc and b.disc)
    if disc_known and not (a.disc & b.disc):
        return False
    deadline_eq = bool(a.deadline and b.deadline and a.deadline == b.deadline)
    posts_eq = bool(a.posts & b.posts)
    if not posts_eq:
        # bando aggregato (portale Veneto): l'altra fonte puo' riportare i posti di UN solo ente.
        for i, j in pairs:
            ai = a.ente_posts[i] if i < len(a.ente_posts) else None
            bj = b.ente_posts[j] if j < len(b.ente_posts) else None
            if (ai and ai in b.posts) or (bj and bj in a.posts) or (ai and bj and ai == bj):
                posts_eq = True
                break
    if disc_known:
        return deadline_eq or posts_eq
    # disciplina assente da un lato: servono entrambe le conferme (o la sola scadenza se i posti mancano).
    if (a.posts or any(a.ente_posts)) and (b.posts or any(b.ente_posts)):
        return deadline_eq and posts_eq
    return deadline_eq


@dataclass
class Call:
    """Bando letto da una fonte: payload gia' pronto + chiave per il confronto."""
    job: JobPayload
    key: CallKey


def drop_duplicates(calls: list[Call], higher: list[CallKey]) -> tuple[list[Call], list[Call]]:
    """(tenuti, scartati): scarta i bandi che corrispondono a uno di `higher` (fonti piu' ricche)."""
    kept, dropped = [], []
    for call in calls:
        (dropped if any(keys_match(call.key, h) for h in higher) else kept).append(call)
    return kept, dropped


# --- titolo e luogo ------------------------------------------------------------------------------

def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(" ,;:-–")
    return cut + "…"


def build_title(kind: str, profile: str | None, discipline: str | None, ente_short: str, posts: int | None) -> str:
    """"Concorso pubblico per 3 posti di Dirigente Medico – Cardiologia — ULSS 6 Euganea"."""
    if profile:
        who = profile
        if posts:
            who = f"{posts} post{'o' if posts == 1 else 'i'} di {profile}"
        if discipline and norm(discipline) not in norm(profile):
            who += f" – {discipline}"
        body = f"{kind} per {who}"
    else:
        body = kind
    return f"{_truncate(body, 120)} — {ente_short}"


def province_label(sigla: str) -> str | None:
    for items in _PROVINCES.values():
        for item in items:
            name, sg = item.split("|")
            if sg == sigla:
                return name
    return None


def location_from_text(*texts: str | None) -> tuple[str, str | None]:
    """(regione, provincia/citta' o None) dai testi dell'ente. Regione "Italia" se non riconosciuta."""
    blob = " ".join(t for t in texts if t)
    for sig in re.findall(r"\(([A-Z]{2})\)", blob):
        if sig in SIGLA_TO_REGION:
            return SIGLA_TO_REGION[sig], province_label(sig)
    region = guess_district(blob)
    if region not in REGIONS:
        return "Italia", None
    # citta'/provincia: la voce piu' lunga trovata nel testo
    key = norm(blob)
    best = None
    for prov in sorted(PROVINCE_TO_REGION, key=len, reverse=True):
        if PROVINCE_TO_REGION[prov] == region and re.search(rf"\b{re.escape(prov)}\b", key):
            best = prov
            break
    if best:
        for items in _PROVINCES.values():
            for item in items:
                if norm(item.split("|")[0]) == best:
                    return region, item.split("|")[0]
    return region, None


def profession_for(profile: str | None, discipline: str | None, title_text: str, health_ente: bool) -> str:
    probe = " ".join(x for x in (profile, discipline) if x)
    if profile and profile.startswith("Direttore UOC"):
        probe = title_text  # "direttore medico della UOC ...": la professione sta nel testo, non nel nome della struttura
    p = guess_profession(probe, fallback=title_text) if probe else guess_profession(title_text)
    if p == "Altro" and health_ente:
        p = "Gestione e supporto"
    return p


def dedupe_titles(jobs: list[JobPayload]) -> list[JobPayload]:
    """La web deduplica per titolo|azienda|regione: due bandi con lo stesso titolo ottengono un suffisso (data)."""
    seen: set[tuple[str, str, str]] = set()
    for job in jobs:
        key = (norm(job.title), norm(job.company), norm(job.location_district))
        if key in seen:
            stamp = (job.expires_at or job.published_at or "")[:10]
            suffix = f"scad. {stamp[8:10]}/{stamp[5:7]}" if len(stamp) == 10 else job.source_id[-6:]
            job.title = f"{job.title} ({suffix})"
            key = (norm(job.title), key[1], key[2])
            if key in seen:
                job.title = f"{job.title} · {job.source_id[-6:]}"
                key = (norm(job.title), key[1], key[2])
        seen.add(key)
    return jobs


def clip_description(text: str, limit: int = 8000) -> str:
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"
