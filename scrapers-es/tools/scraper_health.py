#!/usr/bin/env python3
"""Aviso de fontes avariadas: últimas N execuções com 0 vagas ou erro.

Uso (no fim do run-scrapers.sh):
    python3 tools/scraper_health.py /var/www/<site>/data/scraper-runs.json

Envia email (Resend) só quando a lista de fontes avariadas muda, se
RESEND_API_KEY, EMAIL_FROM e ALERTS_TO estiverem definidos; senão só imprime.
Fontes esperadas fora do VPS podem ser ignoradas com HEALTH_IGNORE=a,b.
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from pathlib import Path

import httpx

RUNS_TO_CHECK = int(os.environ.get("HEALTH_RUNS", "4"))


def broken_sources(runs: list[dict], ignore: set[str]) -> dict[str, str]:
    by_source: dict[str, list[dict]] = defaultdict(list)
    for run in runs:
        by_source[run.get("source") or "?"].append(run)
    broken: dict[str, str] = {}
    for source, items in by_source.items():
        if source in ignore:
            continue
        recent = sorted(items, key=lambda r: r.get("startedAt") or "", reverse=True)
        recent = recent[:RUNS_TO_CHECK]
        if len(recent) < RUNS_TO_CHECK:
            continue
        if all(r.get("status") == "error" or not r.get("found") for r in recent):
            last = recent[0]
            reason = (last.get("error") or "0 vagas")[:160]
            broken[source] = f"{reason} (desde {(recent[-1].get('startedAt') or '?')[:16]})"
    return broken


def send_email(subject: str, body: str) -> None:
    key = os.environ.get("RESEND_API_KEY")
    sender = os.environ.get("EMAIL_FROM")
    to = os.environ.get("ALERTS_TO")
    if not (key and sender and to):
        return
    httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {key}"},
        json={
            "from": sender,
            "to": [a.strip() for a in to.split(",") if a.strip()],
            "subject": subject,
            "text": body,
        },
        timeout=30,
    ).raise_for_status()


def main() -> int:
    runs_path = Path(sys.argv[1])
    state_path = runs_path.with_name("scraper-health-state.json")
    data = json.loads(runs_path.read_text(encoding="utf-8"))
    runs = data if isinstance(data, list) else data.get("runs", [])
    ignore = {s for s in os.environ.get("HEALTH_IGNORE", "").split(",") if s}
    broken = broken_sources(runs, ignore)

    for source, reason in sorted(broken.items()):
        print(f"[scraper-health] AVARIADA {source}: {reason}")
    if not broken:
        print("[scraper-health] todas as fontes OK")

    try:
        previous = set(json.loads(state_path.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        previous = set()
    current = set(broken)
    if current != previous:
        site = os.environ.get("NEXT_PUBLIC_SITE_URL") or runs_path.parent.parent.name
        lines = [f"- {s}: {broken[s]}" for s in sorted(current)] or ["(nenhuma)"]
        body = "Fontes avariadas:\n" + "\n".join(lines)
        recovered = sorted(previous - current)
        if recovered:
            body += "\n\nRecuperadas: " + ", ".join(recovered)
        try:
            send_email(f"[VagaSaúde] scrapers {site}: {len(current)} avariada(s)", body)
        except httpx.HTTPError as exc:
            print(f"[scraper-health] email falhou: {exc}")
        state_path.write_text(json.dumps(sorted(current)), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
