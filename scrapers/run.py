#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
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
            result = {
                "source": slug,
                "found": len(jobs),
                "dry_run": True,
                "elapsed": elapsed,
                "status": "ok",
            }
        else:
            ingest = ingest_jobs(slug, jobs)
            print(f"[{slug}] ingestão: {ingest}")
            result = {
                "source": slug,
                "found": len(jobs),
                "ingest": ingest,
                "elapsed": elapsed,
                "status": "ok",
            }

        if not dry_run:
            report_scraper_run(
                {
                    "source": slug,
                    "status": "ok",
                    "found": len(jobs),
                    "created": (result.get("ingest") or {}).get("created"),
                    "updated": (result.get("ingest") or {}).get("updated"),
                    "ignored": (result.get("ingest") or {}).get("ignored"),
                    "review": (result.get("ingest") or {}).get("review"),
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
        return {"source": slug, "error": str(exc), "status": "error", "elapsed": elapsed}


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrapers VagaSaúde")
    parser.add_argument(
        "--source",
        choices=sorted(SCRAPERS.keys()) + ["all"],
        default="all",
        help="Fonte a executar",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Apenas lista vagas, sem enviar para a API",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Executa uma vez (comportamento por defeito)",
    )
    args = parser.parse_args()

    sources = sorted(SCRAPERS.keys()) if args.source == "all" else [args.source]
    summaries = []
    for slug in sources:
        summaries.append(run_source(slug, dry_run=args.dry_run))

    print(json.dumps({"ok": True, "results": summaries}, ensure_ascii=False, indent=2))
    return 0 if all(item.get("status") != "error" and "error" not in item for item in summaries) else 1


if __name__ == "__main__":
    raise SystemExit(main())
