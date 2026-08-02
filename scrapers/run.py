#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from common.api_client import ingest_jobs
from sources import SCRAPERS


def run_source(slug: str, dry_run: bool = False) -> dict:
    scraper_cls = SCRAPERS[slug]
    scraper = scraper_cls()
    started = time.time()
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
        }

    result = ingest_jobs(slug, jobs)
    print(f"[{slug}] ingestão: {result}")
    return {"source": slug, "found": len(jobs), "ingest": result, "elapsed": elapsed}


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrapers privados VagaSaúde")
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
        try:
            summaries.append(run_source(slug, dry_run=args.dry_run))
        except Exception as exc:  # noqa: BLE001 - reportar e continuar outras fontes
            print(f"[{slug}] ERRO: {exc}", file=sys.stderr)
            summaries.append({"source": slug, "error": str(exc)})

    print(json.dumps({"ok": True, "results": summaries}, ensure_ascii=False, indent=2))
    return 0 if all("error" not in item for item in summaries) else 1


if __name__ == "__main__":
    raise SystemExit(main())
