"""Utilitários partilhados pelos scrapers de "bolsas" HTML (OMV, ESS P.Porto, OE, SESARAM).

São páginas únicas com várias ofertas em texto livre: datas em português, localidade
perdida no texto, empregador citado na primeira frase, e-mails ofuscados (Cloudflare).
"""

from __future__ import annotations

import hashlib
import re
from datetime import date, datetime, timezone
from urllib.parse import parse_qs, quote, unquote, urljoin, urlparse

from common.normalize import CITY_TO_DISTRICT, DISTRICT_ALIASES, norm

VALID_DISTRICTS = frozenset(DISTRICT_ALIASES.values())

PT_MONTHS = {
    "janeiro": 1,
    "fevereiro": 2,
    "marco": 3,
    "abril": 4,
    "maio": 5,
    "junho": 6,
    "julho": 7,
    "agosto": 8,
    "setembro": 9,
    "outubro": 10,
    "novembro": 11,
    "dezembro": 12,
}

_DATE_NUM_RE = re.compile(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b")
_DATE_TXT_RE = re.compile(
    r"\b(\d{1,2})\s+(?:de\s+)?([a-zç]+)\s+(?:de\s+)?(\d{4})\b",
    re.I,
)


def parse_pt_date(text: str | None) -> date | None:
    """'19/10/2026', '19 de outubro de 2026', '14 outubro 2026' → date."""
    if not text:
        return None
    t = re.sub(r"\s+", " ", text)
    m = _DATE_NUM_RE.search(t)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass
    for m in _DATE_TXT_RE.finditer(t):
        month = PT_MONTHS.get(norm(m.group(2)))
        if not month:
            continue
        try:
            return date(int(m.group(3)), month, int(m.group(1)))
        except ValueError:
            continue
    return None


def iso_day(d: date | None) -> str | None:
    return f"{d.isoformat()}T00:00:00+00:00" if d else None


def today_utc() -> date:
    return datetime.now(timezone.utc).date()


def is_recent(d: date | None, today: date, max_age_days: int) -> bool:
    if not d:
        return False
    age = (today - d).days
    return -7 <= age <= max_age_days


def stable_id(*parts: str | None, prefix: str = "") -> str:
    key = "|".join(norm(p or "") for p in parts)
    digest = hashlib.sha1(key.encode()).hexdigest()[:16]
    return f"{prefix}{digest}"


# --- Localidades -------------------------------------------------------------

# Localidades citadas nestas bolsas que o normalize não conhece.
_BOARD_PLACES: dict[str, str] = {
    "s joao da madeira": "Aveiro",
    "sao joao da madeira": "Aveiro",
    "vila verde": "Braga",
    "povoa de lanhoso": "Braga",
    "esposende": "Braga",
    "fafe": "Braga",
    "vizela": "Braga",
    "benavente": "Santarém",
    "rio maior": "Santarém",
    "almeirim": "Santarém",
    "coruche": "Santarém",
    "torres novas": "Santarém",
    "elvas": "Portalegre",
    "ponte de sor": "Portalegre",
    "rio tinto": "Porto",
    "ermesinde": "Porto",
    "lousada": "Porto",
    "marco de canaveses": "Porto",
    "sao mamede de infesta": "Porto",
    "povoa de varzim": "Porto",
    "varzim": "Porto",
    "arganil": "Coimbra",
    "tabua": "Coimbra",
    "cantanhede": "Coimbra",
    "lousa": "Coimbra",
    "oliveira do hospital": "Coimbra",
    "grandola": "Setúbal",
    "santiago do cacem": "Setúbal",
    "alcacer do sal": "Setúbal",
    "moita": "Setúbal",
    "cruz de pau": "Setúbal",
    "alhandra": "Lisboa",
    "ramada": "Lisboa",
    "estoril": "Lisboa",
    "campo grande": "Lisboa",
    "oliveira do bairro": "Aveiro",
    "agueda": "Aveiro",
    "ilhavo": "Aveiro",
    "anadia": "Aveiro",
    "quinta do lago": "Faro",
    "vale do lobo": "Faro",
    "vale de lobo": "Faro",
    "quarteira": "Faro",
    "vila real de santo antonio": "Faro",
    "sao miguel": "Açores",
    "ilha de s miguel": "Açores",
    "terceira": "Açores",
    "chaves": "Vila Real",
    "lamego": "Viseu",
    "mangualde": "Viseu",
    "idanha a nova": "Castelo Branco",
    "seia": "Guarda",
    "gouveia": "Guarda",
    "mirandela": "Bragança",
    "braganca": "Bragança",
    "macedo de cavaleiros": "Bragança",
    "ponte de lima": "Viana do Castelo",
    "moncao": "Viana do Castelo",
    "arruda dos vinhos": "Lisboa",
    "sobral de monte agraco": "Lisboa",
    "salvaterra de magos": "Santarém",
    "tocha": "Coimbra",
    # (também conhecidas pelos scrapers de ATS)
    "lisbon": "Lisboa",
    "oporto": "Porto",
    "alcabideche": "Lisboa",
    "parede": "Lisboa",
    "alges": "Lisboa",
    "queluz": "Lisboa",
    "cacem": "Lisboa",
    "agualva cacem": "Lisboa",
    "moscavide": "Lisboa",
    "vila do conde": "Porto",
    "santo tirso": "Porto",
    "penafiel": "Porto",
    "paredes": "Porto",
    "amarante": "Porto",
    "felgueiras": "Porto",
    "espinho": "Aveiro",
    "ovar": "Aveiro",
    "santa maria da feira": "Aveiro",
    "oliveira de azemeis": "Aveiro",
    "barcelos": "Braga",
    "figueira da foz": "Coimbra",
    "marinha grande": "Leiria",
    "pombal": "Leiria",
    "entroncamento": "Santarém",
    "ourem": "Santarém",
    "palmela": "Setúbal",
    "sesimbra": "Setúbal",
    "angra do heroismo": "Açores",
}

# Aliases vagos (regiões) que não servem para procurar em texto livre.
_SKIP_KEYS = {"norte", "centro", "sul", "beira litoral", "xira", "tojal"}
# Concelho = None quando o match é uma região/ilha e não uma localidade.
_REGION_KEYS = {"algarve", "madeira", "ilha da madeira", "acores", "grande lisboa"}

_ACCENTS = {
    "a": "[aáàâã]",
    "e": "[eéêè]",
    "i": "[iíì]",
    "o": "[oóôõò]",
    "u": "[uúù]",
    "c": "[cç]",
}


def _place_pattern(key: str) -> re.Pattern[str]:
    words = []
    for word in key.split():
        words.append("".join(_ACCENTS.get(ch, re.escape(ch)) for ch in word))
    body = r"[\s.\-–/]+".join(words)
    return re.compile(rf"(?<![\w]){body}(?![\w])", re.I)


def _build_places() -> list[tuple[str, re.Pattern[str], str]]:
    places: dict[str, str] = {}
    for key, district in DISTRICT_ALIASES.items():
        places[norm(key)] = district
    for key, district in CITY_TO_DISTRICT.items():
        places.setdefault(norm(key), district)
    for key, district in _BOARD_PLACES.items():
        places.setdefault(norm(key), district)
    out = []
    for key, district in places.items():
        if not key or key in _SKIP_KEYS or district not in VALID_DISTRICTS:
            continue
        out.append((key, _place_pattern(key), district))
    return out


_PLACES = _build_places()

_SMALL_WORDS = {"de", "da", "do", "das", "dos", "e", "a", "o", "em"}


def smart_title(text: str) -> str:
    """'VALE DAS FLORES' → 'Vale das Flores' (só mexe em texto todo em maiúsculas)."""
    if not text or not text.isupper():
        return text
    words = []
    for i, word in enumerate(text.split()):
        low = word.lower()
        if i and low in _SMALL_WORDS:
            words.append(low)
        elif re.fullmatch(r"\([A-Z]{2,6}\)[.,;:]?", word) or word in {"SA", "S.A.", "IPSS", "ULS"}:
            words.append(word)  # siglas: (CPC), SA
        else:
            words.append(word[:1] + word[1:].lower())
    return " ".join(words)


def find_pt_place(*texts: str | None) -> tuple[str, str | None] | None:
    """Primeira localidade PT conhecida (nome próprio) → (distrito, concelho).

    Procura texto a texto (ex.: título antes da descrição); dentro de cada um ganha a
    ocorrência mais à esquerda (e a mais longa em empate).
    """
    for text in texts:
        if not text:
            continue
        best: tuple[int, int, str, str] | None = None
        for key, pattern, district in _PLACES:
            for m in pattern.finditer(text):
                # Nomes próprios: exige maiúscula ("a guarda de…" não é a Guarda).
                if not m.group(0)[:1].isupper():
                    continue
                cand = (m.start(), -len(m.group(0)), key, district)
                if best is None or cand[:2] < best[:2]:
                    best = cand
                break
        if best:
            start, neg_len, key, district = best
            raw = text[start : start - neg_len]
            concelho = None if key in _REGION_KEYS else smart_title(raw.strip())
            if concelho and len(key.split()) == 1 and len(raw.split()) == 1 and raw.isupper():
                concelho = raw.title()
            return district, concelho
    return None


FOREIGN_RE = re.compile(
    r"\b(?:Fran[çc]a|France|Paris|Su[íi][çc]a|Switzerland|Suisse|Gen[eè]bra|Zurique|"
    r"Irlanda|Ireland|Dublin|Espanha|Spain|Espa[ñn]a|Madrid|Barcelona|Alcorc[óo]n|"
    r"Reino\s+Unido|United\s+Kingdom|Inglaterra|Londres|London|Esc[óo]cia|"
    r"B[ée]lgica|Bruxelas|Luxemburgo|Alemanha|Germany|Holanda|Pa[íi]ses\s+Baixos|"
    r"Netherlands|Dinamarca|Noruega|Su[ée]cia|Finl[âa]ndia|It[áa]lia|Malta|"
    r"Canad[áa]|Brasil|Angola|Mo[çc]ambique|Cabo\s+Verde|Dubai|Emirados|Qatar|"
    r"Ar[áa]bia\s+Saudita|Austr[áa]lia|Nova\s+Zel[âa]ndia|Estados\s+Unidos|"
    r"Aubervilliers|Lyon|Marselha|Toulouse)\b"
)


def is_abroad(title: str, text: str) -> bool:
    """Oferta fora de Portugal? País/cidade estrangeira no título, ou no texto antes de
    qualquer localidade portuguesa."""
    if FOREIGN_RE.search(title or ""):
        return not find_pt_place(title)
    m = FOREIGN_RE.search(text or "")
    if not m:
        return False
    if find_pt_place(title):
        return False
    before = (text or "")[: m.start()]
    return not find_pt_place(before)


# --- Empregador --------------------------------------------------------------

_ORG_NOUN = (
    r"(?:Cl[íi]nica|Hospital|Centro|Consult[óo]rio|Farm[áa]cia|Lar|Associa[çc][ãa]o|"
    r"Funda[çc][ãa]o|Santa\s+Casa|Miseric[óo]rdia|Grupo|Resid[êe]ncia|Residencial|"
    r"Instituto|Laborat[óo]rio|Cooperativa|Casa\s+de\s+Sa[úu]de|Unidade|Policl[íi]nica|"
    r"Vet|Veterin[áa]ria)"
)
_CAP_TOKEN = r"[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9][\w.'&]*(?:-[\w.'&]+)*"
_ORG_RE = re.compile(
    rf"\b(?i:{_ORG_NOUN})(?:\s+(?i:veterin[áa]ri[oa]|m[ée]dic[oa]|dent[áa]ri[oa]|sa[úu]de))?"
    rf"(?:\s+(?:{_CAP_TOKEN}|d[aoe]s?|e|&)){{0,8}}"
)
# Fim do nome da entidade na frase "A X, localizada em…" / "O X encontra-se…".
_LEAD_STOP_RE = re.compile(
    r"\s*(?:[,;:(]|\s[–-]\s(?=[a-záéíóú])|\b(?:localizad[oa]s?|situad[oa]s?|sediad[oa]s?|"
    r"sedead[oa]s?|sita|encontra|est[áa]|esta|recruta|recrutam|ir[áa]|pretende|procura|"
    r"prepara|tem|t[êe]m|gostaria|abrir[áa]|comemora|[ée]|uma|um|com|que|vai|precisa|"
    r"necessita|abre|admite|seleciona|refor[çc]a)\b)"
)
_LEAD_RE = re.compile(r"^\s*(?:A|O|As|Os)\s+(.+)$", re.S)
_GENERIC_LEAD = re.compile(
    r"^(?:equipa|empresa|institui|entidade|candidat|oportunidade|vaga|oferta|"
    r"fun[çc]|maioria|profissional|pessoa|unidade\s+de\s+(?:internamento|cuidados)|"
    r"que\b|quais\b|onde\b|como\b|nossa\b|nosso\b)",
    re.I,
)


# Palavras que, sozinhas depois do substantivo, não identificam ninguém.
_GENERIC_WORDS = {
    "animais", "companhia", "mista", "atendimento", "medico", "medica", "veterinario",
    "veterinaria", "veterinarios", "saude", "clinica", "equinos", "producao", "geral",
    "privada", "privado", "dentaria", "familiar", "local", "novo", "nova",
}
_CONNECTORS = {
    "de", "da", "do", "das", "dos", "e", "&", "em", "para", "a", "o", "ao", "aos", "à", "às",
    "na", "no", "nas", "nos", "-", "–", "/", "+",
}


def _org_tokens(name: str) -> str:
    """Corta o nome na primeira palavra minúscula que não seja conector.

    'Hospital Baixo Alentejo abriu portas' → 'Hospital Baixo Alentejo';
    'clínica veterinária das Avencas' mantém-se (substantivo inicial em minúsculas).
    """
    tokens = name.split()
    kept: list[str] = []
    for i, tok in enumerate(tokens):
        bare = tok.strip("(),")
        if not bare:
            continue
        if bare[:1].isupper() or bare[:1].isdigit():
            kept.append(tok)
            continue
        if i <= 1 and re.match(rf"(?i:{_ORG_NOUN}|veterin|m[ée]dic|dent[áa]r)", bare):
            kept.append(tok)
            continue
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        if bare in _CONNECTORS and (nxt[:1].isupper() or nxt[:1] == "("):
            kept.append(tok)
            continue
        break
    return " ".join(kept)


def _clean_org(name: str) -> str | None:
    name = re.sub(r"\s+", " ", name).strip(" .,;:-–— ")
    # "Clínica de Animais de Companhia. Equipa…" → corta na frase seguinte.
    name = re.split(r"(?<=\w{4})\.\s", name, maxsplit=1)[0]
    name = _org_tokens(name)
    name = re.sub(r"(?:\s+(?:d[aoe]s?|e|&|em|para|-|–|/))+$", "", name, flags=re.I)
    name = name.strip(" .,;:-–")
    if len(name) < 3 or len(name) > 90:
        return None
    if _GENERIC_LEAD.match(name):
        return None
    if not (name[:1].isupper() or re.match(_ORG_NOUN, name, re.I)):
        return None
    tail = re.sub(rf"^(?i:{_ORG_NOUN})", "", name).split()
    meaningful = [w for w in tail if norm(w) and norm(w) not in _CONNECTORS]
    if re.match(_ORG_NOUN, name, re.I) and all(norm(w) in _GENERIC_WORDS for w in meaningful):
        return None
    return smart_title(name)


def _lead_employer(paragraph: str) -> str | None:
    m = _LEAD_RE.match(paragraph)
    if not m:
        return None
    rest = m.group(1)
    stop = _LEAD_STOP_RE.search(rest)
    name = rest[: stop.start()] if stop else rest[:90]
    # "Farmácia São Mamede em São Mamede de Infesta" → corta no "em <localidade>".
    em = re.search(r"\s(?:em|no|na)\s+(.+)$", name)
    if em and find_pt_place(em.group(1)):
        name = name[: em.start()]
    return _clean_org(name)


def _org_employer(text: str) -> str | None:
    for m in _ORG_RE.finditer(text):
        raw = m.group(0)
        name = _clean_org(raw)
        if not name:
            continue
        # Precisa de pelo menos um nome próprio depois do substantivo genérico.
        tail = re.sub(rf"^(?i:{_ORG_NOUN})(?:\s+(?i:veterin[áa]ri[oa]|m[ée]dic[oa]|dent[áa]ri[oa]|sa[úu]de))?", "", raw)
        if not re.search(_CAP_TOKEN, tail):
            continue
        return name
    return None


def guess_employer(title: str, paragraphs: list[str]) -> str | None:
    """Entidade empregadora citada no título ou nas primeiras frases da oferta."""
    lead = _lead_employer(title or "")
    if lead:
        return lead
    org = _org_employer(title or "")
    if org:
        return org
    for paragraph in paragraphs[:5]:
        p = paragraph.strip()
        m = re.match(r"^Recrutamento\s*[–—-]\s*(.{3,60})$", p)
        if m:
            return _clean_org(m.group(1))
        m = re.match(r"^(.{3,80}?)\s+(?:RECRUTA|recruta)\b", p)
        if m and not _LEAD_RE.match(p):
            name = _clean_org(m.group(1))
            if name and (name[:1].isupper()):
                return name
        lead = _lead_employer(p)
        if lead:
            return lead
    head = " ".join(paragraphs[:4])[:700]
    org = _org_employer(head)
    if org:
        return org
    # "Local de trabalho: Premium Care" / "Entidade: X" (valor na mesma linha ou na seguinte).
    for i, paragraph in enumerate(paragraphs[:25]):
        m = _LABEL_RE.match(paragraph.strip())
        if not m:
            continue
        value = m.group(1).strip() or (paragraphs[i + 1] if i + 1 < len(paragraphs) else "")
        value = re.split(r"\s*[,;(—–]\s*|\s+-\s+", value, maxsplit=1)[0]
        if not value or (find_pt_place(value) and len(value.split()) <= 3):
            continue
        name = _clean_org(value)
        if name:
            return name
    return None


_LABEL_RE = re.compile(
    r"^\W*(?:Local(?:\s+de\s+trabalho)?|Entidade(?:\s+(?:empregadora|contratante))?|"
    r"Empresa|Institui[çc][ãa]o|Empregador)\s*:\s*(.{0,120})$",
    re.I,
)


# --- HTML --------------------------------------------------------------------


def decode_cfemail(hexstr: str) -> str:
    try:
        data = bytes.fromhex(hexstr)
    except ValueError:
        return ""
    if not data:
        return ""
    key = data[0]
    return bytes(b ^ key for b in data[1:]).decode("utf-8", "replace")


def decode_cfemails(html: str) -> str:
    """Repõe e-mails ofuscados pelo Cloudflare ([email protected])."""
    html = re.sub(
        r'<span[^>]*data-cfemail="([0-9a-fA-F]+)"[^>]*>.*?</span>',
        lambda m: decode_cfemail(m.group(1)),
        html,
        flags=re.S,
    )

    def _anchor(m: re.Match[str]) -> str:
        email = decode_cfemail(m.group(1))
        inner = m.group(2)
        if not email:
            return inner
        if "@" in re.sub(r"<[^>]+>", "", inner):
            return re.sub(r"<[^>]+>", "", inner)
        return f"{inner} {email}"

    html = re.sub(
        r'<a[^>]*href="/cdn-cgi/l/email-protection#([0-9a-fA-F]+)"[^>]*>(.*?)</a>',
        _anchor,
        html,
        flags=re.S,
    )
    return html


def unwrap_urldefense(url: str) -> str:
    """Links Proofpoint (urldefense v2) → URL original."""
    if "urldefense.proofpoint.com/v2/url" not in url:
        return url
    qs = parse_qs(urlparse(url.replace("&amp;", "&")).query)
    u = (qs.get("u") or [""])[0]
    if not u:
        return url
    return unquote(u.replace("_", "/").replace("-", "%"))


def text_fragment_url(base: str, text: str, words: int = 8) -> str:
    """URL da página com scroll-to-text (#:~:text=) para as primeiras palavras."""
    snippet = " ".join((text or "").split()[:words]).strip()
    if not snippet:
        return base
    encoded = quote(snippet, safe="").replace("-", "%2D")
    return f"{base}#:~:text={encoded}"


HEALTH_RE = re.compile(
    r"enferm|m[ée]dic|veterin|fisioterap|terapeut|terapia|farm[áa]c|psic[óo]log|"
    r"nutri|dietist|cardiopneumolog|radiolog|imagiolog|an[áa]lises\s+cl[íi]nicas|"
    r"laborat|biom[ée]dic|ortopt|ort[óo]ptic|osteopat|audiolog|optometr|podolog|"
    r"higiene\s+oral|neurofisiolog|fisiologia|cuidador|auxiliar|sa[úu]de|"
    r"anatomia\s+patol|medicina|gerontolog|prot[ée]s",
    re.I,
)


_PUBLIC_RE = re.compile(
    r"\bULS\b|Unidade\s+Local\s+de\s+Sa[úu]de|Servi[çc]o\s+Nacional\s+de\s+Sa[úu]de|\bSNS\b|"
    r"\bE\.?P\.?E\.?\b|EPERAM|C[âa]mara\s+Municipal|Estabelecimento\s+Prisional|"
    r"Dire[çc][ãa]o-?Geral|Procedimento\s+concursal|Administra[çc][ãa]o\s+Regional\s+de\s+Sa[úu]de|"
    r"\bARS\b|For[çc]as\s+Armadas|Marinha\b|Ex[ée]rcito\b|For[çc]a\s+A[ée]rea|Minist[ée]rio",
)
_IPSS_RE = re.compile(
    r"\bIPSS\b|Institui[çc][ãa]o\s+Particular\s+de\s+Solidariedade|Miseric[óo]rdia|"
    r"Santa\s+Casa|Centro\s+Social|Cruz\s+Vermelha|Associa[çc][ãa]o\s+(?:de\s+)?Reformados|"
    r"Mutualidade|Mutualista",
    re.I,
)


def guess_sector(text: str, default: str = "privado") -> str:
    """publico | ipss | privado a partir do empregador/texto da oferta."""
    if _PUBLIC_RE.search(text or ""):
        return "publico"
    if _IPSS_RE.search(text or ""):
        return "ipss"
    return default


_IMG_EXT_RE = re.compile(r"\.(?:png|jpe?g|gif|webp|svg)(?:\?|$)", re.I)


def block_links(html: str, base: str) -> list[str]:
    """Links úteis de um bloco (candidatura, aviso PDF…), sem mailto/imagens/âncoras."""
    out: list[str] = []
    for href in re.findall(r'<a[^>]+href="([^"]+)"', html, flags=re.I):
        href = href.replace("&amp;", "&").strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        if "/cdn-cgi/" in href or _IMG_EXT_RE.search(href):
            continue
        url = unwrap_urldefense(urljoin(base, href))
        if url not in out:
            out.append(url)
    return out


def with_links(text: str, links: list[str]) -> str:
    """Acrescenta à descrição os links que o texto não mostra."""
    extra = [u for u in links if u not in text]
    if not extra:
        return text
    return text + "\n\nLigações:\n" + "\n".join(f"- {u}" for u in extra)
