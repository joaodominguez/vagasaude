#!/usr/bin/env python3
"""Marca nos alertas (data/alerts.json) os emails com problema de entrega, para aparecerem no admin.

- bounce / complaint: o último email enviado a esse endereço (Resend) ficou "bounced" ou "complained".
- invalid_domain: o domínio do email não tem MX nem A (ex.: gmail.con, sapo.p).
Limpa a marca de bounce/complaint quando um email posterior foi entregue.

Os 4 sites de saúde usam a mesma conta Resend (chave em /var/www/vagasaude/.env.production).
A app guarda/limpa o campo `emailIssue` (lib/alerts.ts) e mostra-o em /admin/alertas (IT: /admin/avvisi).
Cron (portal): diário. Uso: alerts_email_issues.py [--dry-run] [--days 30]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

SITES = ["vagasaude", "vagasaudebr", "vacantessalud", "offertesanita"]
KEY_ENV = "/var/www/vagasaude/.env.production"
BAD_EVENTS = {"bounced": "bounce", "complained": "complaint"}
GOOD_EVENTS = {"delivered", "opened", "clicked"}


def resend_key() -> str:
    for line in open(KEY_ENV, encoding="utf-8"):
        m = re.match(r"\s*RESEND_API_KEY=(.*)", line)
        if m:
            return m.group(1).strip().strip('"').strip("'")
    sys.exit("RESEND_API_KEY em falta")


def fetch_emails(key: str, days: int) -> list[dict]:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    out: list[dict] = []
    after = None
    for _ in range(300):
        url = "https://api.resend.com/emails?limit=100" + (f"&after={after}" if after else "")
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}", "User-Agent": "vagasaude-maint"})
        try:
            data = json.load(urllib.request.urlopen(req, timeout=30))
        except urllib.error.HTTPError as err:
            if err.code == 429:
                time.sleep(1.5)
                continue
            raise
        items = data.get("data", [])
        out += items
        if not data.get("has_more") or not items or items[-1]["created_at"][:10] < cutoff:
            break
        after = items[-1]["id"]
        time.sleep(0.6)
    return out


_domain_cache: dict[str, bool] = {}


def domain_ok(domain: str) -> bool:
    if domain not in _domain_cache:
        ok = False
        for rtype in ("MX", "A"):
            try:
                res = subprocess.run(["dig", "+short", rtype, domain], capture_output=True, text=True, timeout=10)
            except Exception:
                ok = True  # na dúvida não marca
                break
            if res.stdout.strip():
                ok = True
                break
        _domain_cache[domain] = ok
    return _domain_cache[domain]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--days", type=int, default=30)
    args = ap.parse_args()

    emails = fetch_emails(resend_key(), args.days)
    last: dict[str, dict] = {}  # destinatário -> email mais recente
    for item in sorted(emails, key=lambda i: i["created_at"]):
        for to in item.get("to") or []:
            last[to.lower()] = item

    for site in SITES:
        path = f"/var/www/{site}/data/alerts.json"
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            raw = json.load(fh)
        alerts = raw if isinstance(raw, list) else raw.get("alerts", [])
        marked = cleared = 0
        for alert in alerts:
            if alert.get("status") == "unsubscribed":
                continue
            email = (alert.get("email") or "").lower()
            issue = alert.get("emailIssue")
            new_issue = None
            if "@" in email and not domain_ok(email.split("@", 1)[1]):
                new_issue = {"type": "invalid_domain", "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                             "detail": email.split("@", 1)[1]}
            elif email in last:
                event = last[email].get("last_event")
                if event in BAD_EVENTS:
                    new_issue = {"type": BAD_EVENTS[event], "at": last[email]["created_at"][:19].replace(" ", "T") + "Z",
                                 "detail": (last[email].get("subject") or "")[:120]}
                elif event in GOOD_EVENTS and issue and issue.get("type") in ("bounce", "complaint"):
                    alert["emailIssue"] = None
                    cleared += 1
                    continue
            if new_issue and (not issue or issue.get("type") != new_issue["type"]):
                alert["emailIssue"] = new_issue
                marked += 1
        print(f"[alerts-email-issues] {site}: {marked} marcados, {cleared} limpos" + (" (dry-run)" if args.dry_run else ""))
        if args.dry_run or not (marked or cleared):
            continue
        st = os.stat(path)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(raw, fh, ensure_ascii=False, indent=2)
        os.chmod(tmp, st.st_mode & 0o777)
        try:
            os.chown(tmp, st.st_uid, st.st_gid)
        except PermissionError:
            pass
        os.replace(tmp, path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
