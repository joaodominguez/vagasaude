from __future__ import annotations

import re
import time
from datetime import datetime, timedelta, timezone
from html import unescape
from urllib.parse import urljoin

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
ARCHIVE_URL = f"{BASE}/category/recrutamento/"
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
PT_MONTHS = {
    "janeiro": 1,
    "fevereiro": 2,
    "marco": 3,
    "abril": 4,
    "maio": 5,
    "junho": 6,
    "julho": 7,
    "agosto": 8,
    "setembro": 9,
    "outubro": 10,
    "novembro": 11,
    "dezembro": 12,
}


class PharmabscScraper(BaseScraper):
    slug = "pharmabsc"
    name = "PHARMABSC — Recrutamento farmácia"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.35)
        try:
            jobs = self._fetch_http(client)
            if jobs:
                return jobs
        finally:
            client.close()
        return self._fetch_browser()

    def _fetch_http(self, client: HttpClient) -> list[JobPayload]:
        try:
            posts = _list_posts_http(client)
        except httpx.HTTPError:
            return []
        if not posts:
            return []
        jobs: list[JobPayload] = []
        challenged = 0
        for post in posts:
            url = (post.get("link") or "").strip()
            try:
                html = client.get_text(url)
            except httpx.HTTPError:
                challenged += 1
                continue
            if not _is_real_detail(html):
                challenged += 1
                continue
            item = {
                "title": _plain(post.get("title", {}).get("rendered") or ""),
                "url": url,
                "source_id": str(post.get("slug") or post.get("id") or "").strip(),
                "published_at": post.get("date_gmt") or post.get("date"),
                "categories": post.get("categories") or [],
            }
            job = _to_job(item, html)
            if job:
                jobs.append(job)
        if challenged and not jobs:
            return []
        if challenged > max(2, len(posts) // 2):
            return []
        return jobs

    def _fetch_browser(self) -> list[JobPayload]:
        with BrowserSession(min_interval=1.0) as browser:
            items = _list_archive(browser)
            jobs: list[JobPayload] = []
            for item in items:
                html = _browser_html(
                    browser,
                    item["url"],
                    wait_selector=".mfn-builder-content, h1",
                )
                job = _to_job(item, html)
                if job:
                    jobs.append(job)
            return jobs


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


def _list_archive(browser: BrowserSession) -> list[dict]:
    items: list[dict] = []
    seen: set[str] = set()
    for page in range(1, 6):
        url = ARCHIVE_URL if page == 1 else f"{ARCHIVE_URL}page/{page}/"
        html = _browser_html(browser, url, wait_selector="article")
        found = _parse_archive(html)
        new = 0
        for item in found:
            if item["url"] in seen:
                continue
            seen.add(item["url"])
            items.append(item)
            new += 1
        if new == 0:
            break
    return items


def _parse_archive(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    items: list[dict] = []
    for article in soup.select("article"):
        link = article.select_one(".post-title a[href], h2 a[href], h4 a[href]")
        if not link:
            continue
        url = urljoin(BASE, (link.get("href") or "").strip())
        title = re.sub(r"\s+", " ", link.get_text(" ", strip=True)).strip()
        if not url or not title:
            continue
        date_el = article.select_one(".date_label, time")
        published = _parse_pt_date(
            date_el.get_text(" ", strip=True) if date_el else ""
        ) or (date_el.get("datetime") if date_el is not None else None)
        source_id = url.rstrip("/").rsplit("/", 1)[-1]
        items.append(
            {
                "title": title,
                "url": url.split("#")[0],
                "source_id": source_id,
                "published_at": published,
                "categories": [OPEN_CATEGORY],
            }
        )
    return items


def _browser_html(
    browser: BrowserSession, url: str, *, wait_selector: str | None = None
) -> str:
    last_error: Exception | None = None
    for attempt in range(5):
        try:
            browser.open(url, wait_selector=wait_selector, settle_ms=1500)
            html = browser.html()
            if html and "Access denied by Imunify360" not in html:
                return html
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            time.sleep(1.2 + attempt * 0.6)
    if last_error:
        raise last_error
    return ""


def _to_job(item: dict, html: str) -> JobPayload | None:
    if CLOSED_CATEGORY in (item.get("categories") or []):
        return None
    title = item.get("title") or ""
    if not title or _is_spontaneous(title):
        return None
    if _too_old(item.get("published_at") or ""):
        return None
    url = item.get("url") or ""
    source_id = str(item.get("source_id") or "").strip()
    if not url or not source_id:
        return None
    description = _extract_description(html)
    if len(description) < 80:
        description = title
    _, place = _split_place(title)
    district = guess_district(place, description[:280])
    return JobPayload(
        title=title,
        company="PHARMABSC",
        location_district=district,
        location_concelho=_concelho(place, district),
        profession=guess_profession(title, description[:240]),
        specialty=None,
        sector="privado",
        contract_type=guess_contract(f"{title} {description[:400]}"),
        description=description[:8000],
        requirements=None,
        salary=None,
        application_url=_application_url(html, url),
        source="pharmabsc",
        source_id=source_id,
        published_at=item.get("published_at"),
    )


def _is_real_detail(html: str) -> bool:
    return len(html) > 20_000 and (
        "mfn-builder-content" in html or "post-wrapper-content" in html
    )


def _plain(value: str) -> str:
    text = unescape(re.sub(r"<[^>]+>", " ", value or ""))
    return re.sub(r"\s+", " ", text).strip()


def _too_old(date_str: str) -> bool:
    parsed = _parse_iso(date_str) or _parse_pt_date(date_str)
    if not parsed:
        return False
    try:
        dt = datetime.fromisoformat(parsed.replace("Z", "+00:00"))
    except ValueError:
        return False
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - dt > timedelta(days=MAX_AGE_DAYS)


def _parse_iso(date_str: str) -> str | None:
    if not date_str or not re.match(r"\d{4}-\d{2}-\d{2}", date_str):
        return None
    return date_str


def _parse_pt_date(value: str) -> str | None:
    match = re.search(
        r"\b(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|"
        r"agosto|setembro|outubro|novembro|dezembro)\s+(\d{1,2}),\s*(\d{4})\b",
        value or "",
        re.I,
    )
    if not match:
        return None
    month_key = norm(match.group(1)).replace("ç", "c")
    month = PT_MONTHS.get(month_key)
    if not month:
        return None
    day = int(match.group(2))
    year = int(match.group(3))
    return f"{year:04d}-{month:02d}-{day:02d}T00:00:00+00:00"


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
