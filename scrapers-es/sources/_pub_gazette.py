"""Base y parsers comunes para boletines oficiales autonómicos con feed (RSS/Atom) o sumario HTML.

Los boletines publican solo el día en curso en el feed (o los últimos), por lo que estas fuentes deben
ejecutarse a diario; `last_listings_complete = False` siempre (cada lote es parcial).
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape

from common.http import HttpClient
from common.models import BaseScraper, JobPayload

from ._pub_common import Entry, jobs_from_entries


def get_bytes(client: HttpClient, url: str, **kwargs) -> bytes:
    client._throttle()  # noqa: SLF001 — mismo throttle que get_text/get_json
    response = client.client.get(url, **kwargs)
    response.raise_for_status()
    return response.content


def clean_text(value: str | None) -> str:
    value = unescape(value or "")
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def parse_pubdate(value: str | None) -> date | None:
    if not value:
        return None
    value = value.strip()
    try:
        return parsedate_to_datetime(value).date()
    except (TypeError, ValueError, IndexError):
        pass
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def rss_items(raw: bytes) -> list[dict]:
    """Items de un RSS 2.0 como dicts (title, link, description, pubDate, guid, categories)."""
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as exc:
        raise RuntimeError(f"feed no válido: {exc}") from exc
    items = []
    for node in root.iter("item"):
        items.append(
            {
                "title": (node.findtext("title") or "").strip(),
                "link": (node.findtext("link") or "").strip(),
                "description": node.findtext("description") or "",
                "pubDate": (node.findtext("pubDate") or "").strip(),
                "guid": (node.findtext("guid") or "").strip(),
                "categories": [(c.text or "").strip() for c in node.findall("category")],
            }
        )
    return items


class GazetteScraper(BaseScraper):
    """Boletín con una o varias URLs de feed. Subclases: slug, name, gazette, region, feeds, parse(raw, url)."""

    gazette = ""
    region = ""
    feeds: tuple[str, ...] = ()
    min_interval = 0.5
    last_listings_complete = False

    def parse(self, raw: bytes, url: str) -> list[Entry]:  # pragma: no cover - interfaz
        raise NotImplementedError

    def jobs(self, entries: list[Entry], now: datetime | None = None) -> list[JobPayload]:
        return jobs_from_entries(entries, slug=self.slug, gazette=self.gazette, region=self.region, now=now)

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=self.min_interval)
        entries: list[Entry] = []
        errors = 0
        try:
            for url in self.feeds:
                try:
                    entries.extend(self.parse(get_bytes(client, url), url))
                except Exception:  # noqa: BLE001
                    errors += 1
        finally:
            client.close()
        if errors and errors == len(self.feeds):
            raise RuntimeError(f"{self.slug}: no se pudo leer ningún feed")
        seen: set[str] = set()
        unique = []
        for e in entries:
            if e.ident not in seen:
                seen.add(e.ident)
                unique.append(e)
        self.last_listings_complete = False
        return self.jobs(unique)
