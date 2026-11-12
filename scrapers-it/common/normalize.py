"""Normalizzazione per fonti italiane (it-IT).

I risultati devono coincidere con le tassonomie dell'app:
  - regione      -> apps/web-it/src/lib/italy-map.ts   (campo `location_district`)
  - professione  -> apps/web-it/src/lib/taxonomies.ts  (`professions`)
`guess_profession` restituisce l'ETICHETTA (come in ES); lo slug URL si ottiene con
PROFESSION_SLUGS. La classificazione per titolo e' duplicata in
apps/web-it/src/lib/job-store.ts (guessProfession): tenere sincronizzate.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
from html import unescape as html_unescape

# Le 20 regioni (etichette ufficiali, come in italy-map.ts).
REGIONS = [
    "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna",
    "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche", "Molise",
    "Piemonte", "Puglia", "Sardegna", "Sicilia", "Toscana", "Trentino-Alto Adige",
    "Umbria", "Valle d'Aosta", "Veneto",
]
DEFAULT_DISTRICT = "Italia"

# regione -> province "Nome|SIGLA" (incluse varianti storiche/bilingui come voci separate).
_PROVINCES: dict[str, list[str]] = {
    "Abruzzo": ["L'Aquila|AQ", "Chieti|CH", "Pescara|PE", "Teramo|TE"],
    "Basilicata": ["Potenza|PZ", "Matera|MT"],
    "Calabria": ["Catanzaro|CZ", "Cosenza|CS", "Crotone|KR", "Reggio Calabria|RC",
                 "Reggio di Calabria|RC", "Vibo Valentia|VV"],
    "Campania": ["Napoli|NA", "Avellino|AV", "Benevento|BN", "Caserta|CE", "Salerno|SA"],
    "Emilia-Romagna": ["Bologna|BO", "Ferrara|FE", "Forlì-Cesena|FC", "Forlì|FC", "Cesena|FC",
                       "Modena|MO", "Parma|PR", "Piacenza|PC", "Ravenna|RA",
                       "Reggio Emilia|RE", "Reggio nell'Emilia|RE", "Rimini|RN"],
    "Friuli-Venezia Giulia": ["Pordenone|PN", "Udine|UD", "Gorizia|GO", "Trieste|TS"],
    "Lazio": ["Roma|RM", "Frosinone|FR", "Latina|LT", "Rieti|RI", "Viterbo|VT"],
    "Liguria": ["Genova|GE", "Savona|SV", "Imperia|IM", "La Spezia|SP"],
    "Lombardia": ["Milano|MI", "Bergamo|BG", "Brescia|BS", "Como|CO", "Cremona|CR", "Lecco|LC",
                  "Lodi|LO", "Mantova|MN", "Monza e Brianza|MB", "Monza|MB", "Pavia|PV",
                  "Sondrio|SO", "Varese|VA"],
    "Marche": ["Ancona|AN", "Ascoli Piceno|AP", "Fermo|FM", "Macerata|MC", "Pesaro e Urbino|PU",
               "Pesaro-Urbino|PU"],
    "Molise": ["Campobasso|CB", "Isernia|IS"],
    "Piemonte": ["Torino|TO", "Alessandria|AL", "Asti|AT", "Biella|BI", "Cuneo|CN", "Novara|NO",
                 "Verbano-Cusio-Ossola|VB", "Verbania|VB", "Vercelli|VC"],
    "Puglia": ["Bari|BA", "Barletta-Andria-Trani|BT", "Brindisi|BR", "Foggia|FG", "Lecce|LE",
               "Taranto|TA"],
    "Sardegna": ["Cagliari|CA", "Sassari|SS", "Nuoro|NU", "Oristano|OR", "Sud Sardegna|SU",
                 "Sulcis Iglesiente|SU", "Medio Campidano|VS", "Ogliastra|OG",
                 "Carbonia-Iglesias|CI", "Olbia-Tempio|OT", "Gallura Nord-Est Sardegna|OT"],
    "Sicilia": ["Palermo|PA", "Agrigento|AG", "Caltanissetta|CL", "Catania|CT", "Enna|EN",
                "Messina|ME", "Ragusa|RG", "Siracusa|SR", "Trapani|TP"],
    "Toscana": ["Firenze|FI", "Arezzo|AR", "Grosseto|GR", "Livorno|LI", "Lucca|LU",
                "Massa-Carrara|MS", "Massa Carrara|MS", "Pisa|PI", "Pistoia|PT", "Prato|PO",
                "Siena|SI"],
    "Trentino-Alto Adige": ["Trento|TN", "Bolzano|BZ", "Bozen|BZ", "Bolzano Bozen|BZ"],
    "Umbria": ["Perugia|PG", "Terni|TR"],
    "Valle d'Aosta": ["Aosta|AO", "Aoste|AO"],
    "Veneto": ["Venezia|VE", "Belluno|BL", "Padova|PD", "Rovigo|RO", "Treviso|TV", "Verona|VR",
               "Vicenza|VI"],
}

def strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )


def norm(text: str) -> str:
    text = strip_accents(text or "")
    text = re.sub(r"[^a-zA-Z0-9\s]", " ", text).lower()
    return re.sub(r"\s+", " ", text).strip()


def dedupe_hash(title: str, company: str, district: str) -> str:
    key = f"{norm(title)}|{norm(company)}|{norm(district)}"
    return hashlib.sha256(key.encode()).hexdigest()


def slugify(text: str) -> str:
    text = norm(text).replace(" ", "-")
    return re.sub(r"-+", "-", text).strip("-")[:80]


def html_to_text(html: str | None) -> str:
    if not html:
        return ""

    text = re.sub(r"(?is)<(script|style|head|title).*?>.*?</\1>", " ", html)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</(p|div|h[1-6]|tr)>", "\n", text)
    text = re.sub(r"(?i)</li>", "\n", text)
    text = re.sub(r"(?i)<li[^>]*>", "- ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html_unescape(text)
    # &nbsp; e caratteri a larghezza zero (frequenti negli ATS italiani)
    text = text.replace("\xa0", " ").replace("\u200b", "").replace("\ufeff", "")
    # Puntini elenco alternativi -> "- "
    text = re.sub(r"(?m)^[ \t]*[▪●■◦·–—][ \t]+", "- ", text)

    def is_list_item(line: str) -> bool:
        return bool(re.match(r"^[-•*]\s+\S", line) or re.match(r"^\d+[.)]\s+\S", line))

    raw_lines: list[str] = []
    for raw_line in text.splitlines():
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        if not line:
            raw_lines.append("")
            continue
        # Remove residual CSS / boilerplate from ATS HTML wrappers.
        if (
            line.startswith(".")
            or "{" in line
            or "}" in line
            or line.lower().startswith("a document with")
            or line.lower() in {"html", "body"}
        ):
            continue
        raw_lines.append(line)

    lines: list[str] = []
    for i, line in enumerate(raw_lines):
        if not line:
            prev = next((l for l in reversed(lines) if l), "")
            nxt = next((l for l in raw_lines[i + 1 :] if l), "")
            if not prev or not nxt:
                continue
            # Keep list blocks tight; no blank between intro/title and list.
            if is_list_item(prev) and is_list_item(nxt):
                continue
            if not is_list_item(prev) and is_list_item(nxt):
                continue
            if lines and lines[-1] == "":
                continue
            lines.append("")
            continue
        lines.append(line)

    cleaned = "\n".join(lines)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()



# Nomi di regione e varianti ufficiali / bilingui / abbreviate.
REGION_ALIASES_RAW = {
    "Abruzzo": ["Abruzzi"],
    "Basilicata": ["Lucania"],
    "Calabria": [],
    "Campania": [],
    "Emilia-Romagna": ["Emilia Romagna", "Romagna"],
    "Friuli-Venezia Giulia": ["Friuli Venezia Giulia", "Friuli", "Venezia Giulia", "FVG"],
    "Lazio": [],
    "Liguria": [],
    "Lombardia": ["Lombardy"],
    "Marche": [],
    "Molise": [],
    "Piemonte": ["Piedmont"],
    "Puglia": ["Apulia"],
    "Sardegna": ["Sardinia"],
    "Sicilia": ["Sicily"],
    "Toscana": ["Tuscany"],
    "Trentino-Alto Adige": ["Trentino Alto Adige", "Trentino-Alto Adige/Südtirol", "Trentino Alto Adige Sudtirol",
                            "Trentino", "Alto Adige", "Südtirol", "Sudtirol",
                            "Provincia autonoma di Trento", "Provincia autonoma di Bolzano",
                            "Provincia di Trento", "Provincia di Bolzano"],
    "Umbria": [],
    "Valle d'Aosta": ["Valle d'Aosta/Vallée d'Aoste", "Vallée d'Aoste", "Val d'Aosta", "Valdaosta"],
    "Veneto": [],
}

# Comuni frequenti nelle offerte sanitarie che NON sono capoluogo -> regione.
_CITIES: dict[str, list[str]] = {
    "Abruzzo": ["Giulianova", "Avezzano", "Sulmona", "Lanciano", "Vasto", "Montesilvano", "Atri", "Teramo",
                "Ortona", "San Salvo", "Roseto degli Abruzzi", "Silvi"],
    "Basilicata": ["Melfi", "Policoro", "Lagonegro", "Venosa", "Matera", "Villa d'Agri", "Pisticci"],
    "Calabria": ["Lamezia Terme", "Corigliano-Rossano", "Rossano", "Corigliano Calabro", "Gioia Tauro", "Palmi",
                 "Locri", "Paola", "Castrovillari", "Soverato", "Polistena", "Rende", "Cetraro"],
    "Campania": ["Pozzuoli", "Torre del Greco", "Giugliano in Campania", "Giugliano", "Afragola", "Casoria",
                 "Castellammare di Stabia", "Nocera Inferiore", "Aversa", "Nola", "Pompei", "Portici", "Ercolano",
                 "Battipaglia", "Eboli", "Sorrento", "Ariano Irpino", "Sant'Angelo dei Lombardi", "Capua",
                 "Marcianise", "Acerra", "Pagani", "Cava de' Tirreni", "Agropoli", "Vallo della Lucania"],
    "Emilia-Romagna": ["Imola", "Carpi", "Faenza", "Riccione", "Cattolica", "Lugo", "Sassuolo", "Cento",
                       "Fidenza", "Guastalla", "Scandiano", "Mirandola", "Vignola", "Cesenatico", "Casalecchio di Reno",
                       "San Lazzaro di Savena", "Budrio", "Bentivoglio", "Castel San Pietro Terme"],
    "Friuli-Venezia Giulia": ["Monfalcone", "Cividale del Friuli", "Tolmezzo", "San Daniele del Friuli",
                              "Palmanova", "Latisana", "Gemona del Friuli", "Cervignano del Friuli", "Sacile",
                              "Spilimbergo", "Maniago", "Codroipo", "Grado", "Lignano Sabbiadoro"],
    "Lazio": ["Aprilia", "Terracina", "Formia", "Civitavecchia", "Tivoli", "Cassino", "Guidonia Montecelio",
              "Guidonia", "Pomezia", "Anzio", "Nettuno", "Velletri", "Albano Laziale", "Frascati", "Fiumicino",
              "Ostia", "Ladispoli", "Cerveteri", "Colleferro", "Sora", "Anagni", "Gaeta", "Fondi", "Palestrina",
              "Monterotondo", "Marino", "Ciampino", "Bracciano"],
    "Liguria": ["Sanremo", "Chiavari", "Rapallo", "Albenga", "Lavagna", "Sestri Levante", "Imperia", "Ventimiglia",
                "Finale Ligure", "Pietra Ligure", "Cairo Montenotte", "Sarzana", "Lerici", "Bordighera",
                "Arenzano", "Camogli"],
    "Lombardia": ["Sesto San Giovanni", "Cinisello Balsamo", "Rho", "Legnano", "Busto Arsizio", "Gallarate",
                  "Rozzano", "San Donato Milanese", "Saronno", "Desio", "Vimercate", "Seregno", "Lissone",
                  "Cernusco sul Naviglio", "Abbiategrasso", "Magenta", "Garbagnate Milanese", "Treviglio",
                  "Seriate", "Chiari", "Desenzano del Garda", "Lumezzane", "Crema", "Vigevano", "Voghera",
                  "Gavardo", "Esine", "Chiavenna", "Cantù", "Erba", "Merate", "Lecco", "Castellanza", "Tradate",
                  "Cassano d'Adda", "Melzo", "Pieve Emanuele", "Pioltello", "Segrate", "Bollate", "Limbiate"],
    "Marche": ["Jesi", "Senigallia", "Fabriano", "Civitanova Marche", "Fano", "Urbino", "San Benedetto del Tronto",
               "Camerino", "Osimo", "Recanati", "Porto Sant'Elpidio", "Cingoli", "Tolentino"],
    "Molise": ["Termoli", "Venafro", "Larino", "Agnone", "Campobasso", "Isernia", "Campomarino"],
    "Piemonte": ["Moncalieri", "Rivoli", "Collegno", "Alba", "Chieri", "Ivrea", "Pinerolo", "Nichelino", "Settimo Torinese",
                 "Carmagnola", "Chivasso", "Ciriè", "Bra", "Savigliano", "Casale Monferrato", "Tortona", "Novi Ligure",
                 "Domodossola", "Borgomanero", "Verbania", "Orbassano", "Biella", "Omegna", "Acqui Terme", "Ovada"],
    "Puglia": ["Altamura", "Molfetta", "Andria", "Trani", "Barletta", "Bisceglie", "Cerignola", "Manfredonia",
               "San Giovanni Rotondo", "Lucera", "San Severo", "Martina Franca", "Gallipoli", "Casarano",
               "Putignano", "Monopoli", "Fasano", "Ostuni", "Francavilla Fontana", "Galatina", "Tricase", "Gravina in Puglia",
               "Bitonto", "Conversano", "Acquaviva delle Fonti", "Castellana Grotte", "Canosa di Puglia", "Copertino",
               "Nardò", "Triggiano", "Corato", "Mola di Bari", "Terlizzi", "Cassano delle Murge"],
    "Sardegna": ["Olbia", "Alghero", "Quartu Sant'Elena", "Lanusei", "Carbonia", "Iglesias", "Tempio Pausania",
                 "Capoterra", "Selargius", "Assemini", "La Maddalena", "Ozieri", "Macomer", "Sorgono", "Isili",
                 "San Gavino Monreale", "Sanluri", "Villacidro", "Muravera", "Bosa", "Siniscola"],
    "Sicilia": ["Gela", "Marsala", "Mazara del Vallo", "Bagheria", "Vittoria", "Acireale", "Modica", "Paternò",
                "Caltagirone", "Termini Imerese", "Milazzo", "Barcellona Pozzo di Gotto", "Patti", "Sciacca", "Licata",
                "Canicattì", "Niscemi", "Avola", "Noto", "Augusta", "Lentini", "Priolo Gargallo", "Cefalù",
                "Partinico", "Corleone", "Castelvetrano", "Alcamo", "Erice", "Taormina", "Giarre", "Biancavilla",
                "Adrano", "Comiso", "Scicli", "Pozzallo", "Piazza Armerina", "Nicosia", "Mistretta", "Lipari", "Santa Teresa di Riva"],
    "Toscana": ["Viareggio", "Empoli", "Pontedera", "Piombino", "Cecina", "Pietrasanta", "Carrara", "Montecatini Terme",
                "Sesto Fiorentino", "Scandicci", "Campi Bisenzio", "Figline e Incisa Valdarno", "Borgo San Lorenzo",
                "Poggibonsi", "Montepulciano", "Lido di Camaiore", "Camaiore", "Massa", "San Giovanni Valdarno", "Cortona",
                "Castelnuovo di Garfagnana", "Fucecchio", "Portoferraio", "Orbetello", "Follonica", "Barga", "Bagno a Ripoli"],
    "Trentino-Alto Adige": ["Rovereto", "Merano", "Meran", "Bressanone", "Brixen", "Brunico", "Bruneck", "Riva del Garda",
                            "Arco", "Cles", "Borgo Valsugana", "Cavalese", "Tione di Trento", "Pergine Valsugana",
                            "Vipiteno", "Sterzing", "Silandro", "Schlanders", "Laives", "Egna", "Cavareno", "Mezzolombardo"],
    "Umbria": ["Orvieto", "Foligno", "Spoleto", "Città di Castello", "Gubbio", "Assisi", "Narni", "Amelia", "Todi",
               "Castiglione del Lago", "Umbertide", "Norcia", "Terni"],
    "Valle d'Aosta": ["Courmayeur", "Saint-Vincent", "Verrès", "Châtillon", "Pont-Saint-Martin", "Donnas"],
    "Veneto": ["Mestre", "Chioggia", "Bassano del Grappa", "Schio", "Thiene", "Legnago", "Mirano", "Portogruaro",
               "San Donà di Piave", "Cittadella", "Conegliano", "Montebelluna", "Castelfranco Veneto", "Jesolo",
               "Dolo", "Adria", "Este", "Monselice", "Feltre", "Pieve di Cadore", "Valdagno", "Arzignano", "Marostica",
               "Villafranca di Verona", "Bussolengo", "San Bonifacio", "Peschiera del Garda", "Negrar", "Isola della Scala",
               "Oderzo", "Vittorio Veneto", "Mogliano Veneto", "Camposampiero", "Piove di Sacco", "Abano Terme", "Selvazzano Dentro",
               "Noale", "Lonigo", "Zevio", "Cavarzere", "Asolo", "Belluno", "Santorso", "Thiene", "Bardolino"],
}

# Ambigui come parola comune: ammessi solo come frammento esatto ("Fermo, Marche"), non nella ricerca per sottostringa.
AMBIGUOUS_KEYS = {"fermo", "massa", "como", "prato", "arco", "este", "dolo", "rho", "bra", "sora", "lerici", "noto", "patti", "adria", "asolo"}

# Alias in lingua straniera / grafie comuni delle citta' maggiori.
_FOREIGN_CITY = {"rome": "Lazio", "milan": "Lombardia", "naples": "Campania", "florence": "Toscana",
                 "turin": "Piemonte", "venice": "Veneto", "genoa": "Liguria", "bologna": "Emilia-Romagna"}


def _build_tables() -> tuple[dict, dict, dict, dict]:
    provinces: dict[str, str] = {}
    sigle: dict[str, str] = {}
    for region, items in _PROVINCES.items():
        for item in items:
            name, sigla = item.split("|")
            provinces[norm(name)] = region
            sigle[sigla] = region
    regions = {norm(r): r for r in REGIONS}
    for region, aliases in REGION_ALIASES_RAW.items():
        for a in aliases:
            regions[norm(a)] = region
    regions["regione " + norm("Lazio")] = "Lazio"
    cities = {norm(c): r for r, cs in _CITIES.items() for c in cs}
    cities.update(_FOREIGN_CITY)
    return regions, provinces, cities, sigle


REGION_ALIASES, PROVINCE_TO_REGION, CITY_TO_REGION, SIGLA_TO_REGION = _build_tables()

# Etichette professione (tassonomia dell'app) -> slug URL.
PROFESSION_SLUGS = {
    "Medicina": "medicina",
    "Infermieristica": "infermieristica",
    "OSS": "oss",
    "Fisioterapia": "fisioterapia",
    "Tecnici sanitari": "tecnici-sanitari",
    "Ostetricia": "ostetricia",
    "Farmacia": "farmacia",
    "Psicologia": "psicologia",
    "Odontoiatria": "odontoiatria",
    "Veterinaria": "veterinaria",
    "Servizio sociale": "servizio-sociale",
    "Nutrizione e dietistica": "nutrizione-dietistica",
    "Logopedia e riabilitazione": "logopedia-riabilitazione",
    "Ottica e audiometria": "ottica-audiometria",
    "Amministrativo": "amministrativo",
    "Gestione e supporto": "gestione-supporto",
    "Formazione": "formazione",
    "Altro": "altro",
}
PROFESSIONS = list(PROFESSION_SLUGS)
OTHER_PROFESSION = "Altro"


def guess_district(city: str | None, region: str | None = None) -> str:
    """Restituisce la regione (etichetta di italy-map.ts) oppure "Italia" se non riconosciuta."""
    for value in (region, city):
        if not value:
            continue
        # "Milano (MI)", "Via X, 20100 Milano MI" -> sigla di provincia tra parentesi.
        for sig in re.findall(r"\(([A-Z]{2})\)", value):
            if sig in SIGLA_TO_REGION:
                return SIGLA_TO_REGION[sig]
        cleaned = re.sub(r"\([^)]*\)", " ", value).strip("[]\"' ").replace('"', "").replace("[", "").replace("]", "")
        pieces = [p.strip() for p in re.split(r"[,;|]", cleaned) if p.strip()]
        for piece in reversed(pieces) if len(pieces) > 1 else pieces:
            key = norm(piece)
            if key in ("italia", "italy", "it", "ita"):
                continue
            for table in (REGION_ALIASES, PROVINCE_TO_REGION, CITY_TO_REGION):
                if key in table:
                    return table[key]
        key = norm(cleaned)
        for table in (REGION_ALIASES, PROVINCE_TO_REGION, CITY_TO_REGION):
            # alias piu' lunghi prima: "reggio emilia" deve battere "reggio calabria" ecc.
            for alias in sorted(table, key=len, reverse=True):
                if alias in AMBIGUOUS_KEYS:
                    continue
                # parola intera, non sottostringa ("asti" non deve combaciare con "fantastico")
                if re.search(rf"\b{re.escape(alias)}\b", key):
                    return table[alias]
    return DEFAULT_DISTRICT


# Regole di classificazione per titolo (ordine = priorita'). Gli "needle" sono regex
# applicate al titolo normalizzato (minuscolo, senza accenti/punteggiatura).
def _r(*patterns: str) -> re.Pattern:
    return re.compile("|".join(patterns))


RULES: list[tuple[re.Pattern, str]] = [
    (_r(r"\bformator", r"\bdocent", r"\btutor didattic", r"e learning", r"\belearning", r"responsabile (della )?formazione",
        r"coordinatore (della )?formazione", r"\bistruttore", r"formazione clinica"), "Formazione"),
    # Informatori scientifici / commerciali: non sono professioni sanitarie -> Altro (prima di Medicina/Farmacia).
    (_r(r"informatore (scientifico|medico|farmaceutico)", r"visitatore medico", r"medical science liaison", r"\bmsl\b",
        r"key account", r"\bsales\b", r"business development", r"account manager", r"product specialist",
        r"agente di commercio", r"\bcommerciale\b"), "Altro"),
    # Ottica e audiometria prima di Tecnici sanitari / Medicina.
    (_r(r"\botticc?o\b", r"optometr", r"ottico optometrista", r"audioprotesist", r"audiometrist",
        r"tecnico audiometrista", r"tecnico audioprotesista"), "Ottica e audiometria"),
    (_r(r"farmacist", r"farmacia", r"farmaceutic", r"pharmacist", r"parafarmacia"), "Farmacia"),
    (_r(r"odontoiatr", r"dentista", r"odontostomatolog", r"ortodonzi", r"igienista dentale", r"assistente (alla poltrona|di studio odontoiatrico)",
        r"odontotecnic", r"\bdental\b"), "Odontoiatria"),
    # OSS prima di Infermieristica ("assistenza infermieristica", ecc.).
    (_r(r"\boss\b", r"operatore socio ?sanitari", r"operatrice socio ?sanitari", r"\boperatori socio ?sanitari", r"\bsocio ?sanitari[oa]\b",
        r"ausiliario socio", r"\basa\b", r"addett[oa] all assistenza", r"assistente geriatric", r"assistente di base",
        r"assistenza domiciliare", r"\bgeriatric[oa] assistente", r"\bossa\b"), "OSS"),
    (_r(r"infermier", r"\bcaposala\b", r"\bnurse\b", r"\bnursing\b", r"puericultric", r"assistente sanitari"), "Infermieristica"),
    # Terapia occupazionale, logopedia, neuropsicomotricita'.
    (_r(r"logoped", r"terapista occupazional", r"terapista della neuro", r"neuropsicomotric", r"psicomotricist",
        r"tecnico della riabilitazione", r"riabilitazione psichiatrica", r"ortottist", r"audiologo"), "Logopedia e riabilitazione"),
    # Tecnici con titolo esplicito (prima di Medicina: "tecnico di radiologia medica").
    (_r(r"tecnico sanitario", r"tecnico di laboratorio", r"tecnico di radiologia", r"\btsrm\b", r"\btslb\b",
        r"tecnico di neurofisiopatologia", r"tecnico della prevenzione", r"tecnico ortopedico", r"fisiopatologia cardiocircolatoria",
        r"perfusionist", r"tecnico di anatomia", r"tecnico di emodialisi", r"tecnico sanitario di", r"podolog",
        r"tecnico (di|in) laboratorio", r"tecnico di imaging", r"tecnico di diagnostica", r"tecnico di cardiologia",
        r"tecnico di radiodiagnostica", r"tecnico (di )?elettromedical", r"dosimetrist", r"fisico medico"), "Tecnici sanitari"),
    (_r(r"nutrizionist", r"\bdietist", r"dietolog", r"nutrizione", r"\bdietetic"), "Nutrizione e dietistica"),
    (_r(r"fisioterap", r"physiotherap", r"osteopat", r"massofisioterap", r"chinesiolog", r"posturolog"), "Fisioterapia"),
    (_r(r"psicolog", r"psicoterapeut", r"psychologist", r"neuropsicolog"), "Psicologia"),
    (_r(r"assistente sociale", r"servizio sociale", r"servizi sociali", r"operatore sociale", r"\beducator", r"pedagogist",
        r"mediatore culturale", r"mediatrice culturale", r"case manager sociale"), "Servizio sociale"),
    # Medicina: dopo infermieri/tecnici/odontoiatri (stesso schema di ES).
    (_r(r"\bmedico\b", r"\bmedica\b", r"\bmedici\b", r"dirigente medico", r"\bmedicina\b", r"chirurg", r"pediatr", r"anestesi",
        r"rianimator", r"dermatolog", r"ortopedic", r"traumatolog", r"urolog", r"oculist", r"oftalmolog", r"psichiatr",
        r"radiolog", r"geriatra", r"internista", r"ginecolog", r"neurolog", r"cardiolog", r"patolog", r"\bphysician\b",
        r"guardia medica", r"specializzand", r"specialista ambulatoriale", r"oncolog", r"ematolog", r"nefrolog",
        r"pneumolog", r"otorino", r"endocrinolog", r"reumatolog", r"gastroenterolog", r"diabetolog", r"neonatolog",
        r"fisiatra", r"infettivolog", r"allergolog", r"medico legale", r"anatomopatolog", r"neurochirurg", r"cure palliative",
        r"direttore sanitario", r"emergenza urgenza", r"medicina generale", r"\bdoctor\b"), "Medicina"),
    # Ostetricia dopo Medicina: "Dirigente medico di Ostetricia" resta Medicina.
    (_r(r"ostetric", r"levatrice", r"\bmidwife\b"), "Ostetricia"),
    # Tecnici (termini generici) dopo Medicina.
    (_r(r"radiologia", r"radiodiagnostic", r"laboratorio", r"laboratory", r"diagnostica per immagini", r"analisi cliniche",
        r"anatomia patologica", r"biolog", r"biochim", r"microbiolog", r"biomedic", r"\bchimico\b", r"elettromedical"), "Tecnici sanitari"),
    (_r(r"coordinator", r"direttore", r"direttrice", r"vice ?direttore", r"\bgestore\b", r"\bgestori\b", r"\bgestione\b",
        r"\bcapo\b", r"\bresponsabile\b", r"risorse umane", r"\bhr\b", r"\bqualita\b", r"compliance", r"logistic",
        r"magazzin", r"\bacquisti\b", r"\bprocurement\b", r"manutenzion", r"finanziari", r"contabil", r"controller",
        r"\bpulizi", r"cuoco", r"cuoca", r"cucina", r"sicurezza", r"supervisor", r"\bmanager\b"), "Gestione e supporto"),
    (_r(r"amministrativ", r"\breception", r"\bsegretari", r"customer care", r"servizio clienti", r"contact center", r"call center",
        r"centralinista", r"\baccettazione\b", r"\bcup\b", r"prenotazion", r"front office", r"back office", r"\bimpiegat",
        r"addett[oa] (alla )?segreteria", r"documentazione clinica", r"\bdata entry\b", r"coadiutore amministrativo",
        r"assistente amministrativo", r"dirigente amministrativo"), "Amministrativo"),
]

OTHER_HINTS = (
    "autista", "conducente", "helpdesk", "informatic", "sistemista", "data analyst", "ingegner", "ricercator",
    "postdoc", "researcher", "sviluppator", "developer", "elettricista", "idraulico", "giardiniere", "manutentore",
)

_GENDER_SUFFIX_RE = re.compile(r"\s*/\s*(?:a|e|i|ice|trice|essa|o)\b", re.I)


def profession_slug(label: str) -> str:
    return PROFESSION_SLUGS.get(label, "altro")


def guess_profession(title: str, fallback: str | None = None) -> str:
    # "Infermiere/a", "Educatore/trice" -> senza il suffisso di genere.
    t = norm(_GENDER_SUFFIX_RE.sub("", title or ""))
    if "veterin" in t:
        return "Veterinaria"
    # Solo titoli che iniziano con "Formazione ..." (non testo di descrizione).
    if len(t) < 70 and t.startswith("formazione "):
        return "Formazione"
    for pattern, label in RULES:
        if pattern.search(t):
            return label
    if any(n in t for n in OTHER_HINTS):
        return OTHER_PROFESSION
    if fallback and fallback != title:
        return guess_profession(fallback)
    return OTHER_PROFESSION


def guess_contract(text: str | None) -> str | None:
    """Etichetta di contratto in italiano (la app la raggruppa nei filtri: contracts.ts)."""
    if not text:
        return None
    t = norm(text)
    if re.search(r"part time|parttime|tempo parziale|orario ridotto|\bpt\b", t):
        return "Part-time"
    if re.search(r"\bturni\b|turnista|\bturno\b|\bguardie?\b|h24", t):
        return "Turni"
    if re.search(r"libero professionist|libera professione|libero professionale|partita iva|\bp iva\b|\bpiva\b|lavoro autonomo|"
                 r"consulenza|prestazione (d opera|occasionale)|co co co|collaborazione coordinata|freelance", t):
        return "Libero professionale"
    if "apprendistato" in t:
        return "Apprendistato"
    if re.search(r"tirocinio|\bstage\b|\binternship\b", t):
        return "Tirocinio"
    if re.search(r"indeterminat|posto fisso|\bdi ruolo\b|\bin ruolo\b", t):
        return "Tempo indeterminato"
    if re.search(r"\bdeterminat|termine|sostituzion|maternita|supplenza|stagional|interinale|somministrazione|\btemporane|\bsubentro",
                 t):
        return "Tempo determinato"
    if re.search(r"tempo pieno|full time|fulltime", t):
        return "Full-time"
    if "contratto" in t:
        return "Contratto"
    return None
