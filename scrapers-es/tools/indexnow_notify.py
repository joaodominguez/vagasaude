#!/usr/bin/env python3
"""IndexNow (Bing e, por arrasto, o ChatGPT) — só ES (vacantessalud.es), com chave própria.

Depois de cada recolha compara as vagas do sitemap (as mesmas do jobs.xml: indexáveis e com prazo
> 72 h) com as já enviadas e avisa o IndexNow só do que mudou:
  - vagas novas → urlList;
  - vagas que saíram do sitemap → urlList (o IndexNow também quer os URLs removidos).
Nada é reenviado: o estado (data/indexnow-state.json) guarda o que o Bing já sabe.

Limites respeitados: ≤ 10.000 URLs por pedido (aqui 5.000), teto diário INDEXNOW_DAILY_MAX
(por defeito 10.000 URLs), 1 pedido de cada vez; em 429/5xx pára e deixa o resto para a próxima
execução (o estado só avança com os lotes aceites).

A chave é pública por definição (tem de estar em https://<host>/<chave>.txt): apps/web-es/public.

Uso (no fim do run-scrapers.sh):
    python3 tools/indexnow_notify.py \
        --sitemap http://127.0.0.1:3012/sitemap/jobs-meta.json \
        --state /var/www/vacantessalud/data/indexnow-state.json
Na 1.ª execução (sem estado) só regista a base; --seed envia a base inteira, uma vez (≤ 10.000).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

HOST = "vacantessalud.es"
KEY = "f7ae68570ee8107433644ab0095db348"  # pública (ficheiro na raiz do site)
ENDPOINT = "https://api.indexnow.org/IndexNow"
BATCH = 5000          # máx. do protocolo: 10.000
DAILY_MAX_DEFAULT = 10000
MIN_LIFETIME = timedelta(hours=72)


def parse_dt(value):
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def read_current(url: str) -> list[str]:
    """URLs das vagas do sitemap (jobs-meta.json ou jobs.xml), sem prazo < 72 h."""
    with urllib.request.urlopen(url, timeout=60) as response:  # noqa: S310 — URL interno
        body = response.read().decode("utf-8")
    now = datetime.now(timezone.utc)
    if url.endswith(".json"):
        jobs = json.loads(body).get("jobs", [])
        urls = []
        for job in jobs:
            expires = parse_dt(job.get("expiresAt")) if job.get("expiresAt") else None
            if expires and expires - now < MIN_LIFETIME:
                continue
            urls.append(job["url"])
    else:
        urls = [m.strip() for m in re.findall(r"<loc>([^<]+)</loc>", body)]
    if not urls:
        raise RuntimeError(f"sitemap sem URLs: {url}")
    return urls


def load_state(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def save_state(path: Path, state: dict) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


def submit(urls: list[str], key: str) -> tuple[int, str]:
    payload = json.dumps(
        {"host": HOST, "key": key, "keyLocation": f"https://{HOST}/{key}.txt", "urlList": urls}
    ).encode("utf-8")
    request = urllib.request.Request(
        ENDPOINT,
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8", "User-Agent": "vagasaude-indexnow/1.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310
            return response.status, ""
    except urllib.error.HTTPError as exc:
        # Ex.: 403 SiteVerificationNotCompleted nas primeiras horas (o Bing ainda valida a chave).
        return exc.code, exc.read()[:200].decode("utf-8", "replace")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sitemap", required=True)
    parser.add_argument("--state", required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--seed", action="store_true", help="1.ª execução: enviar a base inteira")
    args = parser.parse_args()

    key = os.environ.get("INDEXNOW_KEY", KEY)
    daily_max = int(os.environ.get("INDEXNOW_DAILY_MAX", str(DAILY_MAX_DEFAULT)))
    today = datetime.now(timezone.utc).date().isoformat()
    now = datetime.now(timezone.utc).isoformat()

    current = read_current(args.sitemap)
    state_path = Path(args.state)
    state = load_state(state_path)
    if state is None:
        if args.seed and not args.dry_run:
            state = {"sent": {}, "day": today, "used": 0}
        else:
            if not args.dry_run:
                save_state(state_path, {"sent": {u: now for u in current}, "day": today, "used": 0})
            print(f"[indexnow] base inicial: {len(current)} URLs{' (simulação)' if args.dry_run else ' registadas'}")
            return 0

    sent: dict[str, str] = state.get("sent", {})
    if state.get("day") != today:
        state["day"], state["used"] = today, 0
    budget = max(0, daily_max - int(state.get("used", 0)))

    current_set = set(current)
    new = [u for u in current if u not in sent]
    gone = [u for u in sent if u not in current_set]
    print(f"[indexnow] novas {len(new)}, removidas {len(gone)}, teto restante hoje {budget}{' (simulação)' if args.dry_run else ''}")
    plan = [(u, True) for u in new] + [(u, False) for u in gone]
    if args.dry_run or not plan or budget == 0:
        return 0

    plan = plan[:budget]
    accepted = 0
    for start in range(0, len(plan), BATCH):
        chunk = plan[start : start + BATCH]
        status, detail = submit([u for u, _ in chunk], key)
        if status not in (200, 202):
            print(f"[indexnow] lote de {len(chunk)} URLs recusado: HTTP {status} {detail} (fica para a próxima execução)")
            break
        accepted += len(chunk)
        for url, is_new in chunk:
            if is_new:
                sent[url] = now
            else:
                sent.pop(url, None)
    state["sent"] = sent
    state["used"] = int(state.get("used", 0)) + accepted
    save_state(state_path, state)
    print(f"[indexnow] enviados {accepted} URLs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
