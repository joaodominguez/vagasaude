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


def run_source(slug: str, dry_run: bool = False) -> dict:
    scraper_cls = SCRAPERS[slug]
    scraper = scraper_cls()
    started = time.time()
    started_at = datetime.now(timezone.utc).isoformat()
    try:
        jobs = scraper.fetch()
        elapsed = round(time.time() - started, 2)
        print(f"[{slug}] {len(jobs)} ofertas en {elapsed}s")

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
            expire_missing = True
            if hasattr(scraper, "last_listings_complete"):
                expire_missing = bool(getattr(scraper, "last_listings_complete"))
                if not expire_missing:
                    print(
                        f"[{slug}] soft-expire desligado "
                        f"(lote incompleto: {len(jobs)} ofertas)"
                    )
            ingest = ingest_jobs(slug, jobs, expire_missing=expire_missing)
            print(f"[{slug}] ingesta: {ingest}")
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
    parser = argparse.ArgumentParser(description="Scrapers VacantesSalud (España)")
    parser.add_argument(
        "--source",
        choices=sorted(SCRAPERS.keys()) + ["all"],
        default="all",
        help="Fuente a ejecutar",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo lista ofertas, sin enviarlas a la API",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Ejecuta una vez (comportamiento por defecto)",
    )
    args = parser.parse_args()

    if not SCRAPERS:
        print("No hay scrapers registrados todavía (scrapers-es/sources/__init__.py).")
        return 0
    sources = sorted(SCRAPERS.keys()) if args.source == "all" else [args.source]
    summaries = []
    for slug in sources:
        summaries.append(run_source(slug, dry_run=args.dry_run))

    print(json.dumps({"ok": True, "results": summaries}, ensure_ascii=False, indent=2))
    return 0 if all(item.get("status") != "error" and "error" not in item for item in summaries) else 1


if __name__ == "__main__":
    raise SystemExit(main())
