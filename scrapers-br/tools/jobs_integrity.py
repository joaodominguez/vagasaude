#!/usr/bin/env python3
"""Vigia a integridade do jobs.json (o incidente BR de 2026-10-27).

Nesse dia o jobs.json do BR foi recriado do zero: milhares de vagas já indexadas
passaram a 404 e o tráfego do Google for Jobs caiu. O código nunca apaga vagas do
ficheiro (só muda o estado para expired/duplicate), por isso o conjunto de slugs
só pode crescer. Este script corre no fim de cada run-scrapers.sh e verifica:

  1. o jobs.json lê-se e tem vagas;
  2. nenhum slug que existia na execução anterior desapareceu (URLs a 404);
  3. o total de entradas não diminuiu e as publicadas não caíram mais de 30%;
  4. o ficheiro foi atualizado nas últimas horas (scrapers não pararam);
  5. páginas de amostra (vagas novas e expiradas) respondem 200 na app local.

Uso:
    python3 tools/jobs_integrity.py <data_dir> <base_url_local> <prefixo_url>
    ex.: python3 tools/jobs_integrity.py /var/www/vagasaude/data http://127.0.0.1:3010 /vagas/

Imprime sempre o resultado. Envia email (Resend: RESEND_API_KEY, EMAIL_FROM,
ALERTS_TO) quando a lista de problemas muda e, enquanto persistir, no máximo um
lembrete por dia.
"""
from __future__ import annotations

import json
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

# Slugs desaparecidos tolerados (ex.: reparação pontual de um slug malformado).
MAX_MISSING_SLUGS = int(os.environ.get("INTEGRITY_MAX_MISSING", "10"))
MAX_PUBLISHED_DROP = float(os.environ.get("INTEGRITY_MAX_PUBLISHED_DROP", "0.30"))
MAX_AGE_HOURS = float(os.environ.get("INTEGRITY_MAX_AGE_HOURS", "13"))
REMIND_EVERY_SECONDS = 24 * 3600


def load_jobs(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    jobs = data.get("jobs") if isinstance(data, dict) else data
    if not isinstance(jobs, list):
        raise ValueError("formato inesperado (sem lista de vagas)")
    return jobs


def http_status(url: str) -> int:
    try:
        return httpx.get(url, timeout=30, follow_redirects=False).status_code
    except httpx.HTTPError:
        return 0


def check(data_dir: Path, base_url: str, prefix: str, previous: dict) -> tuple[list[str], dict]:
    problems: list[str] = []
    jobs_path = data_dir / "jobs.json"
    try:
        jobs = load_jobs(jobs_path)
    except (OSError, ValueError) as exc:
        return [f"jobs.json ilegível: {exc}"], previous
    if not jobs:
        return ["jobs.json sem vagas"], previous

    slugs = {j.get("slug") for j in jobs if j.get("slug")}
    published = [j for j in jobs if j.get("status") == "published"]
    expired = [j for j in jobs if j.get("status") == "expired" and j.get("slug")]

    prev_slugs = set(previous.get("slugs") or [])
    missing = sorted(prev_slugs - slugs)
    lost_urls = len(missing) > MAX_MISSING_SLUGS
    if lost_urls:
        # Confirmar na app que os URLs estão mesmo a 404 (não só ausentes do ficheiro).
        codes = [f"{s} → {http_status(base_url + prefix + s)}" for s in missing[:3]]
        problems.append(
            f"{len(missing)} vagas desapareceram do jobs.json desde a última execução "
            f"(URLs indexados podem dar 404). Ex.: {'; '.join(codes)}"
        )

    prev_total = int(previous.get("total") or 0)
    if prev_total and len(jobs) < prev_total:
        problems.append(f"total de vagas no ficheiro desceu: {prev_total} → {len(jobs)}")

    prev_pub = int(previous.get("published") or 0)
    if prev_pub >= 50 and len(published) < prev_pub * (1 - MAX_PUBLISHED_DROP):
        problems.append(f"vagas publicadas caíram: {prev_pub} → {len(published)}")

    age_h = (time.time() - jobs_path.stat().st_mtime) / 3600
    if age_h > MAX_AGE_HOURS:
        problems.append(f"jobs.json sem atualizações há {age_h:.0f} h (scrapers parados?)")

    newest = sorted(published, key=lambda j: j.get("createdAt") or "", reverse=True)[:3]
    sample_jobs = newest + random.sample(expired, min(2, len(expired)))
    bad = []
    for job in sample_jobs:
        code = http_status(base_url + prefix + job["slug"])
        if code != 200:
            bad.append(f"{prefix}{job['slug']} → {code}")
    if bad:
        problems.append("páginas de vaga sem 200: " + "; ".join(bad))

    # Com perda de URLs, manter a referência antiga: o alerta persiste até as vagas voltarem.
    keep_old = lost_urls or (prev_total and len(jobs) < prev_total)
    state = {
        "slugs": sorted(prev_slugs) if keep_old else sorted(slugs),
        "total": max(len(jobs), prev_total) if keep_old else len(jobs),
        "published": len(published),
        "checkedAt": datetime.now(timezone.utc).isoformat(),
    }
    return problems, state


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
    )


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__)
        return 2
    data_dir, base_url, prefix = Path(sys.argv[1]), sys.argv[2].rstrip("/"), sys.argv[3]
    state_path = data_dir / "jobs-integrity-state.json"
    try:
        previous = json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        previous = {}

    problems, state = check(data_dir, base_url, prefix, previous.get("snapshot") or {})
    site = os.environ.get("NEXT_PUBLIC_SITE_URL") or data_dir.parent.name
    for p in problems:
        print(f"[jobs-integrity] PROBLEMA {site}: {p}")
    if not problems:
        print(f"[jobs-integrity] {site}: OK ({state['total']} vagas, {state['published']} publicadas)")

    signature = sorted(p.split(":")[0] for p in problems)
    last_sig = previous.get("alertSignature") or []
    last_sent = float(previous.get("alertSentAt") or 0)
    now = time.time()
    if signature != last_sig or (problems and now - last_sent > REMIND_EVERY_SECONDS):
        if problems:
            body = "Problemas de integridade do jobs.json:\n" + "\n".join(f"- {p}" for p in problems)
            body += (
                "\n\nRecuperação: o jobs.json.bak-daily-* mais recente está na mesma pasta "
                "do jobs.json."
            )
            subject = f"[VagaSaúde] ALERTA jobs.json {site}: {len(problems)} problema(s)"
        else:
            body = "A integridade do jobs.json voltou ao normal."
            subject = f"[VagaSaúde] jobs.json {site}: recuperado"
        try:
            send_email(subject, body)
            last_sent = now
        except httpx.HTTPError as exc:
            print(f"[jobs-integrity] email falhou: {exc}")

    state_path.write_text(
        json.dumps({"snapshot": state, "alertSignature": signature, "alertSentAt": last_sent}),
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
