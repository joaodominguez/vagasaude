#!/usr/bin/env python3
"""Google Indexing API para páginas de vagas (JobPosting).

Compara o sitemap de vagas da app (vagas visíveis) com as URLs já notificadas:
vagas novas → URL_UPDATED (mais recentes primeiro); vagas que saíram → URL_DELETED.
A 1.ª execução (sem estado) só regista a base atual, sem notificar.

Uso (no fim do run-scrapers.sh):
    python3 tools/indexing_notify.py \
        --sitemap http://127.0.0.1:3010/sitemap/jobs.xml \
        --state /var/www/vagasaude/data/indexing-state.json

Credenciais: GOOGLE_INDEXING_KEY = JSON da conta de serviço (proprietária da
propriedade no Search Console). Sem chave corre em simulação (--dry-run implícito).
Quota: INDEXING_DAILY_QUOTA pedidos/dia (por defeito 100; o projeto tem 200 no total).
"""
from __future__ import annotations

import argparse
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import httpx

ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish"
SCOPE = "https://www.googleapis.com/auth/indexing"


def read_sitemap(url: str) -> dict[str, str]:
    """URL → lastmod do sitemap de vagas."""
    xml = httpx.get(url, timeout=60).text
    entries: dict[str, str] = {}
    for block in re.findall(r"<url>(.*?)</url>", xml, re.S):
        loc = re.search(r"<loc>([^<]+)</loc>", block)
        if not loc:
            continue
        lastmod = re.search(r"<lastmod>([^<]+)</lastmod>", block)
        entries[loc.group(1).strip()] = lastmod.group(1).strip() if lastmod else ""
    if not entries:
        raise RuntimeError(f"sitemap sem URLs: {url}")
    return entries


def load_state(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def save_state(path: Path, state: dict) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


def authorized_session(key_path: str):
    # Import tardio: só necessário quando há chave (google-auth + requests).
    from google.auth.transport.requests import AuthorizedSession
    from google.oauth2 import service_account

    credentials = service_account.Credentials.from_service_account_file(
        key_path, scopes=[SCOPE]
    )
    return AuthorizedSession(credentials)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sitemap", required=True)
    parser.add_argument("--state", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    key_path = os.environ.get("GOOGLE_INDEXING_KEY", "")
    dry_run = args.dry_run or not (key_path and Path(key_path).is_file())
    quota = int(os.environ.get("INDEXING_DAILY_QUOTA", "100"))
    today = datetime.now(timezone.utc).date().isoformat()
    now = datetime.now(timezone.utc).isoformat()

    current = read_sitemap(args.sitemap)
    state_path = Path(args.state)
    state = load_state(state_path)
    if state is None:
        # Base inicial: o Google já conhece estas vagas; só as seguintes são notificadas.
        if not dry_run:
            save_state(state_path, {"notified": {u: now for u in current}, "day": today, "used": 0})
        print(f"[indexing] base inicial: {len(current)} URLs{' (simulação)' if dry_run else ' registadas'}")
        return 0

    notified: dict[str, str] = state.get("notified", {})
    if state.get("day") != today:
        state["day"], state["used"] = today, 0
    budget = max(0, quota - int(state.get("used", 0)))

    new = sorted((u for u in current if u not in notified), key=lambda u: current[u], reverse=True)
    gone = [u for u in notified if u not in current]
    plan = [(u, "URL_UPDATED") for u in new] + [(u, "URL_DELETED") for u in gone]
    print(
        f"[indexing] novas {len(new)}, removidas {len(gone)}, quota restante hoje {budget}"
        f"{' (simulação)' if dry_run else ''}"
    )
    if dry_run or not plan or budget == 0:
        return 0

    session = authorized_session(key_path)
    sent = errors = 0
    for url, kind in plan[:budget]:
        response = session.post(ENDPOINT, json={"url": url, "type": kind}, timeout=30)
        if response.status_code == 429:
            print("[indexing] quota da API esgotada (429)")
            break
        if response.status_code >= 400:
            errors += 1
            print(f"[indexing] {kind} {url}: HTTP {response.status_code} {response.text[:160]}")
            if errors >= 5:
                break
            continue
        sent += 1
        if kind == "URL_UPDATED":
            notified[url] = now
        else:
            notified.pop(url, None)
    state["notified"] = notified
    state["used"] = int(state.get("used", 0)) + sent
    save_state(state_path, state)
    print(f"[indexing] enviados {sent} pedidos ({errors} erros)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
