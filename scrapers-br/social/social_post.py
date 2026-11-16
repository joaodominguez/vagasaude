#!/usr/bin/env python3
"""Post diário nas redes sociais — VagaSaúde BR ("as vagas mais procuradas").

Plano: docs/REDES-SOCIAIS.md. Não mexe na app: só lê dados e escreve em data/social/.

Uso (como portal, com o venv /home/portal/.venvs/social):
  social_post.py --deliver      escolhe as vagas, gera imagens e textos e envia o pacote por e-mail ao dono
  social_post.py --publish      publica o pacote do dia nos canais configurados (Telegram, Facebook)
  social_post.py --dry-run      só gera o pacote (sem e-mail, sem publicar, sem marcar vagas como usadas)
Opções: --root /var/www/vagasaudebr  --day AAAA-MM-DD (dia do post; por omissão hoje UTC)

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
ANON = re.compile(r"confidencial|empresa anunciante|sigilo|an[oô]nim|n[aã]o informad", re.I)
NONCLIN = re.compile(r"banco de talentos|cadastro (de )?reserva|banco de curr|aprendiz|estagi|est[aá]gio|"
                     r"cozinh|copeir|porteir|vigilant|eletricist|manuten|motorista|pedreir", re.I)
SECONDARY = {"Administrativo", "Gestão", "Outros"}
SMALL = {"de", "da", "do", "das", "dos", "e", "em", "para", "com", "a", "o", "na", "no", "ou"}
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
    words = []
    for i, w in enumerate(text.lower().split()):
        core = re.sub(r"[^\wÀ-ÿ]", "", w)
        if core:
            w = w.replace(core, ACCENTS.get(core, core))
        words.append(w if (i and core in SMALL) else w[:1].upper() + w[1:])
    return " ".join(words)


def clean_title(title: str, company: str) -> str:
    t = re.sub(r"^\(\w{1,4}\)\s*", "", title or "").strip()       # "(DC) Farmacêutico…"
    t = t.split("|")[0].strip()                                     # "… | Blumenau/SC"
    t = smart_case(t)
    parts = re.split(r"\s+[-–]\s+", t)
    comp = strip_accents(company or "")
    parts = [p for k, p in enumerate(parts) if k == 0 or strip_accents(p)[:12] not in comp]  # tira "- Empresa"
    t = " – ".join(parts)
    return t if len(t) <= 70 else t[:67].rstrip() + "…"


def clean_company(company: str) -> str:
    c = smart_case((company or "").strip())
    if len(c) > 32:
        c = re.sub(r"\s*\(.*?\)", "", c).strip()
    return c if len(c) <= 40 else c[:37].rstrip() + "…"


def place(j: dict) -> str:
    city = (j.get("locationConcelho") or "").strip()
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
    logo = Image.open(ASSETS / ("logo-dark.png" if dark else "logo-light.png")).convert("RGBA")
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
    y = text_block(d, (84, 400 + h + 40), "As vagas de saúde mais procuradas", font("Bold", 104), "#ffffff", 912, 108)
    d.text((84, y + 30), f"{total} oportunidades em {states}", font=font("Regular", 42), fill="#cfe6ef")
    d.text((84, 1350 - 84 - 46), "Arraste para ver →", font=font("Regular", 36), fill="#9fd9db")
    return img


def slide_job(i: int, total: int, job: dict) -> Image.Image:
    img = Image.new("RGBA", (1080, 1350), "#ffffff")
    d = ImageDraw.Draw(img)
    paste_logo(img, False, (84, 84), 60)
    f = font("Regular", 34)
    d.text((1080 - 84 - d.textlength(f"{i}/{total}", font=f), 96), f"{i}/{total}", font=f, fill=MUTED)
    _, h = pill(d, (84, 330), job["area"], font("SemiBold", 34), PILL_BG, PILL_FG)
    y = text_block(d, (84, 330 + h + 44), job["title"], font("Bold", 88), NAVY, 912, 94)
    y = text_block(d, (84, y + 40), job["company"], font("Medium", 48), INK2, 912, 58)
    pin(d, 84, y + 22, 44, TEAL)
    d.text((140, y + 18), job["place"], font=font("Regular", 44), fill=INK3)
    d.rectangle((0, 1150, 1080, 1350), fill=NAVY)
    d.text((84, 1226), "Candidate-se pelo link na bio", font=font("SemiBold", 40), fill="#ffffff")
    f2 = font("Regular", 34)
    d.text((1080 - 84 - d.textlength("vagasaude.com.br", font=f2), 1232), "vagasaude.com.br", font=f2, fill=TEAL_LIGHT)
    return img


def slide_cta() -> Image.Image:
    img = Image.new("RGBA", (1080, 1350), NAVY)
    deco_cross(img)
    d = ImageDraw.Draw(img)
    paste_logo(img, True, (84, 84), 78)
    y = text_block(d, (84, 420), "Receba vagas como estas no seu e-mail", font("Bold", 96), "#ffffff", 912, 100)
    text_block(d, (84, y + 40), "Alertas grátis por profissão e cidade. No máximo 2 e-mails por dia.",
               font("Regular", 44), "#cfe6ef", 912, 56)
    pill(d, (84, 1350 - 84 - 76), "vagasaude.com.br/alertas", font("SemiBold", 34), TEAL, "#ffffff")
    return img


def square(jobs: list[dict], heading: str) -> Image.Image:
    img = Image.new("RGBA", (1080, 1080), "#ffffff")
    d = ImageDraw.Draw(img)
    paste_logo(img, False, (70, 70), 58)
    fp = font("SemiBold", 28)
    w = d.textlength("Mais procuradas", font=fp) + 48
    pill(d, (1080 - 70 - w, 74), "Mais procuradas", fp, TEAL, "#ffffff", pad=(24, 10))
    y = text_block(d, (70, 176), heading, font("Bold", 64), NAVY, 940, 68) + 20
    ft, fs, fn = font("Bold", 42), font("Regular", 31), font("Bold", 38)
    for k, j in enumerate(jobs, 1):
        d.line((70, y, 1010, y), fill="#e3e9f0", width=2)
        lines = wrap(d, j["title"], ft, 820)[:2]
        block_h = 46 * len(lines) + 44
        top = y + 28
        d.rounded_rectangle((70, top + block_h / 2 - 35, 140, top + block_h / 2 + 35), radius=18, fill=PILL_BG)
        d.text((105 - d.textlength(str(k), font=fn) / 2, top + block_h / 2 - 25), str(k), font=fn, fill=PILL_FG)
        ty = top
        for line in lines:
            d.text((166, ty), line, font=ft, fill=NAVY)
            ty += 46
        d.text((166, ty + 4), f"{j['company']} · {j['place']}", font=fs, fill=INK3)
        y = top + block_h + 28
    d.text((70, min(y + 22, 1080 - 70 - 40)), "Links na legenda · vagasaude.com.br", font=font("SemiBold", 32), fill=PILL_FG)
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
    jobs = [{"slug": j["slug"], "title": clean_title(j.get("title", ""), j.get("company", "")),
             "company": clean_company(j.get("company", "")), "place": place(j),
             "area": j.get("profession") or "Saúde", "score": j["_score"]} for j in picked]
    when = "no fim de semana" if weekend else "ontem"
    heading = f"As vagas de saúde mais procuradas {when}"
    ufs = sorted({j["place"].split("/")[-1] for j in jobs if "/" in j["place"]})
    states = (", ".join(ufs[:-1]) + f" e {ufs[-1]}") if len(ufs) > 1 else (ufs[0] if ufs else "todo o Brasil")

    out = root / "data" / "social" / day.isoformat()
    out.mkdir(parents=True, exist_ok=True)
    slides = [slide_cover("Fim de semana" if weekend else "Ontem", states, len(jobs))]
    slides += [slide_job(i, len(jobs), j) for i, j in enumerate(jobs, 1)] + [slide_cta()]
    for i, img in enumerate(slides, 1):
        img.convert("RGB").save(out / f"ig-{i}.png", optimize=True)
    square(jobs, heading).convert("RGB").save(out / "square.png", optimize=True)

    lines = "".join(f"{k}. {j['title']} – {j['company']} ({j['place']})\n" for k, j in enumerate(jobs, 1))
    tags = " ".join(sorted({"#" + strip_accents(j["area"]).replace(" ", "") for j in jobs}))
    alert = f"{SITE}/alertas?utm_medium=social&utm_campaign={campaign}&utm_source="
    texts = {
        "instagram.txt": f"As vagas de saúde mais procuradas {when} 👇\n\n{lines}\n🔗 Candidate-se pelo link na bio.\n"
                         f"🔔 Receba alertas grátis: vagasaude.com.br/alertas\n\n#vagasdeemprego #vagassaude #empregosaude {tags}",
        "facebook.txt": f"As vagas de saúde mais procuradas {when} no VagaSaúde 👇\n\n"
                        + "".join(f"{k}. {j['title']} – {j['company']} ({j['place']})\n👉 {job_link(j['slug'], 'facebook', campaign)}\n\n"
                                  for k, j in enumerate(jobs, 1))
                        + f"🔔 Receba vagas como estas no seu e-mail: {alert}facebook",
        "telegram.html": f"<b>As vagas de saúde mais procuradas {when}</b> 👇\n\n"
                         + "".join(f"{k}. <b>{html.escape(j['title'])}</b>\n{html.escape(j['company'])} · {html.escape(j['place'])}\n"
                                   f"<a href=\"{job_link(j['slug'], 'telegram', campaign)}\">Ver vaga e candidatar-se</a>\n\n"
                                   for k, j in enumerate(jobs, 1))
                         + f"🔔 <a href=\"{alert}telegram\">Alertas grátis por e-mail</a>\n"
                         + f"💬 <a href=\"{WHATSAPP_CHANNEL}\">Também no nosso canal de WhatsApp</a>",
        "whatsapp.txt": f"*As vagas de saúde mais procuradas {when}* 👇\n\n"
                        + "".join(f"*{j['title']}*\n{j['company']} · {j['place']}\n{job_link(j['slug'], 'whatsapp', campaign)}\n\n" for j in jobs)
                        + "🔔 Alertas grátis: vagasaude.com.br/alertas\n"
                        + f"📲 Também no Telegram: {TELEGRAM_CHANNEL}",
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
    key, sender, to = env.get("RESEND_API_KEY"), env.get("EMAIL_FROM"), env.get("ALERTS_TO")
    if not (key and sender and to):
        print("[social] e-mail: falta RESEND_API_KEY/EMAIL_FROM/ALERTS_TO — pacote não enviado")
        return
    jobs = json.loads((out / "picks.json").read_text("utf-8"))
    box = "white-space:pre-wrap;background:#f4f6f8;padding:12px;border-radius:8px"
    pre = lambda name: f"<pre style='{box}'>{html.escape((out / name).read_text('utf-8'))}</pre>"
    body = (f"<p>Pacote do dia {day.strftime('%d/%m')} para o VagaSaúde BR. Publicar às 8h (Brasília).</p>"
            f"<p><b>Canal de WhatsApp:</b> anexar <i>square.png</i> e colar este texto:</p>{pre('whatsapp.txt')}"
            f"<p><b>Instagram:</b> carrossel <i>ig-1 … ig-6.png</i> com esta legenda:</p>{pre('instagram.txt')}"
            f"<p><b>Facebook:</b> <i>square.png</i> com este texto:</p>{pre('facebook.txt')}")
    files = ["square.png"] + sorted(p.name for p in out.glob("ig-*.png"))
    payload = {
        "from": sender, "to": [to],
        "subject": f"Post do dia VagaSaúde BR — {day.strftime('%d/%m')} ({len(jobs)} vagas)",
        "html": body,
        "attachments": [{"filename": f, "content": base64.b64encode((out / f).read_bytes()).decode()} for f in files],
    }
    r = httpx.post("https://api.resend.com/emails", json=payload, headers={"Authorization": f"Bearer {key}"}, timeout=60)
    print(f"[social] e-mail do pacote: HTTP {r.status_code}" + ("" if r.status_code < 300 else f" — {r.text[:200]}"))


def publish(out: Path) -> None:
    import httpx

    cfg = load_json(CONFIG, {})
    if not cfg:
        print(f"[social] publicar: sem {CONFIG} — nada publicado")
        return
    tg = cfg.get("telegram") or {}
    if tg.get("bot_token") and tg.get("chat_id"):
        with open(out / "square.png", "rb") as fh:
            r = httpx.post(f"https://api.telegram.org/bot{tg['bot_token']}/sendPhoto",
                           data={"chat_id": tg["chat_id"], "caption": (out / "telegram.html").read_text("utf-8"),
                                 "parse_mode": "HTML"}, files={"photo": fh}, timeout=60)
        print(f"[social] telegram: HTTP {r.status_code}" + ("" if r.status_code < 300 else f" — {r.text[:200]}"))
    fb = cfg.get("facebook") or {}
    if fb.get("page_id") and fb.get("page_token"):
        ver = fb.get("graph_version", "v21.0")
        with open(out / "square.png", "rb") as fh:
            r = httpx.post(f"https://graph.facebook.com/{ver}/{fb['page_id']}/photos",
                           data={"message": (out / "facebook.txt").read_text("utf-8"), "access_token": fb["page_token"]},
                           files={"source": fh}, timeout=60)
        print(f"[social] facebook: HTTP {r.status_code}" + ("" if r.status_code < 300 else f" — {r.text[:200]}"))
    # Instagram: a API exige o URL público de cada imagem; fica para quando houver a conta (docs/REDES-SOCIAIS.md).


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="/var/www/vagasaudebr")
    ap.add_argument("--day", default=datetime.now(timezone.utc).date().isoformat())
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--deliver", action="store_true")
    g.add_argument("--publish", action="store_true")
    g.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    root, day = Path(a.root), date.fromisoformat(a.day)
    if a.publish:
        out = root / "data" / "social" / day.isoformat()
        if not (out / "square.png").exists():
            print(f"[social] publicar: não há pacote de {day}")
            return 1
        publish(out)
        return 0
    out = build_package(root, day, dry_run=a.dry_run)
    if out and a.deliver:
        deliver_email(root, out, day)
    return 0


if __name__ == "__main__":
    sys.exit(main())
