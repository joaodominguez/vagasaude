#!/usr/bin/env python3
"""Último lembrete único de confirmação para alertas por confirmar (VagaSaúde PT, BR e VacantesSalud ES).

Seleção (por site): status == "pending_confirm", SEM emailIssue, criado há mais de --min-age-days (3) e
ainda não lembrado. 1 email por endereço (se houver vários alertas pendentes, 1 email com os links todos).

Remetente, URL do site e link de confirmação são os mesmos da app (EMAIL_FROM e NEXT_PUBLIC_SITE_URL do
.env.production de cada site; link = {SITE_URL}/alertas/confirmar?token=<token do alerta>, como em lib/email.ts).
O template reproduz o layout de lib/email.ts (alertConfirmEmail) com assunto e texto próprios.

Estado: NÃO escreve no alerts.json. A app reescreve esse ficheiro a partir de normalizeAlert(), que apaga campos
desconhecidos (um `lastReminderAt` no alerta perder-se-ia à primeira confirmação/subscrição). O "já lembrado"
fica em data/alerts-last-reminder-state.json ({site: {alertId: {lastReminderAt, resendId}}}), escrita atómica,
modo/dono preservados.

Uso:
  alerts_last_reminder.py --dry-run [--preview-dir DIR]   lista destinatários (mascarados) e gera previews HTML
  alerts_last_reminder.py --send [--force]                envia de facto; recusa se a data UTC != 2026-11-27

Os 3 sites de saúde partilham a conta Resend (RESEND_API_KEY em /var/www/vagasaude/.env.production).
Correr como root (o alerts.json do ES é root:www-data 600).
"""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

ALLOWED_DATE_UTC = "2026-11-27"
CAMPAIGN = "last-reminder-2026-11"
KEY_ENV = "/var/www/vagasaude/.env.production"
STATE_FILE = "/var/www/vagasaude/data/alerts-last-reminder-state.json"
LOG_FILE = "/var/www/vagasaude/data/alerts-last-reminder.log"
LOCK_FILE = "/var/www/vagasaude/data/.alerts-last-reminder.lock"
SEND_INTERVAL = 0.6
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

C = {"page": "#f1f5f9", "card": "#ffffff", "text": "#0f172a", "muted": "#64748b", "subtle": "#94a3b8",
     "border": "#e2e8f0", "primary": "#0f766e", "primarySoft": "#e8f7f5"}
FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

# --- PT: locativos (porto de lib/pt-locative.ts) ---
_NO = {"porto", "funchal", "seixal", "barreiro", "montijo", "cartaxo", "entroncamento", "fundao", "bombarral",
       "sabugal", "crato", "marco de canaveses", "peso da regua", "porto santo"}
_NA = {"madeira", "guarda", "maia", "trofa", "amadora", "covilha", "figueira da foz", "povoa de varzim",
       "povoa de lanhoso", "nazare", "lourinha", "golega", "batalha", "ribeira grande", "ribeira brava", "calheta",
       "chamusca", "mealhada", "murtosa", "pampilhosa da serra", "praia da vitoria", "horta", "lagoa", "serta"}
_NOS = {"acores", "arcos de valdevez"}


def _strip_accents(s: str) -> str:
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)).lower().strip()


def em_local_pt(place: str) -> str:
    k = _strip_accents(place)
    if k in _NO:
        return f"no {place}"
    if k in _NA:
        return f"na {place}"
    if k in _NOS:
        return f"nos {place}"
    return f"em {place}"


def _summary(f: dict, what_prof: str, what_none: str, where_fn, where_none: str, sector_word: str) -> str:
    prof, dist, sector = (f.get("profession") or "").strip(), (f.get("district") or "").strip(), (f.get("sector") or "").strip()
    what = f"{what_prof} {prof.lower()}" if prof else what_none
    where = where_fn(dist) if dist else where_none
    which = f" ({sector_word} {sector.lower()})" if sector else ""
    return f"{what} {where}{which}"


SITES: dict[str, dict] = {
    "vagasaude": {
        "lang": "pt", "site_url": "https://vagasaude.pt", "from": "VagaSaúde <alertas@vagasaude.pt>",
        "utm_source": "vagasaude", "brand": 'Vaga<span style="color:{primary};">Saúde</span>',
        "social_label": "Siga o VagaSaúde e receba vagas todos os dias",
        "social": [("Telegram", "telegram", "https://t.me/vagasaudept"),
                   ("WhatsApp", "whatsapp", "https://whatsapp.com/channel/0029VbDxb8A5PO0v9AeTbE32"),
                   ("Instagram", "instagram", "https://www.instagram.com/vagasaudept"),
                   ("Facebook", "facebook", "https://www.facebook.com/vagasaudept")],
        "summary": lambda f: _summary(f, "vagas de", "vagas de saúde", em_local_pt, "em Portugal", "setor"),
        "subject": "O teu alerta de vagas ainda não está ativo — último aviso",
        "title": "Último aviso: falta confirmar o teu alerta",
        "preheader": "Um clique para ativares o alerta. Não voltamos a insistir.",
        "intro": "Pediste um alerta de vagas no VagaSaúde, mas ainda não o confirmaste, por isso não te enviámos nada. "
                 "Este é o último lembrete: confirma com um clique e passas a receber as vagas novas por email.",
        "intro_multi": "Pediste alertas de vagas no VagaSaúde com este email, mas ainda não os confirmaste, por isso não te enviámos nada. "
                       "Este é o último lembrete: confirma os que quiseres com um clique.",
        "label_alert": "O teu alerta", "button": "Confirmar alerta",
        "ignore": "Se não fores tu, ignora este email: não voltamos a insistir.",
        "spam": "Não encontras os nossos emails? Vê também a pasta de spam ou a de promoções.",
        "footer": 'Recebeste este email porque alguém pediu um alerta de vagas com este endereço em <a href="{site_url}" style="color:{muted};">vagasaude.pt</a>.',
        "text_title": "Último aviso: falta confirmar o teu alerta VagaSaúde", "text_confirm": "Confirmar",
    },
    "vagasaudebr": {
        "lang": "pt-BR", "site_url": "https://vagasaude.com.br", "from": "VagaSaúde Brasil <alertas@vagasaude.com.br>",
        "utm_source": "vagasaude",
        "brand": 'Vaga<span style="color:{primary};">Saúde</span> <span style="font-weight:600;color:{muted};">Brasil</span>',
        "social_label": "Siga o VagaSaúde e receba vagas todos os dias",
        "social": [("Telegram", "telegram", "https://t.me/vagasaudebr"),
                   ("WhatsApp", "whatsapp", "https://whatsapp.com/channel/0029Vb9QPDsLY6dDeq2VVQ2i"),
                   ("Instagram", "instagram", "https://www.instagram.com/vagasaudebr"),
                   ("Facebook", "facebook", "https://www.facebook.com/vagasaudebr")],
        "summary": lambda f: _summary(f, "vagas de", "vagas de saúde", lambda d: f"em {d}", "no Brasil", "setor"),
        "subject": "Seu alerta de vagas ainda não está ativo — último aviso",
        "title": "Último aviso: falta confirmar seu alerta",
        "preheader": "Um clique para ativar o alerta. Não vamos insistir de novo.",
        "intro": "Você pediu um alerta de vagas no VagaSaúde, mas ainda não o confirmou, então não enviamos nada. "
                 "Este é o último lembrete: confirme com um clique e passe a receber as vagas novas por email.",
        "intro_multi": "Você pediu alertas de vagas no VagaSaúde com este email, mas ainda não os confirmou, então não enviamos nada. "
                       "Este é o último lembrete: confirme os que quiser com um clique.",
        "label_alert": "Seu alerta", "button": "Confirmar alerta",
        "ignore": "Se não foi você, ignore este email: não vamos insistir de novo.",
        "spam": "Não encontra nossos emails? Veja também a caixa de spam ou a aba Promoções.",
        "footer": 'Você recebeu este email porque alguém pediu um alerta de vagas com este endereço em <a href="{site_url}" style="color:{muted};">vagasaude.com.br</a>.',
        "text_title": "Último aviso: falta confirmar seu alerta VagaSaúde", "text_confirm": "Confirmar",
    },
    "vacantessalud": {
        "lang": "es", "site_url": "https://vacantessalud.es", "from": "VacantesSalud <alertas@vacantessalud.es>",
        "utm_source": "vacantessalud", "brand": 'Vacantes<span style="color:{primary};">Salud</span>',
        "social_label": "Síguenos y recibe ofertas cada día",
        "social": [("Telegram", "telegram", "https://t.me/vacantessalud"),
                   ("WhatsApp", "whatsapp", "https://whatsapp.com/channel/0029VbE2wId4SpkNer4zlP3s"),
                   ("Instagram", "instagram", "https://www.instagram.com/vacantessalud/"),
                   ("Facebook", "facebook", "https://www.facebook.com/vacantesalud")],
        "summary": lambda f: _summary(f, "ofertas de", "ofertas de empleo sanitario", lambda d: f"en {d}", "en España", "sector"),
        "subject": "Tu alerta de ofertas aún no está activa — último aviso",
        "title": "Último aviso: falta confirmar tu alerta",
        "preheader": "Un clic para activar la alerta. No volveremos a insistir.",
        "intro": "Pediste una alerta de ofertas en VacantesSalud, pero todavía no la has confirmado, así que no te hemos enviado nada. "
                 "Este es el último recordatorio: confirma con un clic y empezarás a recibir las ofertas nuevas por email.",
        "intro_multi": "Pediste alertas de ofertas en VacantesSalud con este email, pero todavía no las has confirmado, así que no te hemos enviado nada. "
                       "Este es el último recordatorio: confirma las que quieras con un clic.",
        "label_alert": "Tu alerta", "button": "Confirmar alerta",
        "ignore": "Si no has sido tú, ignora este email: no volveremos a insistir.",
        "spam": "¿No encuentras nuestros emails? Revisa también la carpeta de spam o la de promociones.",
        "footer": 'Has recibido este email porque alguien pidió una alerta de ofertas con esta dirección en <a href="{site_url}" style="color:{muted};">vacantessalud.es</a>.',
        "text_title": "Último aviso: falta confirmar tu alerta de VacantesSalud", "text_confirm": "Confirmar",
    },
    "offertesanita": {
        "lang": "it", "site_url": "https://offertesanita.it", "from": "Offerte Sanità <avvisi@offertesanita.it>",
        "confirm_path": "/avvisi/conferma",
        "utm_source": "offertesanita", "brand": 'Offerte<span style="color:{primary};">Sanità</span>',
        "social_label": "Seguici e ricevi offerte ogni giorno",
        "social": [("Telegram", "telegram", "https://t.me/offertesanita"),
                   ("WhatsApp", "whatsapp", "https://whatsapp.com/channel/0029VbDuqMp9xVJnr0RzZG04"),
                   ("Instagram", "instagram", "https://www.instagram.com/offertesanita/"),
                   ("Facebook", "facebook", "https://www.facebook.com/offertesanita")],
        "summary": lambda f: _summary(f, "offerte di", "offerte di lavoro in sanità", lambda d: f"in {d}", "in Italia", "settore"),
        "subject": "Il tuo avviso di offerte non è ancora attivo — ultimo promemoria",
        "title": "Ultimo promemoria: manca la conferma del tuo avviso",
        "preheader": "Un clic per attivare l'avviso. Non insisteremo più.",
        "intro": "Hai chiesto un avviso di offerte su Offerte Sanità, ma non l'hai ancora confermato, quindi non ti abbiamo inviato nulla. "
                 "Questo è l'ultimo promemoria: conferma con un clic e inizierai a ricevere le nuove offerte via email.",
        "intro_multi": "Hai chiesto degli avvisi di offerte su Offerte Sanità con questa email, ma non li hai ancora confermati, quindi non ti abbiamo inviato nulla. "
                       "Questo è l'ultimo promemoria: conferma quelli che vuoi con un clic.",
        "label_alert": "Il tuo avviso", "button": "Conferma avviso",
        "ignore": "Se non sei stato tu, ignora questa email: non insisteremo più.",
        "spam": "Non trovi le nostre email? Controlla anche la cartella spam o promozioni.",
        "footer": 'Hai ricevuto questa email perché qualcuno ha chiesto un avviso di offerte con questo indirizzo su <a href="{site_url}" style="color:{muted};">offertesanita.it</a>.',
        "text_title": "Ultimo promemoria: manca la conferma del tuo avviso Offerte Sanità", "text_confirm": "Conferma",
    },
}


# ---------------------------------------------------------------- utilitários
def mask(email: str) -> str:
    local, _, domain = email.partition("@")
    return f"{local[:1]}***@{domain}"


def log(line: str, to_file: bool) -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(line, flush=True)
    if to_file:
        with open(LOG_FILE, "a", encoding="utf-8") as fh:
            fh.write(f"{stamp} {line}\n")


def read_env(path: str) -> dict[str, str]:
    out: dict[str, str] = {}
    try:
        for line in open(path, encoding="utf-8"):
            m = re.match(r"\s*([A-Z_]+)=(.*)", line)
            if m:
                out[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    except OSError:
        pass
    return out


def site_config(site: str) -> dict:
    cfg = dict(SITES[site])
    env = read_env(f"/var/www/{site}/.env.production")
    cfg["from"] = env.get("EMAIL_FROM") or cfg["from"]
    cfg["site_url"] = (env.get("NEXT_PUBLIC_SITE_URL") or cfg["site_url"]).rstrip("/")
    return cfg


def parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def load_alerts(site: str) -> list[dict]:
    path = f"/var/www/{site}/data/alerts.json"
    with open(path, encoding="utf-8") as fh:
        raw = json.load(fh)
    return raw if isinstance(raw, list) else raw.get("alerts", [])


def load_state() -> dict:
    try:
        with open(STATE_FILE, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return {}


def save_state(state: dict) -> None:
    """Escrita atómica; preserva dono e modo se o ficheiro já existir (senão root, 600)."""
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(state, fh, ensure_ascii=False, indent=2)
        fh.flush()
        os.fsync(fh.fileno())
    if os.path.exists(STATE_FILE):
        st = os.stat(STATE_FILE)
        os.chmod(tmp, st.st_mode & 0o777)
        try:
            os.chown(tmp, st.st_uid, st.st_gid)
        except PermissionError:
            pass
    else:
        os.chmod(tmp, 0o600)
    os.replace(tmp, STATE_FILE)


def select(site: str, state: dict, min_age_days: int) -> tuple[dict[str, list[dict]], dict[str, int]]:
    """Devolve {email: [alertas]} elegíveis e contadores de exclusões."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=min_age_days)
    done = state.get(site, {})
    stats = {"pending": 0, "emailIssue": 0, "recente": 0, "ja_lembrado": 0, "email_invalido": 0}
    groups: dict[str, list[dict]] = {}
    for alert in load_alerts(site):
        if alert.get("status") != "pending_confirm":
            continue
        stats["pending"] += 1
        email = (alert.get("email") or "").strip().lower()
        if alert.get("emailIssue"):
            stats["emailIssue"] += 1
        elif not EMAIL_RE.match(email) or not alert.get("token"):
            stats["email_invalido"] += 1
        elif alert.get("id") in done:
            stats["ja_lembrado"] += 1
        elif not (created := parse_ts(alert.get("createdAt"))) or created > cutoff:
            stats["recente"] += 1
        else:
            groups.setdefault(email, []).append(alert)
    for items in groups.values():
        items.sort(key=lambda a: a.get("createdAt") or "", reverse=True)
    return groups, stats


# ---------------------------------------------------------------- template
def build_email(site: str, cfg: dict, alerts: list[dict]) -> dict:
    esc = html.escape
    su = cfg["site_url"]

    def tracked(path: str) -> str:
        return f"{su}{path}{'&' if '?' in path else '?'}utm_source={cfg['utm_source']}&utm_medium=email&utm_campaign=alerta_ultimo_lembrete"

    def confirm_url(token: str) -> str:
        return f"{su}{cfg.get('confirm_path', '/alertas/confirmar')}?token={token}"

    def icons(size: int, gap: int) -> str:
        return "".join(
            f'<a href="{u}" style="display:inline-block;margin:0 {gap}px;text-decoration:none;"><img src="{su}/email/social-{i}.png" '
            f'width="{size}" height="{size}" alt="{n}" title="{n}" style="display:block;border:0;border-radius:{size // 2}px;"></a>'
            for n, i, u in cfg["social"])

    def button(href: str, label: str) -> str:
        return (f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0 0;"><tr><td bgcolor="{C["primary"]}" style="border-radius:10px;">'
                f'<a href="{href}" style="display:inline-block;padding:13px 22px;font-family:{FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">{esc(label)}</a></td></tr></table>')

    def para(text: str, extra: str = "") -> str:
        return f'<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:{C["muted"]};{extra}">{text}</p>'

    blocks = []
    for a in alerts:
        summ = cfg["summary"](a.get("filters") or {})
        summ = summ[:1].upper() + summ[1:]
        blocks.append(
            f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 0;background:{C["primarySoft"]};border-radius:12px;">'
            f'<tr><td style="padding:12px 16px 0;font-family:{FONT};font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:{C["primary"]};">{esc(cfg["label_alert"])}</td></tr>'
            f'<tr><td style="padding:2px 16px 12px;font-family:{FONT};font-size:15px;line-height:1.5;color:{C["text"]};">{esc(summ)}</td></tr></table>'
            + button(confirm_url(a["token"]), cfg["button"]))
    multi = len(alerts) > 1
    body = (para(esc(cfg["intro_multi" if multi else "intro"])) + "\n" + "\n".join(f'<div style="margin:0 0 18px;">{b}</div>' for b in blocks)
            + para(esc(cfg["ignore"]), "margin:20px 0 8px;font-size:13px;") + para(esc(cfg["spam"]), "margin:0;font-size:13px;"))
    brand = cfg["brand"].format(primary=C["primary"], muted=C["muted"])
    footer = cfg["footer"].format(site_url=su, muted=C["muted"])
    doc = f'''<!doctype html>
<html lang="{cfg["lang"]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{esc(cfg["title"])}</title>
</head>
<body style="margin:0;padding:0;background:{C["page"]};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{esc(cfg["preheader"])}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="{C["page"]}" style="background:{C["page"]};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
      <tr><td style="padding:0 8px 18px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
        <td valign="middle">
        <a href="{tracked("/")}" style="text-decoration:none;font-family:{FONT};">
          <img src="{su}/email/logo-mark.png" width="28" height="24" alt="" style="vertical-align:middle;border:0;">
          <span style="vertical-align:middle;font-size:18px;font-weight:800;letter-spacing:-0.3px;color:{C["text"]};">{brand}</span>
        </a>
        </td>
        <td align="right" valign="middle" style="white-space:nowrap;">{icons(20, 3)}</td>
        </tr></table>
      </td></tr>
      <tr><td bgcolor="{C["card"]}" style="background:{C["card"]};border:1px solid {C["border"]};border-radius:16px;padding:28px 24px;font-family:{FONT};">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:800;color:{C["text"]};">{esc(cfg["title"])}</h1>
        {body}
      </td></tr>
      <tr><td align="center" style="padding:22px 8px 4px;font-family:{FONT};">
        <div style="margin:0 0 10px;font-size:13px;font-weight:600;color:{C["muted"]};">{esc(cfg["social_label"])}</div>
        {icons(32, 5)}
      </td></tr>
      <tr><td style="padding:20px 8px 0;font-family:{FONT};font-size:12px;line-height:1.6;color:{C["subtle"]};">
        {footer}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>'''
    text_lines = [cfg["text_title"], "", cfg["intro_multi" if multi else "intro"], ""]
    for a in alerts:
        text_lines += [f'{cfg["label_alert"]}: {cfg["summary"](a.get("filters") or {})}', f'{cfg["text_confirm"]}: {confirm_url(a["token"])}', ""]
    text_lines += [cfg["ignore"], cfg["spam"]]
    return {"subject": cfg["subject"], "html": doc, "text": "\n".join(text_lines)}


# ---------------------------------------------------------------- envio
def resend_key() -> str:
    key = read_env(KEY_ENV).get("RESEND_API_KEY", "")
    if not key:
        sys.exit("RESEND_API_KEY em falta")
    return key


def send_one(key: str, cfg: dict, to: str, content: dict, idem: str) -> tuple[bool, str]:
    payload = json.dumps({"from": cfg["from"], "to": [to], "subject": content["subject"],
                          "html": content["html"], "text": content["text"],
                          "tags": [{"name": "site", "value": re.sub(r"[^A-Za-z0-9_-]", "_", urllib.parse.urlparse(cfg["site_url"]).hostname or "site")},
                                   {"name": "campaign", "value": "alerta_ultimo_lembrete"}]}).encode()
    for attempt in range(4):
        req = urllib.request.Request("https://api.resend.com/emails", data=payload, method="POST", headers={
            "Authorization": f"Bearer {key}", "Content-Type": "application/json",
            "User-Agent": "vagasaude-maint", "Idempotency-Key": idem})
        try:
            data = json.load(urllib.request.urlopen(req, timeout=30))
            return True, data.get("id", "")
        except urllib.error.HTTPError as err:
            body = err.read().decode("utf-8", "replace")[:200]
            if err.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(2 * (attempt + 1))
                continue
            return False, f"HTTP {err.code}: {body}"
        except Exception as err:  # rede
            if attempt < 3:
                time.sleep(2 * (attempt + 1))
                continue
            return False, f"erro: {type(err).__name__}"
    return False, "esgotadas as tentativas"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--send", action="store_true")
    ap.add_argument("--force", action="store_true", help="ignora a guarda de data (só com --send)")
    ap.add_argument("--min-age-days", type=int, default=3)
    ap.add_argument("--preview-dir", default="/tmp/lembrete-27-previews")
    ap.add_argument("--sites", default=",".join(SITES))
    args = ap.parse_args()

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if args.send and not args.force and today != ALLOWED_DATE_UTC:
        log(f"[last-reminder] RECUSADO: data UTC {today} != {ALLOWED_DATE_UTC}; nada enviado (use --force só se for mesmo intencional)", True)
        return 3
    sites = [s for s in args.sites.split(",") if s in SITES]

    lock = open(LOCK_FILE, "a")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("outra instância em curso", file=sys.stderr)
        return 4

    state = load_state()
    key = resend_key() if args.send else ""
    tag = "SEND" if args.send else "dry-run"
    if args.dry_run:
        os.makedirs(args.preview_dir, exist_ok=True)
    total_ok = total_fail = 0
    first = True
    for site in sites:
        cfg = site_config(site)
        groups, stats = select(site, state, args.min_age_days)
        log(f"[last-reminder] {tag} {site}: {len(groups)} destinatários | pendentes={stats['pending']} "
            f"com emailIssue={stats['emailIssue']} recentes(<{args.min_age_days}d)={stats['recente']} "
            f"já lembrados={stats['ja_lembrado']} inválidos={stats['email_invalido']}", args.send)
        if args.dry_run:
            sample = next(iter(groups.values()), None)
            if sample:
                # preview com token fictício: nunca grava tokens reais fora do servidor
                fake = [dict(a, token="TOKEN-DE-EXEMPLO") for a in sample]
                path = os.path.join(args.preview_dir, f"preview-{site}.html")
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(build_email(site, cfg, fake)["html"])
                log(f"[last-reminder]   preview: {path}  assunto: {cfg['subject']}", False)
            for email, items in sorted(groups.items()):
                log(f"[last-reminder]   {mask(email)}  alertas={len(items)}  criado={(items[0].get('createdAt') or '')[:10]}", False)
            continue
        for email, items in sorted(groups.items()):
            if not first:
                time.sleep(SEND_INTERVAL)
            first = False
            idem = f"{CAMPAIGN}-{site}-{hashlib.sha256(email.encode()).hexdigest()[:24]}"
            ok, info = send_one(key, cfg, email, build_email(site, cfg, items), idem)
            if ok:
                total_ok += 1
                now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")
                for a in items:
                    state.setdefault(site, {})[a["id"]] = {"lastReminderAt": now_iso, "resendId": info}
                save_state(state)  # logo após cada envio: uma falha a meio não repete emails
                log(f"[last-reminder] {site} {mask(email)} enviado resend_id={info}", True)
            else:
                total_fail += 1
                log(f"[last-reminder] {site} {mask(email)} FALHOU {info}", True)
    if args.send:
        log(f"[last-reminder] fim: {total_ok} enviados, {total_fail} falhados", True)
    return 1 if total_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
