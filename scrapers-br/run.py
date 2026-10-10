#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from common.api_client import ingest_jobs
from common.scraper_runs import report_scraper_run
from sources import SCRAPERS

# Fontes bloqueadas no VPS Hetzner (Cloudflare ASN / error 1005).
# Continuam executáveis com --source <slug> a partir de um host não bloqueado.
DEFAULT_SKIP_ON_ALL = "einstein,fleury"

VAGAS_COM_SKIP_MSG = (
    "Skip no VPS: Cloudflare 1005/403 em vagas.com.br (ASN Hetzner). "
    "Correr off-VPS: python run.py --source {slug} "
    "(ver run-vagas-com-off-vps.sh)."
)


def skip_sources_on_all() -> set[str]:
    raw = os.environ.get("SKIP_SOURCES", DEFAULT_SKIP_ON_ALL)
    return {part.strip() for part in raw.split(",") if part.strip()}


def run_skipped(slug: str) -> dict:
    """Skip intencional no --source all.

    Por omissão NÃO reporta ao admin — preserva a última corrida OK off-VPS.
    Com REPORT_SKIPS=1 regista status skipped (requer app BR com suporte).
    """
    started_at = datetime.now(timezone.utc).isoformat()
    msg = (
        VAGAS_COM_SKIP_MSG.format(slug=slug)
        if slug in {"einstein", "fleury"}
        else f"Skip intencional ({slug}): listado em SKIP_SOURCES / --source all."
    )
    print(f"[{slug}] SKIP — {msg}")
    if os.environ.get("REPORT_SKIPS", "").strip() in {"1", "true", "yes"}:
        report_scraper_run(
            {
                "source": slug,
                "status": "skipped",
                "found": 0,
                "elapsed": 0,
                "startedAt": started_at,
                "error": msg,
            }
        )
    return {
        "source": slug,
        "found": 0,
        "elapsed": 0,
        "status": "skipped",
        "error": msg,
    }


def run_source(slug: str, dry_run: bool = False) -> dict:
    scraper_cls = SCRAPERS[slug]
    scraper = scraper_cls()
    started = time.time()
    started_at = datetime.now(timezone.utc).isoformat()
    try:
        jobs = scraper.fetch()
        elapsed = round(time.time() - started, 2)
        print(f"[{slug}] {len(jobs)} vagas em {elapsed}s")

        if dry_run:
            preview = [job.to_dict() for job in jobs[:3]]
            print(json.dumps(preview, ensure_ascii=False, indent=2))
            return {
                "source": slug,
                "found": len(jobs),
                "dry_run": True,
                "elapsed": elapsed,
                "status": "ok",
            }

        ingest = ingest_jobs(slug, jobs)
        print(f"[{slug}] ingestão: {ingest}")
        result = {
            "source": slug,
            "found": len(jobs),
            "ingest": ingest,
            "elapsed": elapsed,
            "status": "ok",
        }
        report_scraper_run(
            {
                "source": slug,
                "status": "ok",
                "found": len(jobs),
                "created": (ingest or {}).get("created"),
                "updated": (ingest or {}).get("updated"),
                "ignored": (ingest or {}).get("ignored"),
                "review": (ingest or {}).get("review"),
                "elapsed": elapsed,
                "startedAt": started_at,
                "error": None,
            }
        )
        return result
    except Exception as exc:  # noqa: BLE001
        elapsed = round(time.time() - started, 2)
        print(f"[{slug}] ERRO: {exc}", file=sys.stderr)
        if not dry_run:
            report_scraper_run(
                {
                    "source": slug,
                    "status": "error",
                    "found": 0,
                    "elapsed": elapsed,
                    "startedAt": started_at,
                    "error": str(exc),
                }
            )
        return {
            "source": slug,
            "error": str(exc),
            "status": "error",
            "elapsed": elapsed,
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrapers VagaSaúde Brasil")
    parser.add_argument(
        "--source",
        choices=sorted(SCRAPERS.keys()) + ["all"],
        default="all",
        help="Fonte a executar",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Lista vagas sem enviar para a API BR",
    )
    args = parser.parse_args()

    skip = skip_sources_on_all()
    if args.source == "all":
        sources = sorted(SCRAPERS.keys())
        summaries = []
        for slug in sources:
            if slug in skip:
                summaries.append(run_skipped(slug))
            else:
                summaries.append(run_source(slug, dry_run=args.dry_run))
    else:
        # Pedido explícito --source <slug>: corre mesmo se estiver em SKIP_SOURCES
        # (caminho off-VPS para Einstein / vagas.com.br).
        summaries = [run_source(args.source, dry_run=args.dry_run)]

    print(json.dumps({"ok": True, "results": summaries}, ensure_ascii=False, indent=2))
    # skipped não conta como falha; só error faz exit 1
    return 0 if all(item.get("status") in {"ok", "skipped"} for item in summaries) else 1


if __name__ == "__main__":
    raise SystemExit(main())
