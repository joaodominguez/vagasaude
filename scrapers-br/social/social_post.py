#!/usr/bin/env python3
"""Post diário nas redes sociais — VagaSaúde BR e PT, VacantesSalud ES e OfferteSanità IT ("as vagas mais procuradas"). Escolher com --market br|pt|es|it.

Plano: docs/REDES-SOCIAIS.md. Não mexe na app: só lê dados e escreve em data/social/.

Uso (como portal, com o venv /home/portal/.venvs/social):
  social_post.py --deliver      escolhe as vagas, gera imagens e textos e envia o pacote por e-mail ao dono
  social_post.py --publish      publica o pacote do dia nos canais configurados (Telegram, Facebook)
  social_post.py --dry-run      só gera o pacote (sem e-mail, sem publicar, sem marcar vagas como usadas)
Opções: --market br|pt  --root (por omissão a do mercado)  --day AAAA-MM-DD (dia do post; por omissão hoje UTC)

Credenciais dos canais (opcional): ~/.config/vagasaude/social-br.json (chmod 600)
  {"telegram": {"bot_token": "...", "chat_id": "@vagasaudebr"},
   "facebook": {"page_id": "...", "page_token": "...", "graph_version": "v21.0"}}
"""
from __future__ import annotations

import argparse
import base64
import html
import json
import os
import re
import shutil
import sys
import unicodedata
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ASSETS = HERE / "assets"
SITE = "https://vagasaude.com.br"
JOB_PREFIX = "/vagas/"
CONFIG = Path.home() / ".config" / "vagasaude" / "social-br.json"
TELEGRAM_CHANNEL = "https://t.me/vagasaudebr"
WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029Vb9QPDsLY6dDeq2VVQ2i"
DOMAIN = "vagasaude.com.br"

# Mercados: o motor é o mesmo; mudam o site, as contas e alguns textos.
MARKETS = {
    "br": dict(root="/var/www/vagasaudebr", site="https://vagasaude.com.br", config="social-br.json",
               telegram="https://t.me/vagasaudebr", whatsapp="https://whatsapp.com/channel/0029Vb9QPDsLY6dDeq2VVQ2i",
               label="VagaSaúde BR", tz="Brasília", swipe="Arraste para ver →", everywhere="todo o Brasil",
               tags="#vagasdeemprego #vagassaude #empregosaude"),
    "pt": dict(root="/var/www/vagasaude", site="https://vagasaude.pt", config="social-pt.json",
               telegram="https://t.me/vagasaudept", whatsapp="https://whatsapp.com/channel/0029VbDxb8A5PO0v9AeTbE32",
               label="VagaSaúde PT", tz="Lisboa", swipe="Deslize para ver →", everywhere="todo o país",
               tags="#emprego #empregosaude #saude #portugal"),
    "es": dict(root="/var/www/vacantessalud", site="https://vacantessalud.es", config="social-es.json",
               telegram="https://t.me/vacantessalud", whatsapp="https://whatsapp.com/channel/0029VbE2wId4SpkNer4zlP3s",
               label="VacantesSalud ES", tz="Madrid", swipe="Desliza para ver →", everywhere="toda España",
               tags="#empleo #empleosanitario #ofertasdeempleo #sanidad #españa",
               lang="es", job_prefix="/empleo/", alerts="/alertas", brand="VacantesSalud", logo="es"),
    "it": dict(root="/var/www/offertesanita", site="https://offertesanita.it", config="social-it.json",
               telegram="https://t.me/offertesanita", whatsapp="https://whatsapp.com/channel/0029VbDuqMp9xVJnr0RzZG04",
               label="OfferteSanità IT", tz="Roma", swipe="Scorri per vedere →", everywhere="tutta Italia",
               tags="#lavoro #lavorosanita #offertedilavoro #sanita #italia",
               lang="it", job_prefix="/offerte/", alerts="/avvisi", brand="OfferteSanità", logo="it"),
}
M = MARKETS["br"]

# Textos por língua. "pt" é o original (BR e PT); es/it seguem a mesma estrutura.
LANG = {
    "pt": dict(
        cover="As vagas de saúde mais procuradas", count="{n} oportunidades em {where}", conj=" e ",
        apply_bio="Candidate-se pelo link na bio", cta="Receba vagas como estas no seu e-mail",
        cta_sub="Alertas grátis por profissão e cidade. No máximo 2 e-mails por dia.",
        most="Mais procuradas", links="Links na legenda", badge_weekend="Fim de semana", badge_day="Ontem",
        when_weekend="no fim de semana", when_day="ontem", area="Saúde", country="Portugal",
        ig_apply="🔗 Candidate-se pelo link na bio.", ig_alert="🔔 Receba alertas grátis: {url}",
        fb_head="As vagas de saúde mais procuradas {when} no VagaSaúde 👇",
        fb_alert="🔔 Receba vagas como estas no seu e-mail: {url}",
        tg_see="Ver vaga e candidatar-se", tg_alert="Alertas grátis por e-mail",
        tg_whatsapp="Também no nosso canal de WhatsApp", wa_alert="🔔 Alertas grátis: {url}",
        wa_telegram="📲 Também no Telegram: {url}",
        secondary={"Administrativo", "Gestão", "Gestão & suporte", "Outros"},
        nonclin=r"banco de talentos|cadastro (de )?reserva|banco de curr|aprendiz|estagi|est[aá]gio|"
                r"cozinh|copeir|porteir|vigilant|eletricist|manuten|motorista|pedreir"),
    "es": dict(
        cover="Las ofertas de empleo sanitario más vistas", count="{n} oportunidades en {where}", conj=" y ",
        apply_bio="Inscríbete con el enlace de la bio", cta="Recibe ofertas como estas en tu email",
        cta_sub="Alertas gratuitas por profesión y ciudad.",
        most="Más vistas", links="Enlaces en la descripción", badge_weekend="Fin de semana", badge_day="Ayer",
        when_weekend="el fin de semana", when_day="ayer", area="Sanidad", country="España",
        ig_apply="🔗 Inscríbete con el enlace de la bio.", ig_alert="🔔 Alertas gratuitas: {url}",
        fb_head="Las ofertas de empleo sanitario más vistas {when} en VacantesSalud 👇",
        fb_alert="🔔 Recibe ofertas como estas en tu email: {url}",
        tg_see="Ver la oferta e inscribirse", tg_alert="Alertas gratuitas por email",
        tg_whatsapp="También en nuestro canal de WhatsApp", wa_alert="🔔 Alertas gratuitas: {url}",
        wa_telegram="📲 También en Telegram: {url}",
        secondary={"Gestión y apoyo", "Administrativo", "Otros"},
        nonclin=r"bolsa de (empleo|trabajo)|pr[aá]cticas|becari|limpieza|cocin|celador|conductor|"
                r"mantenimiento|vigilant|recepcionista|administrativ|comercial|teleoperador"),
    "it": dict(
        cover="Le offerte di lavoro in sanità più viste", count="{n} opportunità in {where}", conj=" e ",
        apply_bio="Candidati dal link in bio", cta="Ricevi offerte come queste via email",
        cta_sub="Avvisi gratuiti per professione e città.",
        most="Più viste", links="Link nella didascalia", badge_weekend="Weekend", badge_day="Ieri",
        when_weekend="nel fine settimana", when_day="ieri", area="Sanità", country="Italia",
        ig_apply="🔗 Candidati dal link in bio.", ig_alert="🔔 Avvisi gratuiti: {url}",
        fb_head="Le offerte di lavoro in sanità più viste {when} su OfferteSanità 👇",
        fb_alert="🔔 Ricevi offerte come queste via email: {url}",
        tg_see="Vedi l'offerta e candidati", tg_alert="Avvisi gratuiti via email",
        tg_whatsapp="Anche sul nostro canale WhatsApp", wa_alert="🔔 Avvisi gratuiti: {url}",
        wa_telegram="📲 Anche su Telegram: {url}",
        secondary={"Gestione e supporto", "Amministrativo", "Altro"},
        nonclin=r"tirocin|stage\b|pulizi|cucin|autist|manutenz|portier|vigilan|amministrativ|"
                r"commercial|receptionist|centralinist"),
}
L = LANG["pt"]


def configure(market: str) -> None:
    global M, L, SITE, DOMAIN, CONFIG, TELEGRAM_CHANNEL, WHATSAPP_CHANNEL, JOB_PREFIX, NONCLIN, SECONDARY
    M = MARKETS[market]
    L = LANG[M.get("lang", "pt")]
    SITE = M["site"]
    DOMAIN = SITE.split("//", 1)[1]
    CONFIG = Path.home() / ".config" / "vagasaude" / M["config"]
    TELEGRAM_CHANNEL, WHATSAPP_CHANNEL = M["telegram"], M["whatsapp"]
    JOB_PREFIX = M.get("job_prefix", "/vagas/")
    NONCLIN = re.compile(L["nonclin"], re.I)
    SECONDARY = L["secondary"]

NAVY, TEAL, TEAL_LIGHT = "#072f5f", "#16a6aa", "#3fc9c9"
PILL_BG, PILL_FG = "#e3f4f4", "#0f7e82"
INK2, INK3, MUTED = "#29486e", "#5c7290", "#7b8fa8"

UF = {
    "acre": "AC", "alagoas": "AL", "amapá": "AP", "amazonas": "AM", "bahia": "BA", "ceará": "CE",
    "distrito federal": "DF", "espírito santo": "ES", "goiás": "GO", "maranhão": "MA", "mato grosso": "MT",
    "mato grosso do sul": "MS", "minas gerais": "MG", "pará": "PA", "paraíba": "PB", "paraná": "PR",
    "pernambuco": "PE", "piauí": "PI", "rio de janeiro": "RJ", "rio grande do norte": "RN",
    "rio grande do sul": "RS", "rondônia": "RO", "roraima": "RR", "santa catarina": "SC",
    "são paulo": "SP", "sergipe": "SE", "tocantins": "TO",
}
ANON = re.compile(r"confidencial|anunciante|sigilo|an[oô]nim|n[aã]o informad|riservat", re.I)
NONCLIN = re.compile(LANG["pt"]["nonclin"], re.I)
SECONDARY = LANG["pt"]["secondary"]
SMALL = {"de", "da", "do", "das", "dos", "e", "em", "para", "com", "a", "o", "na", "no", "ou"}
SMALL_BY_LANG = {
    "pt": SMALL,
    "es": {"de", "del", "y", "e", "o", "u", "la", "el", "los", "las", "en", "con", "para", "por", "a", "al"},
    "it": {"di", "e", "ed", "o", "a", "da", "in", "con", "per", "il", "lo", "la", "i", "gli", "le",
           "del", "della", "dei", "delle", "al", "alla", "nel", "nella"},
}
ACCENTS = {
    "tecnico": "técnico", "tecnica": "técnica", "farmaceutico": "farmacêutico", "farmaceutica": "farmacêutica",
    "farmacia": "farmácia", "internacao": "internação", "educacao": "educação", "nutricao": "nutrição",
    "saude": "saúde", "clinica": "clínica", "clinico": "clínico", "medico": "médico", "medica": "médica",
    "psicologo": "psicólogo", "psicologa": "psicóloga", "fonoaudiologo": "fonoaudiólogo",
    "fonoaudiologa": "fonoaudióloga", "laboratorio": "laboratório", "analises": "análises",
    "hemodialise": "hemodiálise", "cirurgico": "cirúrgico", "cirurgica": "cirúrgica", "pediatrico": "pediátrico",
    "pediatrica": "pediátrica", "obstetrico": "obstétrico", "assistencia": "assistência",
    "radiologico": "radiológico", "odontologico": "odontológico", "higienizacao": "higienização",
    "recepcao": "recepção", "urgencia": "urgência", "emergencia": "emergência", "obstetricia": "obstetrícia",
    "veterinario": "veterinário", "veterinaria": "veterinária", "biomedico": "biomédico", "biomedica": "biomédica",
}


# ---------------------------------------------------------------- dados

def load_json(path: Path, default):
    try:
        return json.loads(path.read_text("utf-8"))
    except FileNotFoundError:
        return default


def load_env(path: Path) -> dict[str, str]:
    env = {}
    for line in path.read_text("utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def window(day: date) -> tuple[list[str], bool]:
    """Os 2 dias UTC completos antes de `day`. À segunda-feira são sábado e domingo."""
    return [(day - timedelta(days=d)).isoformat() for d in (2, 1)], day.weekday() == 0


def parse_dt(value) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def pick_jobs(root: Path, day: date, state: dict, n: int = 4) -> tuple[list[dict], bool]:
    data = root / "data"
    stats = load_json(data / "site-stats.json", {"days": {}}).get("days", {})
    raw = load_json(data / "jobs.json", [])
    jobs = raw["jobs"] if isinstance(raw, dict) else raw
    by_slug: dict[str, dict] = {}
    for j in jobs:
        if j.get("slug") and j.get("status") == "published":
            by_slug.setdefault(j["slug"], j)

    days, weekend = window(day)
    score: dict[str, int] = {}
    for d in days:
        st = stats.get(d, {})
        for path, views in st.get("paths", {}).items():
            if path.startswith(JOB_PREFIX):
                slug = path[len(JOB_PREFIX):].strip("/")
                if slug in by_slug:
                    score[slug] = score.get(slug, 0) + int(views)
        for slug, clicks in st.get("applyBySlug", {}).items():
            if slug in by_slug:
                score[slug] = score.get(slug, 0) + 3 * int(clicks)

    now = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
    recent_cut = (day - timedelta(days=7)).isoformat()
    used = {s for s, d in state.get("posted", {}).items() if d >= recent_cut}

    def eligible(j: dict, max_age: int) -> bool:
        published = parse_dt(j.get("publishedAt")) or parse_dt(j.get("createdAt"))
        return (published is not None and now - published <= timedelta(days=max_age)
                and j["slug"] not in used
                and bool(j.get("company"))
                and not ANON.search(j.get("company") or "")
                and not NONCLIN.search(j.get("title") or ""))

    ranked = sorted((s for s in score if eligible(by_slug[s], 14)),
                    key=lambda s: (by_slug[s].get("profession") in SECONDARY, -score[s]))
    # reserva: as mais recentes (≤ 3 dias) quando há poucas vagas com sinal
    fresh = sorted((s for s, j in by_slug.items() if s not in score and eligible(j, 3)
                    and j.get("profession") not in SECONDARY),
                   key=lambda s: by_slug[s].get("publishedAt") or "", reverse=True)

    picked, companies, professions = [], set(), set()
    for slug in ranked + fresh:
        j = by_slug[slug]
        if j.get("company") in companies or j.get("profession") in professions:
            continue
        picked.append({**j, "_score": score.get(slug, 0)})
        companies.add(j.get("company"))
        professions.add(j.get("profession"))
        if len(picked) == n:
            break
    return picked, weekend


# ---------------------------------------------------------------- texto

def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


def smart_case(text: str) -> str:
    """Títulos em maiúsculas → caixa normal, com os acentos mais comuns repostos."""
    if text != text.upper():
        return text
    lang = M.get("lang", "pt")
    small = SMALL_BY_LANG[lang]
    accents = ACCENTS if lang == "pt" else {}
    words = []
    for i, w in enumerate(text.lower().split()):
        core = re.sub(r"[^\wÀ-ÿ]", "", w)
        if core and len(core) <= 3 and core.isalpha() and core not in small and core not in accents:
            words.append(w.upper())          # siglas: PS, SAE, PL, UTI, CME, SUS…
            continue
        if core:
            w = w.replace(core, accents.get(core, core))
        words.append(w if (i and core in small) else w[:1].upper() + w[1:])
    return " ".join(words)


GENDER_RE = re.compile(r"\s*\(?\b(?:m\s*/\s*f|f\s*/\s*m|h\s*/\s*m|m\s*/\s*h)\b\.?\)?", re.I)   # «(m/f)»: o «/a» já cobre o género
LEAD_CODE_RE = re.compile(r"^\d{4,}\s*[-–—:]\s*")                                                   # «2298255 – Técnico…»
LEAD_VERB_RE = re.compile(r"^(?:recrutamos|recruta|precisamos de|procuramos|contratamos|buscamos|"
                          r"seleccionamos|selecionamos|cerchiamo|ricerchiamo|selezioniamo)\s+(?:um[a]?\s+|un[a]?\s+)?", re.I)


def clean_title(title: str, company: str, city: str = "", district: str = "") -> str:
    t = re.sub(r"^\(\w{1,4}\)\s*", "", title or "").strip()       # "(DC) Farmacêutico…"
    t = GENDER_RE.sub("", t)
    t = LEAD_CODE_RE.sub("", t)
    t = LEAD_VERB_RE.sub("", t).strip()
    t = t.split("|")[0].strip()                                     # "… | Blumenau/SC"
    t = smart_case(t)
    t = re.sub(r"\b[A-ZÀ-Ý]{5,}\b", lambda m: m.group(0).capitalize(), t)   # «ENFERMEIRO» a meio de um título normal
    parts = re.split(r"\s+[-–]\s+", t)
    comp = strip_accents(company or "")
    where = {strip_accents(x) for x in (city, district) if x}
    parts = [p for k, p in enumerate(parts)
             if k == 0 or (strip_accents(p)[:12] not in comp                                                  # tira "- Empresa"
                           and strip_accents(re.sub(r"\s*[/(]\s*[A-Za-z]{2}\)?$", "", p)).strip() not in where)]  # e "- Cidade"
    t = " – ".join(parts).strip()
    t = t[:1].upper() + t[1:]
    if len(t) <= 70:
        return t
    cut = t[:68]
    cut = cut.rsplit(" ", 1)[0] if " " in cut[40:] or cut[68:69] != " " and " " in cut[30:] else cut
    return re.sub(r"[\s\-–—:,;(]+$", "", cut) + "…"


def clean_company(company: str) -> str:
    c = smart_case((company or "").strip())
    if len(c) > 32:
        c = re.sub(r"\s*\(.*?\)", "", c).strip()
    return c if len(c) <= 40 else c[:37].rstrip() + "…"


def place(j: dict) -> str:
    city = (j.get("locationConcelho") or "").strip()
    if M is not MARKETS["br"]:
        return city or (j.get("locationDistrict") or "").strip() or L["country"]
    uf = UF.get((j.get("locationDistrict") or "").strip().lower(), "")
    return f"{city}/{uf}" if city and uf else city or (j.get("locationDistrict") or "Brasil")


def job_link(slug: str, source: str, campaign: str) -> str:
    return f"{SITE}{JOB_PREFIX}{slug}?utm_source={source}&utm_medium=social&utm_campaign={campaign}"


# ---------------------------------------------------------------- imagens

def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(ASSETS / "fonts" / f"Outfit-{weight}.ttf"), size)


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt, width: int) -> list[str]:
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=fnt) <= width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def text_block(draw, xy, text, fnt, fill, width, line_h) -> int:
    x, y = xy
    for line in wrap(draw, text, fnt, width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += line_h
    return y


def pill(draw, xy, text, fnt, bg, fg, pad=(30, 14)) -> tuple[int, int]:
    x, y = xy
    w = draw.textlength(text, font=fnt) + 2 * pad[0]
    asc, desc = fnt.getmetrics()
    h = asc + desc + 2 * pad[1]
    draw.rounded_rectangle((x, y, x + w, y + h), radius=h / 2, fill=bg)
    draw.text((x + pad[0], y + pad[1]), text, font=fnt, fill=fg)
    return int(w), int(h)


def paste_logo(img: Image.Image, dark: bool, xy, height: int) -> None:
    suffix = f"-{M['logo']}" if M.get("logo") else ""        # BR/PT: logo VagaSaúde; es/it: a marca local
    logo = Image.open(ASSETS / f"logo-{'dark' if dark else 'light'}{suffix}.png").convert("RGBA")
    logo = logo.resize((round(logo.width * height / logo.height), height), Image.LANCZOS)
    img.alpha_composite(logo, xy)


def deco_cross(img: Image.Image) -> None:
    """Cruz grande e discreta no canto superior direito (elemento da marca)."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s, ox, oy = 5.2, img.width - 520 + 90, -90
    pts = [(38, 4), (62, 4), (62, 38), (96, 38), (96, 62), (62, 62), (62, 96), (38, 96), (38, 62), (4, 62), (4, 38), (38, 38)]
    d.polygon([(ox + x * s, oy + y * s) for x, y in pts], fill=(22, 166, 170, 46))
    img.alpha_composite(layer)


def pin(draw, x, y, size, color) -> None:
    r = size * 0.32
    cx = x + size / 2
    draw.ellipse((cx - r, y, cx + r, y + 2 * r), fill=color)
    draw.polygon([(cx - r * 0.85, y + r * 1.4), (cx + r * 0.85, y + r * 1.4), (cx, y + size)], fill=color)
    draw.ellipse((cx - r * 0.4, y + r * 0.6, cx + r * 0.4, y + r * 1.4), fill="#ffffff")


def slide_cover(badge: str, states: str, total: int) -> Image.Image:
    img = Image.new("RGBA", (1080, 1350), NAVY)
    deco_cross(img)
    d = ImageDraw.Draw(img)
    paste_logo(img, True, (84, 84), 78)
    _, h = pill(d, (84, 400), badge, font("SemiBold", 34), TEAL, "#ffffff")
    y = text_block(d, (84, 400 + h + 40), L["cover"], font("Bold", 104), "#ffffff", 912, 108)
    text_block(d, (84, y + 30), L["count"].format(n=total, where=states), font("Regular", 42), "#cfe6ef", 912, 52)
    d.text((84, 1350 - 84 - 46), M["swipe"], font=font("Regular", 36), fill="#9fd9db")
    return img


# Cartão de vaga (como o JobCard do site): fundo claro, ícone, título, «Empresa · Local» e etiquetas.
BG, LINE, INK, PRIMARY = "#f8fafc", "#e2e8f0", "#0f172a", "#0f766e"
SLATE, SURFACE2, OK, OK_SOFT = "#475569", "#f1f5f9", "#11744a", "#e7f6ee"
CHIP_STYLE = {"primary": (PILL_BG, PRIMARY), "plain": (SURFACE2, SLATE), "salary": (OK_SOFT, OK)}
SECTOR_LABELS = {
    "pt": {"publico": "Público", "privado": "Privado", "ipss": "Social (IPSS)"},
    "br": {"publico": "Público", "privado": "Privado", "ipss": "Filantrópico"},
    "es": {"publico": "Público", "privado": "Privado", "concertado": "Concertado"},
    "it": {"pubblico": "Pubblico", "privato": "Privato", "accreditato": "Accreditato"},
}
NO_VALUE = re.compile(r"a definir|a combinar|n[aã]o (informad|indicad)|no indicad|sin especificar|"
                      r"non (indicat|specificat)|da definire|convenio|convenzione|n/?d\b|^\W*$|^contrat[oa]?$|^contract$", re.I)


def real_salary(value) -> str:
    """Salário só se tiver valor numérico (sem «A combinar», «Según convenio»…)."""
    v = re.sub(r"\s+", " ", str(value or "")).strip()
    return v if v and re.search(r"\d", v) and not NO_VALUE.search(v) else ""


def job_chips(j: dict) -> list[tuple[str, str]]:
    """[(tipo, texto)]: área profissional, contrato (ou, sem contrato, o setor) e salário real (a verde)."""
    market = next(k for k, v in MARKETS.items() if v is M)
    chips = []
    area = (j.get("profession") or "").strip()
    if area:
        chips.append(("primary", area))
    contract = re.sub(r"\s+", " ", str(j.get("contractType") or "")).strip()
    if contract and len(contract) <= 30 and not NO_VALUE.search(contract):
        chips.append(("plain", contract))
    else:
        sector = SECTOR_LABELS[market].get((j.get("sector") or "").strip().lower())
        if sector:
            chips.append(("plain", sector))
    sal = real_salary(j.get("salary"))
    if sal:
        chips.append(("salary", sal if len(sal) <= 34 else sal[:33].rstrip() + "…"))
    return chips


def fit_text(draw, text: str, fnt, width: int) -> str:
    if draw.textlength(text, font=fnt) <= width:
        return text
    while text and draw.textlength(text + "…", font=fnt) > width:
        text = text[:-1]
    if " " in text.strip():                                  # corta em palavra inteira, nunca a meio
        text = text.rsplit(" ", 1)[0]
    return re.sub(r"[\s\-–—:,;(/]+$", "", text) + "…"


def title_lines(draw, title: str, fnt, width: int, max_lines: int) -> list[str]:
    """Quebra o título; só os muito longos passam de `max_lines` e ficam com «…» (sem cortes a meio da palavra)."""
    lines = wrap(draw, title, fnt, width)
    if len(lines) <= max_lines:
        return lines
    return lines[:max_lines - 1] + [fit_text(draw, " ".join(lines[max_lines - 1:]), fnt, width)]


def cross_icon(img: Image.Image, x: int, y: int, size: int) -> None:
    """Ícone do cartão: cruz verde-azulada num quadrado arredondado suave (como .job-ico do site)."""
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((x, y, x + size, y + size), radius=round(size * 0.26), fill=PILL_BG)
    c, arm, thick = size / 2, size * 0.56, size * 0.22
    r = round(thick * 0.28)
    d.rounded_rectangle((x + c - arm / 2 - 0, y + c - thick / 2, x + c + arm / 2, y + c + thick / 2), radius=r, fill=PRIMARY)
    d.rounded_rectangle((x + c - thick / 2, y + c - arm / 2, x + c + thick / 2, y + c + arm / 2), radius=r, fill=PRIMARY)


def draw_chips(draw, x: int, y: int, width: int, chips, size: int, max_rows: int = 1, gap: int = 10) -> int:
    """Chips arredondados em linha(s); o que não couber nas `max_rows` linhas é omitido. Devolve a altura usada."""
    fnt = font("SemiBold", size)
    pad = (round(size * 0.55), round(size * 0.3))
    asc, desc = fnt.getmetrics()
    h = asc + desc + 2 * pad[1]
    cx, row = x, 0
    for kind, text in chips:
        text = fit_text(draw, text, fnt, width - 2 * pad[0])
        w = round(draw.textlength(text, font=fnt)) + 2 * pad[0]
        if cx > x and cx + w > x + width:
            row += 1
            cx = x
            if row >= max_rows:
                break
        bg, fg = CHIP_STYLE[kind]
        draw.rounded_rectangle((cx, y + row * (h + gap), cx + w, y + row * (h + gap) + h), radius=h / 2, fill=bg)
        draw.text((cx + pad[0], y + row * (h + gap) + pad[1]), text, font=fnt, fill=fg)
        cx += w + gap
    return (row + 1) * h + row * gap if chips else 0


def chips_height(size: int) -> int:
    asc, desc = font("SemiBold", size).getmetrics()
    return asc + desc + 2 * round(size * 0.3)


def header(img: Image.Image, logo_h: int, x0: int, y0: int, size: int = 28) -> None:
    """Cabeçalho comum: logótipo à esquerda e selo «Mais procuradas» à direita."""
    d = ImageDraw.Draw(img)
    paste_logo(img, False, (x0, y0), logo_h)
    fp = font("SemiBold", size)
    w = d.textlength(L["most"], font=fp) + 2 * round(size * 0.85)
    asc, desc = fp.getmetrics()
    h = asc + desc + 2 * round(size * 0.4)
    pill(d, (round(img.width - x0 - w), y0 + (logo_h - h) // 2), L["most"], fp, PRIMARY, "#ffffff",
         pad=(round(size * 0.85), round(size * 0.4)))


def slide_job(i: int, total: int, job: dict) -> Image.Image:
    img = Image.new("RGBA", (1080, 1350), BG)
    d = ImageDraw.Draw(img)
    header(img, 60, 84, 84, 30)
    cx0, cx1, pad = 70, 1010, 56                     # cartão (como .job-card, em ponto grande)
    inner = cx1 - cx0 - 2 * pad
    ft, fs = font("Bold", 68), font("Regular", 42)
    t_lines = title_lines(d, job["title"], ft, inner, 3)
    sub_all = wrap(d, f"{job['company']} · {job['place']}", fs, inner)
    sub_lines = sub_all[:2]
    if len(sub_all) > 2:
        sub_lines[1] = fit_text(d, " ".join(sub_all[1:]), fs, inner)
    ico, chip_sz, rows = 150, 34, 2
    rows = 1 if sum(round(d.textlength(t, font=font("SemiBold", chip_sz))) + 40 + 12 for _, t in job["chips"]) <= inner else 2
    body_h = ico + 44 + 78 * len(t_lines) + 14 + 54 * len(sub_lines) + 30
    chips_h = (chips_height(chip_sz) + 12) * rows - 12
    card_h = pad + body_h + chips_h + pad
    top = 230 + max(0, (1120 - 230 - card_h) // 2)
    d.rounded_rectangle((cx0, top, cx1, top + card_h), radius=40, fill="#ffffff", outline=LINE, width=3)
    x, y = cx0 + pad, top + pad
    cross_icon(img, x, y, ico)
    cnt = f"{i}/{total}"
    fc = font("Regular", 36)
    d.text((cx1 - pad - d.textlength(cnt, font=fc), y + 8), cnt, font=fc, fill=MUTED)
    y += ico + 44
    for line in t_lines:
        d.text((x, y), line, font=ft, fill=INK)
        y += 78
    y += 14
    for line in sub_lines:
        d.text((x, y), line, font=fs, fill=SLATE)
        y += 54
    y += 30
    draw_chips(d, x, y, inner, job["chips"], chip_sz, max_rows=rows, gap=12)
    d.rectangle((0, 1150, 1080, 1350), fill=NAVY)
    d.text((84, 1186), L["apply_bio"], font=font("SemiBold", 40), fill="#ffffff")
    d.text((84, 1254), DOMAIN, font=font("Regular", 34), fill=TEAL_LIGHT)
    return img


def slide_cta() -> Image.Image:
    img = Image.new("RGBA", (1080, 1350), NAVY)
    deco_cross(img)
    d = ImageDraw.Draw(img)
    paste_logo(img, True, (84, 84), 78)
    y = text_block(d, (84, 420), L["cta"], font("Bold", 96), "#ffffff", 912, 100)
    text_block(d, (84, y + 40), L["cta_sub"], font("Regular", 44), "#cfe6ef", 912, 56)
    pill(d, (84, 1350 - 84 - 76), f"{DOMAIN}{M.get('alerts', '/alertas')}", font("SemiBold", 34), TEAL, "#ffffff")
    return img


def square(jobs: list[dict], heading: str) -> Image.Image:
    img = Image.new("RGBA", (1080, 1080), BG)
    d = ImageDraw.Draw(img)
    header(img, 56, 60, 44, 26)
    fh = font("Bold", 52)
    y = text_block(d, (60, 128), heading, fh, INK, 960, 58) + 14
    ft, fs, cs = font("Bold", 36), font("Regular", 28), 22
    x_ico, ico, pad_x, pad_y, gap = 60, 84, 20, 16, 12
    tx = x_ico + pad_x + ico + 20
    tw = 1020 - 20 - tx
    t_h, s_h, c_h = 42, 36, chips_height(cs)
    base = pad_y + t_h + 2 + s_h + 8 + c_h + pad_y
    # Cada título começa com 1 linha; os mais longos ganham a 2.ª enquanto houver espaço acima do rodapé.
    footer_top = 1080 - 56
    spare = footer_top - 14 - (y + len(jobs) * base + (len(jobs) - 1) * gap)
    full = [wrap(d, j["title"], ft, tw) for j in jobs]
    n_lines = [1] * len(jobs)
    for k, ln in enumerate(full):
        if len(ln) > 1 and spare >= t_h:
            n_lines[k], spare = 2, spare - t_h
    for k, j in enumerate(jobs):
        lines = title_lines(d, j["title"], ft, tw, n_lines[k])
        h = base + t_h * (len(lines) - 1)
        d.rounded_rectangle((60, y, 1020, y + h), radius=24, fill="#ffffff", outline=LINE, width=2)
        cross_icon(img, x_ico + pad_x, y + (h - ico) // 2, ico)
        ty = y + pad_y
        for line in lines:
            d.text((tx, ty), line, font=ft, fill=INK)
            ty += t_h
        d.text((tx, ty + 2), fit_text(d, f"{j['company']} · {j['place']}", fs, tw), font=fs, fill=SLATE)
        draw_chips(d, tx, ty + 2 + s_h + 8, tw, j["chips"], cs, max_rows=1, gap=8)
        y += h + gap
    fd = font("SemiBold", 28)
    d.text((540 - d.textlength(DOMAIN, font=fd) / 2, 1080 - 50), DOMAIN, font=fd, fill=PRIMARY)
    return img


# ---------------------------------------------------------------- pacote

def build_package(root: Path, day: date, dry_run: bool) -> Path | None:
    state_path = root / "data" / "social-state.json"
    state = load_json(state_path, {"posted": {}})
    picked, weekend = pick_jobs(root, day, state)
    if len(picked) < 3:
        print(f"[social] {day}: só {len(picked)} vagas elegíveis — sem post hoje")
        return None
    campaign = f"top-vagas-{day.isoformat()}"
    jobs = [{"slug": j["slug"], "title": clean_title(j.get("title", ""), j.get("company", ""), j.get("locationConcelho") or "",
                                  j.get("locationDistrict") or ""),
             "company": clean_company(j.get("company", "")), "place": place(j),
             "chips": job_chips(j), "chips_text": [t for _, t in job_chips(j)],
             "area": j.get("profession") or L["area"], "score": j["_score"],
             "region": (place(j).split("/")[-1] if M is MARKETS["br"] else (j.get("locationDistrict") or "").strip())}
            for j in picked]
    when = L["when_weekend"] if weekend else L["when_day"]
    heading = f"{L['cover']} {when}"
    ufs = sorted({j["region"] for j in jobs if j["region"]})
    states = (", ".join(ufs[:-1]) + f"{L['conj']}{ufs[-1]}") if len(ufs) > 1 else (ufs[0] if ufs else M["everywhere"])

    out = root / "data" / "social" / day.isoformat()
    out.mkdir(parents=True, exist_ok=True)
    slides = [slide_cover(L["badge_weekend"] if weekend else L["badge_day"], states, len(jobs))]
    slides += [slide_job(i, len(jobs), j) for i, j in enumerate(jobs, 1)] + [slide_cta()]
    for i, img in enumerate(slides, 1):
        img.convert("RGB").save(out / f"ig-{i}.png", optimize=True)
    square(jobs, heading).convert("RGB").save(out / "square.png", optimize=True)

    lines = "".join(f"{k}. {j['title']} – {j['company']} ({j['place']})\n" for k, j in enumerate(jobs, 1))
    tags = " ".join(sorted({"#" + strip_accents(j["area"]).replace(" ", "") for j in jobs}))
    alerts_path = M.get("alerts", "/alertas")
    alert = f"{SITE}{alerts_path}?utm_medium=social&utm_campaign={campaign}&utm_source="
    head = f"{L['cover']} {when}"
    texts = {
        "instagram.txt": f"{head} 👇\n\n{lines}\n{L['ig_apply']}\n"
                         f"{L['ig_alert'].format(url=DOMAIN + alerts_path)}\n\n{M['tags']} {tags}",
        "facebook.txt": L["fb_head"].format(when=when) + "\n\n"
                        + "".join(f"{k}. {j['title']} – {j['company']} ({j['place']})\n👉 {job_link(j['slug'], 'facebook', campaign)}\n\n"
                                  for k, j in enumerate(jobs, 1))
                        + L["fb_alert"].format(url=f"{alert}facebook"),
        "telegram.html": f"<b>{head}</b> 👇\n\n"
                         + "".join(f"{k}. <b>{html.escape(j['title'])}</b>\n{html.escape(j['company'])} · {html.escape(j['place'])}\n"
                                   + (html.escape(" · ".join(j["chips_text"])) + "\n" if j["chips_text"] else "")
                                   + f"<a href=\"{job_link(j['slug'], 'telegram', campaign)}\">{L['tg_see']}</a>\n\n"
                                   for k, j in enumerate(jobs, 1))
                         + f"🔔 <a href=\"{alert}telegram\">{L['tg_alert']}</a>"
                         + (f"\n💬 <a href=\"{WHATSAPP_CHANNEL}\">{L['tg_whatsapp']}</a>" if WHATSAPP_CHANNEL else ""),
        "whatsapp.txt": f"*{head}* 👇\n\n"
                        + "".join(f"*{j['title']}*\n{j['company']} · {j['place']}\n" + (" · ".join(j["chips_text"]) + "\n" if j["chips_text"] else "") + f"{job_link(j['slug'], 'whatsapp', campaign)}\n\n" for j in jobs)
                        + L["wa_alert"].format(url=DOMAIN + alerts_path) + "\n"
                        + L["wa_telegram"].format(url=TELEGRAM_CHANNEL),
    }
    for name, body in texts.items():
        (out / name).write_text(body, "utf-8")
    (out / "picks.json").write_text(json.dumps(jobs, ensure_ascii=False, indent=1), "utf-8")

    if not dry_run:
        posted = state.setdefault("posted", {})
        for j in jobs:
            posted[j["slug"]] = day.isoformat()
        cut = (day - timedelta(days=30)).isoformat()
        state["posted"] = {s: d for s, d in posted.items() if d >= cut}
        tmp = state_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(state, ensure_ascii=False, indent=1), "utf-8")
        os.replace(tmp, state_path)
    for old in (root / "data" / "social").iterdir():          # guardar só 30 dias de pacotes
        if old.is_dir() and old.name < (day - timedelta(days=30)).isoformat():
            shutil.rmtree(old, ignore_errors=True)
    print(f"[social] {day}: pacote em {out} — " + " | ".join(f"{j['title']} ({j['score']})" for j in jobs))
    return out


# ---------------------------------------------------------------- entrega e publicação

def deliver_email(root: Path, out: Path, day: date) -> None:
    import httpx

    env = load_env(root / ".env.production")
    if not WHATSAPP_CHANNEL:
        print("[social] e-mail: mercado sem canal de WhatsApp — nada a enviar")
        return
    key, sender, to = env.get("RESEND_API_KEY"), env.get("EMAIL_FROM"), env.get("ALERTS_TO")
    if not (key and sender and to):
        print("[social] e-mail: falta RESEND_API_KEY/EMAIL_FROM/ALERTS_TO — pacote não enviado")
        return
    jobs = json.loads((out / "picks.json").read_text("utf-8"))
    box = "white-space:pre-wrap;background:#f4f6f8;padding:12px;border-radius:8px"
    pre = lambda name: f"<pre style='{box}'>{html.escape((out / name).read_text('utf-8'))}</pre>"
    body = (f"<p>Pacote do dia {day.strftime('%d/%m')} para o {M['label']}. Os canais automáticos "
            f"publicam sozinhos às 8h ({M['tz']}).</p>"
            f"<p><b>Canal de WhatsApp (manual):</b> anexar <i>square.png</i> e colar este texto:</p>{pre('whatsapp.txt')}")
    files = ["square.png"]
    payload = {
        "from": sender, "to": [to],
        "subject": f"Post do dia {M['label']} — {day.strftime('%d/%m')} ({len(jobs)} vagas)",
        "html": body,
        "attachments": [{"filename": f, "content": base64.b64encode((out / f).read_bytes()).decode()} for f in files],
    }
    r = httpx.post("https://api.resend.com/emails", json=payload, headers={"Authorization": f"Bearer {key}"}, timeout=60)
    print(f"[social] e-mail do pacote: HTTP {r.status_code}" + ("" if r.status_code < 300 else f" — {r.text[:200]}"))


CHANNELS = ("telegram", "facebook", "instagram")


def _graph(httpx, ver: str, method: str, path: str, **kw) -> dict:
    r = httpx.request(method, f"https://graph.facebook.com/{ver}/{path}", timeout=120, **kw)
    data = r.json()
    if r.status_code >= 300 or "error" in data:
        raise RuntimeError(f"{path}: HTTP {r.status_code} — {str(data.get('error', data))[:200]}")
    return data


def publish_telegram(httpx, out: Path, tg: dict) -> str:
    with open(out / "square.png", "rb") as fh:
        r = httpx.post(f"https://api.telegram.org/bot{tg['bot_token']}/sendPhoto",
                       data={"chat_id": tg["chat_id"], "caption": (out / "telegram.html").read_text("utf-8"),
                             "parse_mode": "HTML"}, files={"photo": fh}, timeout=60)
    if r.status_code >= 300:
        raise RuntimeError(f"HTTP {r.status_code} — {r.text[:200]}")
    return str(r.json().get("result", {}).get("message_id"))


def publish_facebook(httpx, out: Path, fb: dict) -> str:
    with open(out / "square.png", "rb") as fh:
        d = _graph(httpx, fb["graph_version"], "POST", f"{fb['page_id']}/photos",
                   data={"message": (out / "facebook.txt").read_text("utf-8"), "access_token": fb["page_token"]},
                   files={"source": fh})
    return d.get("post_id") or d.get("id", "")


def publish_instagram(httpx, out: Path, fb: dict, ig: dict) -> str:
    """Carrossel. A API do Instagram só aceita imagens por URL público: carregamos cada imagem na página
    como foto NÃO publicada, usamos o URL do CDN da Meta e apagamos essas fotos no fim."""
    import time

    ver, token, ig_id = fb["graph_version"], fb["page_token"], ig["ig_user_id"]
    staged, children = [], []
    try:
        for img in sorted(out.glob("ig-*.png")):
            with open(img, "rb") as fh:
                ph = _graph(httpx, ver, "POST", f"{fb['page_id']}/photos",
                            data={"published": "false", "access_token": token}, files={"source": fh})
            staged.append(ph["id"])
            src = _graph(httpx, ver, "GET", ph["id"], params={"fields": "images", "access_token": token})["images"][0]["source"]
            child = _graph(httpx, ver, "POST", f"{ig_id}/media",
                           data={"image_url": src, "is_carousel_item": "true", "access_token": token})
            children.append(child["id"])
        caption = (out / "instagram.txt").read_text("utf-8")
        parent = _graph(httpx, ver, "POST", f"{ig_id}/media",
                        data={"media_type": "CAROUSEL", "children": ",".join(children), "caption": caption,
                              "access_token": token})
        for _ in range(30):                                   # o Instagram processa as imagens antes de publicar
            st = _graph(httpx, ver, "GET", parent["id"], params={"fields": "status_code", "access_token": token})
            if st.get("status_code") == "FINISHED":
                break
            if st.get("status_code") == "ERROR":
                raise RuntimeError("o Instagram recusou o carrossel (status ERROR)")
            time.sleep(5)
        return _graph(httpx, ver, "POST", f"{ig_id}/media_publish",
                      data={"creation_id": parent["id"], "access_token": token})["id"]
    finally:
        for pid in staged:                                    # limpar as fotos auxiliares da página
            try:
                _graph(httpx, ver, "DELETE", pid, params={"access_token": token})
            except Exception:
                pass


def publish(out: Path, only: set[str]) -> int:
    """Publica o pacote nos canais configurados. Cada canal só é publicado uma vez por pacote (published.json)."""
    import httpx

    cfg = load_json(CONFIG, {})
    if not cfg:
        print(f"[social] publicar: sem {CONFIG} — nada publicado")
        return 1
    done_path = out / "published.json"
    done = load_json(done_path, {})
    fb, ig, tg = cfg.get("facebook") or {}, cfg.get("instagram") or {}, cfg.get("telegram") or {}
    jobs = {
        "telegram": (lambda: publish_telegram(httpx, out, tg)) if tg.get("bot_token") and tg.get("chat_id") else None,
        "facebook": (lambda: publish_facebook(httpx, out, fb)) if fb.get("page_id") and fb.get("page_token") else None,
        "instagram": (lambda: publish_instagram(httpx, out, fb, ig)) if fb.get("page_token") and ig.get("ig_user_id") else None,
    }
    failures = 0
    for name in CHANNELS:
        if name not in only or jobs[name] is None:
            continue
        if name in done:
            print(f"[social] {name}: já publicado ({done[name]}) — ignorado")
            continue
        try:
            ref = jobs[name]()
            done[name] = ref
            done_path.write_text(json.dumps(done, indent=1), "utf-8")
            print(f"[social] {name}: publicado ({ref})")
        except Exception as exc:                              # um canal a falhar não impede os outros
            failures += 1
            print(f"[social] {name}: FALHOU — {exc}")
    return 1 if failures else 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--market", choices=sorted(MARKETS), default="br")
    ap.add_argument("--root", default=None)
    ap.add_argument("--day", default=datetime.now(timezone.utc).date().isoformat())
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--deliver", action="store_true")
    g.add_argument("--publish", action="store_true")
    g.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", default=",".join(CHANNELS), help="canais a publicar, ex.: facebook,instagram")
    a = ap.parse_args()
    configure(a.market)
    root, day = Path(a.root or M["root"]), date.fromisoformat(a.day)
    if a.publish:
        out = root / "data" / "social" / day.isoformat()
        if not (out / "square.png").exists():
            print(f"[social] publicar: não há pacote de {day}")
            return 1
        return publish(out, {c.strip() for c in a.only.split(",") if c.strip()})
    out = build_package(root, day, dry_run=a.dry_run)
    if out and a.deliver:
        deliver_email(root, out, day)
    return 0


if __name__ == "__main__":
    sys.exit(main())
