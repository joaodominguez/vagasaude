from __future__ import annotations

import time
from typing import Any

import httpx

DEFAULT_HEADERS = {
    "User-Agent": "VagaSaudeBot/1.0 (+https://vagasaude.pt/bot)",
    "Accept": "application/json, text/html, */*",
}


class HttpClient:
    def __init__(self, timeout: float = 30.0, min_interval: float = 0.4):
        self.client = httpx.Client(
            timeout=timeout,
            headers=DEFAULT_HEADERS,
            follow_redirects=True,
        )
        self.min_interval = min_interval
        self._last_request = 0.0

    def close(self) -> None:
        self.client.close()

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_request
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self._last_request = time.monotonic()

    def get_json(self, url: str, **kwargs: Any) -> Any:
        self._throttle()
        response = self.client.get(url, **kwargs)
        response.raise_for_status()
        return response.json()

    def get_text(self, url: str, **kwargs: Any) -> str:
        self._throttle()
        response = self.client.get(url, **kwargs)
        response.raise_for_status()
        return response.text
