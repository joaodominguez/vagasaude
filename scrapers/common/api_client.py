from __future__ import annotations

import os
from typing import Any

import httpx

from common.models import JobPayload


def ingest_jobs(
    source: str,
    jobs: list[JobPayload],
    *,
    base_url: str | None = None,
    token: str | None = None,
) -> dict[str, Any]:
    base = (base_url or os.environ.get("INGEST_BASE_URL") or "http://127.0.0.1:3010").rstrip(
        "/"
    )
    auth = token or os.environ.get("SCRAPER_API_TOKEN") or ""
    payload = {
        "source": source,
        "jobs": [job.to_dict() for job in jobs],
    }
    headers = {"Content-Type": "application/json"}
    if auth:
        headers["Authorization"] = f"Bearer {auth}"

    with httpx.Client(timeout=60.0) as client:
        response = client.post(f"{base}/api/ingest", json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
