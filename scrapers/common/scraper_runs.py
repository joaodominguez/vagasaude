from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import httpx


def report_scraper_run(payload: dict[str, Any]) -> dict[str, Any] | None:
    """Envia o resultado de uma execução para a app (histórico no admin)."""
    base = (
        os.environ.get("INGEST_BASE_URL") or "http://127.0.0.1:3010"
    ).rstrip("/")
    auth = os.environ.get("SCRAPER_API_TOKEN") or ""
    if not auth:
        return None

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth}",
    }
    body = {
        **payload,
        "finishedAt": payload.get("finishedAt")
        or datetime.now(timezone.utc).isoformat(),
    }
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{base}/api/scraper-runs",
                json=body,
                headers=headers,
            )
            response.raise_for_status()
            return response.json()
    except Exception as exc:  # noqa: BLE001
        print(f"[scraper-runs] aviso: {exc}")
        return None
