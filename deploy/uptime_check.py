#!/usr/bin/env python3
"""Alerta de disponibilidade dos 4 sites VagaSaúde (PT, BR, ES, IT) — 2026-11-14.

Motivo: no dia 14/11 o Apache ficou em baixo ~2h40 depois das atualizações automáticas e ninguém
foi avisado. Este check corre no servidor de 5 em 5 minutos (cron do root) e pede cada site
ATRAVÉS DO CLOUDFLARE (como um visitante), por isso apanha Apache em baixo (521), app em baixo
(502/504) ou erros 5xx.

- Alerta à 2.ª falha seguida (evita falsos alarmes) e um único email por incidente.
- Email de recuperação quando volta, com a duração.
- Usa o Resend da conta VagaSaúde (RESEND_API_KEY, EMAIL_FROM, ALERTS_TO lidos de ENV_FILE;
  nada é impresso).
- Não cobre o servidor inteiro desligado (aí o próprio check não corre): para isso seria
  preciso um monitor externo.

Uso: uptime_check.py [--dry-run]
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SITES = {
    "vagasaude.pt": "https://vagasaude.pt/robots.txt",
    "vagasaude.com.br": "https://vagasaude.com.br/robots.txt",
    "vacantessalud.es": "https://vacantessalud.es/robots.txt",
    "offertesanita.it": "https://offertesanita.it/robots.txt",
}
STATE = Path(os.environ.get("UPTIME_STATE", "/var/www/vagasaude/data/uptime-state.json"))
ENV_FILE = Path(os.environ.get("UPTIME_ENV_FILE", "/var/www/vacantessalud/.env.production"))
FAILS_TO_ALERT = 2
UA = "VagaSaudeUptime/1.0"


def check(url: str) -> tuple[bool, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Cache-Control": "no-cache"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status == 200, str(r.status)
    except urllib.error.HTTPError as e:
        return False, str(e.code)
    except Exception as e:  # noqa: BLE001 — timeout, DNS, ligação recusada
        return False, type(e).__name__


def env_value(name: str) -> str:
    try:
        for line in ENV_FILE.read_text().splitlines():
            if line.startswith(f"{name}="):
                return line.split("=", 1)[1].strip().strip('"')
    except OSError:
        pass
    return ""


def send(subject: str, body: str, dry: bool) -> None:
    if dry:
        print(f"[uptime] (simulação) email: {subject}")
        return
    key, sender, to = env_value("RESEND_API_KEY"), env_value("EMAIL_FROM"), env_value("ALERTS_TO")
    if not (key and sender and to):
        print("[uptime] sem configuração Resend — email não enviado")
        return
    data = json.dumps({"from": sender, "to": [a.strip() for a in to.split(",") if a.strip()],
                       "subject": subject, "text": body}).encode()
    req = urllib.request.Request("https://api.resend.com/emails", data=data, method="POST",
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=30).read()
        print(f"[uptime] email enviado: {subject}")
    except Exception as e:  # noqa: BLE001
        print(f"[uptime] falha ao enviar email: {type(e).__name__}")


def apache_state() -> str:
    try:
        return subprocess.run(["systemctl", "is-active", "apache2"], capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception:  # noqa: BLE001
        return "?"


def main() -> int:
    dry = "--dry-run" in sys.argv
    now = datetime.now(timezone.utc)
    try:
        state = json.loads(STATE.read_text())
    except (OSError, ValueError):
        state = {}
    results = {site: check(url) for site, url in SITES.items()}
    newly_down, recovered = [], []
    for site, (ok, code) in results.items():
        st = state.setdefault(site, {"fails": 0, "down_since": None, "alerted": False})
        if ok:
            if st.get("alerted"):
                recovered.append((site, st.get("down_since")))
            state[site] = {"fails": 0, "down_since": None, "alerted": False}
            continue
        st["fails"] = int(st.get("fails") or 0) + 1
        st["last_code"] = code
        if not st.get("down_since"):
            st["down_since"] = now.isoformat(timespec="minutes")
        if st["fails"] >= FAILS_TO_ALERT and not st.get("alerted"):
            newly_down.append((site, code))
            st["alerted"] = True
    summary = ", ".join(f"{s}={c}" for s, (_, c) in results.items())
    print(f"[uptime] {now:%Y-%m-%d %H:%M} UTC {summary}")
    if newly_down:
        lines = [f"- {s}: HTTP {c}" for s, c in newly_down]
        send(
            f"🔴 VagaSaúde: {len(newly_down)} site(s) em baixo — {', '.join(s for s, _ in newly_down)}",
            "Sites que não respondem (2 verificações seguidas, de 5 em 5 min):\n" + "\n".join(lines)
            + f"\n\nEstado de todos: {summary}\nApache no servidor: {apache_state()}\n"
            "521 = Apache em baixo; 502/504 = app em baixo; Timeout/URLError = servidor ou rede.\n"
            "Ver references/incidentes.md da skill de manutenção.",
            dry,
        )
    for site, since in recovered:
        mins = ""
        if since:
            try:
                mins = f" (em baixo ~{int((now - datetime.fromisoformat(since)).total_seconds() // 60)} min)"
            except ValueError:
                pass
        send(f"🟢 VagaSaúde: {site} voltou{mins}", f"{site} responde outra vez com 200.{mins}\nEstado de todos: {summary}", dry)
    if not dry:
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(state, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
