#!/usr/bin/env python3
"""Google Indexing API para páginas de vagas (JobPosting).

Compara o sitemap de vagas da app (vagas visíveis) com as URLs já notificadas:
vagas novas → URL_UPDATED (mais recentes primeiro); vagas que saíram → URL_DELETED.
A 1.ª execução (sem estado) só regista a base atual, sem notificar.

Uso (no fim do run-scrapers.sh):
    python3 tools/indexing_notify.py \
        --sitemap http://127.0.0.1:3014/sitemap/jobs.xml \
        --state /var/www/offertesanita/data/indexing-state.json

Fila priorizada (IT, 2026-11-20): com a quota fixa de 200/dia, as vagas novas vão por pontuação
(pública direta — ASL/AO e fontes regionais — primeiro, depois inPA/GU, depois privadas; clínica, única,
mais tempo de vida, mais recente; agências de trabalho temporário — Randstad — com penalização forte),
lida de /sitemap/jobs-meta.json (mesmas vagas do jobs.xml: nunca noindex nem com prazo < 72 h).
Os URL_DELETED só usam a quota que sobra. Sem esse endpoint, cai para a ordem antiga (mais recentes primeiro).

Credenciais: GOOGLE_INDEXING_KEY = JSON da conta de serviço (proprietária da
propriedade no Search Console). Sem chave corre em simulação (--dry-run implícito).
Quota: INDEXING_DAILY_QUOTA pedidos/dia (por defeito 100; o projeto tem 200 no total).
O Google reinicia a quota à meia-noite do Pacífico (America/Los_Angeles), não em UTC:
o contador local usa o mesmo dia, senão as execuções da madrugada (UTC) recebem 429.
"""
from __future__ import annotations

import argparse
import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish"
SCOPE = "https://www.googleapis.com/auth/indexing"


def quota_day() -> str:
    """Dia da quota do Google (meia-noite do Pacífico)."""
    try:
        from zoneinfo import ZoneInfo

        tz = ZoneInfo("America/Los_Angeles")
    except Exception:  # noqa: BLE001 — sem base de fusos: PST fixo (erro máx. 1 h no verão)
        tz = timezone(timedelta(hours=-8))
    return datetime.now(tz).date().isoformat()


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


# Vagas com prazo a menos de 72 h não gastam quota (o Google chega depois do fim) — o jobs.xml já as
# exclui; esta guarda repete a regra caso o meta venha de um sitemap mais antigo.
MIN_LIFETIME = timedelta(hours=72)
AGENCY_PENALTY = 6.0  # agências (Randstad): só passam à frente de vagas fracas
ASSUMED_LIFETIME_DAYS = 7  # sem prazo na fonte: o validThrough da página é "visto + 7 dias" (TTL)
# Fontes públicas agregadoras (a mesma vaga costuma existir nas fontes diretas e noutros portais).
AGGREGATOR_SOURCES = {"inpa", "gu-s4"}


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def meta_url_for(sitemap_url: str) -> str:
    return re.sub(r"jobs\.xml(\?.*)?$", "jobs-meta.json", sitemap_url)


def read_meta(url: str) -> dict[str, dict]:
    """URL → metadados da vaga (vazio se o endpoint não existir: ordem antiga)."""
    try:
        response = httpx.get(url, timeout=60)
        response.raise_for_status()
        return {item["url"]: item for item in response.json().get("jobs", [])}
    except Exception as exc:  # noqa: BLE001 — a fila funciona sem prioridades
        print(f"[indexing] sem metadados de prioridade ({exc.__class__.__name__}); ordem por data")
        return {}


def priority(item: dict, now: datetime) -> float:
    """Maior = enviar primeiro. Pública direta/única, clínica, com mais tempo de vida, recente."""
    score = 0.0
    public = str(item.get("sector") or "").lower().startswith("pubbl")
    if public:
        score += 3.0 if item.get("source") in AGGREGATOR_SOURCES else 5.0
    if item.get("agency"):
        score -= AGENCY_PENALTY
    if item.get("clinical"):
        score += 2.0
    siblings = int(item.get("siblings") or 1)
    score += 2.0 if siblings == 1 else 1.0 if siblings <= 3 else 0.0
    if int(item.get("sourceCount") or 1_000_000) <= 60:
        score += 1.0  # fonte pequena: conteúdo que o Google dificilmente vê noutro lado
    expires = parse_dt(item.get("expiresAt"))
    lifetime_days = (
        (expires - now).total_seconds() / 86400 if expires else ASSUMED_LIFETIME_DAYS
    )
    score += 2.0 * min(max(lifetime_days, 0.0), 30.0) / 30.0
    first_seen = parse_dt(item.get("firstSeenAt")) or parse_dt(item.get("publishedAt"))
    if first_seen:
        age_days = max((now - first_seen).total_seconds() / 86400, 0.0)
        score += 3.0 * (1.0 - min(age_days, 14.0) / 14.0)  # novas primeiro
    return score


def eligible(item: dict, now: datetime) -> bool:
    expires = parse_dt(item.get("expiresAt"))
    return not (expires and expires - now < MIN_LIFETIME)


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


def report_simulation(new: list[str], meta: dict[str, dict], current: dict[str, str], n: int, now: datetime) -> None:
    """Composição das primeiras N vagas da fila (só leitura)."""
    from collections import Counter

    top = new[:n]
    items = [meta.get(u, {}) for u in top]
    print(f"[indexing] simulação: primeiras {len(top)} de {len(new)} novas")
    print(f"  clínicas: {sum(1 for i in items if i.get('clinical'))}")
    print(f"  únicas (sem gémeas): {sum(1 for i in items if int(i.get('siblings') or 1) == 1)}")
    print(f"  públicas: {sum(1 for i in items if str(i.get('sector') or '').lower().startswith('pubbl'))}")
    print(f"  agências: {sum(1 for i in items if i.get('agency'))}")
    print(f"  fonte pequena (<=150): {sum(1 for i in items if int(i.get('sourceCount') or 1_000_000) <= 150)}")
    print("  por fonte: " + ", ".join(f"{k or '?'}={v}" for k, v in Counter(i.get('source') for i in items).most_common(12)))
    print("  por profissão: " + ", ".join(f"{k or '?'}={v}" for k, v in Counter(i.get('profession') for i in items).most_common(8)))
    rest = [meta.get(u, {}) for u in new]
    print(f"  fila toda: clínicas {sum(1 for i in rest if i.get('clinical'))}, públicas {sum(1 for i in rest if str(i.get('sector') or '').lower().startswith('pubbl'))}, agências {sum(1 for i in rest if i.get('agency'))} de {len(rest)}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sitemap", required=True)
    parser.add_argument("--state", required=True)
    parser.add_argument("--meta", help="URL do jobs-meta.json (por defeito, ao lado do --sitemap)")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--simulate", type=int, metavar="N", help="mostra a composição das primeiras N da fila e sai (não envia nem grava)")
    args = parser.parse_args()

    key_path = os.environ.get("GOOGLE_INDEXING_KEY", "")
    dry_run = args.dry_run or not (key_path and Path(key_path).is_file())
    quota = int(os.environ.get("INDEXING_DAILY_QUOTA", "100"))
    today = quota_day()
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

    meta = read_meta(args.meta or meta_url_for(args.sitemap))
    now_dt = datetime.now(timezone.utc)
    candidates = [u for u in current if u not in notified]
    skipped = [u for u in candidates if u in meta and not eligible(meta[u], now_dt)]
    skipped_set = set(skipped)
    candidates = [u for u in candidates if u not in skipped_set]
    if meta:
        # Sem metadados de uma vaga (não devia acontecer): vai para o fim da fila de novas.
        new = sorted(
            candidates,
            key=lambda u: (priority(meta[u], now_dt) if u in meta else -1.0, current[u]),
            reverse=True,
        )
    else:
        new = sorted(candidates, key=lambda u: current[u], reverse=True)
    # Remoções só com a quota que sobra depois das novas: o Google retira sozinho as páginas
    # noindex/404 no rastreio seguinte; a quota vale mais a descobrir vagas novas.
    gone = [u for u in notified if u not in current]
    plan = [(u, "URL_UPDATED") for u in new] + [(u, "URL_DELETED") for u in gone]
    print(
        f"[indexing] novas {len(new)}, removidas {len(gone)}, quota restante hoje {budget}"
        f"{' (simulação)' if dry_run else ''}"
        f"{f', ignoradas por prazo < 72 h: {len(skipped)}' if skipped else ''}"
        f"{', fila priorizada' if meta else ''}"
    )
    if args.simulate:
        report_simulation(new, meta, current, args.simulate, now_dt)
        return 0
    if dry_run or not plan or budget == 0:
        return 0

    session = authorized_session(key_path)
    sent = errors = 0
    exhausted = False
    for url, kind in plan[:budget]:
        response = session.post(ENDPOINT, json={"url": url, "type": kind}, timeout=30)
        if response.status_code == 429:
            print("[indexing] quota da API esgotada (429)")
            exhausted = True
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
    # Com 429 não vale a pena tentar de novo até o Google reiniciar a quota.
    state["used"] = quota if exhausted else int(state.get("used", 0)) + sent
    save_state(state_path, state)
    print(f"[indexing] enviados {sent} pedidos ({errors} erros)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
