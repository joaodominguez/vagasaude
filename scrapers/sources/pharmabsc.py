from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from html import unescape

import httpx
from bs4 import BeautifulSoup

from common.browser import BrowserSession
from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_district,
    guess_profession,
    html_to_text,
    norm,
)

BASE = "https://pharmabsc.pt"
API_URL = f"{BASE}/wp-json/wp/v2/posts"
OPEN_CATEGORY = 9  # Recrutamento
CLOSED_CATEGORY = 89  # Recrutamentos fechados
# Posts esquecidos na categoria aberta (2024/2025) não são vagas activas.
MAX_AGE_DAYS = 365

SKIP_PLACE = {
    "part time",
    "parttime",
    "tempo inteiro",
    "full time",
    "fulltime",
    "farmacia comunitaria",
    "noite",
}
APPLY_HOSTS = (
    "app.pharmabsc.pt",
    "forms.gle",
    "docs.google.com",
    "alertaemprego.pt",
)


class PharmabscScraper(BaseScraper):
    slug = "pharmabsc"
    name = "PHARMABSC — Recrutamento farmácia"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.35)
        try:
            posts = self._list_posts(client)
            jobs: list[JobPayload] = []
            for post in posts:
                job = self._to_job(client, post)
                if job:
                    jobs.append(job)
            return jobs
        finally:
            client.close()

    def _list_posts(self, client: HttpClient) -> list[dict]:
        try:
            posts = _list_posts_http(client)
        except httpx.HTTPError:
            posts = []
        if posts:
            return posts
        return _list_posts_browser()

    def _to_job(self, client: HttpClient, post: dict) -> JobPayload | None:
        if CLOSED_CATEGORY in (post.get("categories") or []):
            return None
        title = _plain(post.get("title", {}).get("rendered") or "")
        if not title or _is_spontaneous(title):
            return None
        if _too_old(post.get("date_gmt") or post.get("date") or ""):
            return None

        url = (post.get("link") or "").strip()
        source_id = str(post.get("id") or post.get("slug") or "").strip()
        if not url or not source_id:
            return None

        html = _detail_html(client, url)
        description = _extract_description(html) or _plain(
            post.get("excerpt", {}).get("rendered") or ""
        )
        if len(description) < 80:
            description = title
        apply_url = _application_url(html, url)
        _, place = _split_place(title)
        district = guess_district(place, description[:280])
        concelho = _concelho(place, district)
        published = post.get("date_gmt") or post.get("date")

        return JobPayload(
            title=title,
            company="PHARMABSC",
            location_district=district,
            location_concelho=concelho,
            profession=guess_profession(title, description[:240]),
            specialty=None,
            sector="privado",
            contract_type=guess_contract(f"{title} {description[:400]}"),
            description=description[:8000],
            requirements=None,
            salary=None,
            application_url=apply_url,
            source=self.slug,
            source_id=source_id,
            published_at=published,
        )


def _list_posts_http(client: HttpClient) -> list[dict]:
    posts: list[dict] = []
    for page in range(1, 6):
        batch = client.get_json(
            API_URL,
            params={
                "categories": OPEN_CATEGORY,
                "per_page": 100,
                "page": page,
                "status": "publish",
            },
        )
        if not isinstance(batch, list) or not batch:
            break
        posts.extend(item for item in batch if isinstance(item, dict))
        if len(batch) < 100:
            break
    return posts


def _list_posts_browser() -> list[dict]:
    with BrowserSession(min_interval=0.8) as browser:
        html = browser.get_text(
            f"{API_URL}?categories={OPEN_CATEGORY}&per_page=100&status=publish",
            settle_ms=1500,
        )
    soup = BeautifulSoup(html, "lxml")
    raw = soup.get_text().strip()
    data = json.loads(raw)
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    return []


def _detail_html(client: HttpClient, url: str) -> str:
    try:
        html = client.get_text(url)
    except httpx.HTTPError:
        html = ""
    if _is_real_detail(html):
        return html
    with BrowserSession(min_interval=0.8) as browser:
        return browser.get_text(url, wait_selector=".mfn-builder-content, h1", settle_ms=1500)


def _is_real_detail(html: str) -> bool:
    return len(html) > 20_000 and (
        "mfn-builder-content" in html or "post-wrapper-content" in html
    )


def _plain(value: str) -> str:
    text = unescape(re.sub(r"<[^>]+>", " ", value or ""))
    return re.sub(r"\s+", " ", text).strip()


def _too_old(date_str: str) -> bool:
    if not date_str:
        return False
    try:
        parsed = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except ValueError:
        return False
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - parsed > timedelta(days=MAX_AGE_DAYS)


def _is_spontaneous(title: str) -> bool:
    t = norm(title)
    return "candidatura espontanea" in t or t.startswith("bolsa de")


def _split_place(title: str) -> tuple[str, str]:
    parts = [part.strip() for part in re.split(r"\s*\|\s*", title) if part.strip()]
    if not parts:
        return title, ""
    places: list[str] = []
    for part in parts[1:]:
        key = norm(part)
        if key in SKIP_PLACE or "part time" in key:
            continue
        places.append(part)
    return parts[0], (places[-1] if places else "")


def _concelho(place: str, district: str) -> str:
    cleaned = place.strip()
    match = re.search(r"\(([^)]+)\)", cleaned)
    if match:
        inner = match.group(1).strip()
        if guess_district(inner) != "Portugal":
            return inner
    return cleaned or district


def _extract_description(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    block = soup.select_one(".mfn-builder-content") or soup.select_one(
        ".post-wrapper-content"
    )
    if not block:
        return ""
    for junk in block.select(
        ".section-post-related, .post-related, .section-post-comments, "
        ".share_wrapper, .button_theme"
    ):
        junk.decompose()
    text = html_to_text(str(block))
    text = re.sub(r"\n(?:AGENDAR REUNIÃO|QUERO CANDIDATAR-ME)\s*", "\n", text)
    return text.strip()


def _application_url(html: str, fallback: str) -> str:
    hrefs = re.findall(r'href="([^"]+)"', html, flags=re.I)
    for href in hrefs:
        lower = href.lower()
        if any(host in lower for host in APPLY_HOSTS):
            return href.strip()
        if lower.startswith("mailto:"):
            return href.strip()
    return fallback
