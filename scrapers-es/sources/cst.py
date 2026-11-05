"""Consorci Sanitari de Terrassa: oferta-treball-sitemap.xml (ca + es duplicados) + ficha de cada oferta."""
from __future__ import annotations

import html as html_lib
import re

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import html_to_text, norm

from ._siscat_es import DetailCache, build_job, cached_detail, dmy_to_iso

SITEMAP = "https://cst.cat/oferta-treball-sitemap.xml"
COMPANY = "Consorci Sanitari de Terrassa"
MAX_JOBS = 150

_LOC_RE = re.compile(r"<loc>([^<]+)</loc>")
_REF_RE = re.compile(r"-ref-(\d+)/?$")
_TITLE_REF_RE = re.compile(r"\s*[–-]\s*Ref\.?\s*\d+\s*$", re.I)


def offer_key(url: str) -> str:
    """Id de oferta común a las versiones ca/es: 'ref-NNN'; sin ref, la palabra más larga del slug."""
    slug = url.rstrip("/").rsplit("/", 1)[-1]
    ref = _REF_RE.search(url)
    if ref:
        return f"ref-{ref.group(1)}"
    words = sorted(slug.split("-"), key=len, reverse=True)
    return f"slug-{words[0][:8]}"


def pick_urls(xml: str) -> dict[str, str]:
    """key -> URL, prefiriendo la versión en español (/es/)."""
    chosen: dict[str, str] = {}
    for url in (html_lib.unescape(u) for u in _LOC_RE.findall(xml)):
        if "/oferta-treball/" not in url:
            continue
        key = offer_key(url)
        if key not in chosen or ("/es/" in url and "/es/" not in chosen[key]):
            chosen[key] = url
    return chosen


def _stems(title: str) -> set[str]:
    return {w[:5] for w in norm(title).split() if len(w) > 4}


def drop_cross_language_dupes(jobs: list[JobPayload]) -> list[JobPayload]:
    """Algunas ofertas tienen ref distinta en ca y es (p. ej. 552/582): misma fecha y títulos casi
    idénticos tras reducir las palabras a su raíz -> se conserva la primera (la versión en español)."""
    kept: list[JobPayload] = []
    for job in sorted(jobs, key=lambda j: "/es/" not in j.application_url):
        stems = _stems(job.title)
        dupe = any(
            k.published_at == job.published_at and stems and len(stems & _stems(k.title)) / len(stems | _stems(k.title)) >= 0.8
            for k in kept
        )
        if not dupe:
            kept.append(job)
    return kept


def parse_detail(page: str) -> dict:
    soup = BeautifulSoup(page, "html.parser")
    ti = soup.select_one(".csm-in-lft li.ti")
    block = soup.select_one(".bors-rgt .j-des li")
    title = ""
    parts: list[str] = []
    if block:
        h2 = block.find("h2")
        title = h2.get_text(" ", strip=True) if h2 else ""
        for p in block.find_all(["p", "ul"]):
            parts.append(html_to_text(str(p)))
    return {
        "title": _TITLE_REF_RE.sub("", title).strip(),
        "description": "\n\n".join(x for x in parts if x),
        "published": ti.get_text(strip=True) if ti else None,
    }


class CstScraper(BaseScraper):
    slug = "cst"
    name = "Consorci Sanitari de Terrassa — Bolsa de trabajo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        cache = DetailCache(self.slug)
        jobs: list[JobPayload] = []
        complete = True
        try:
            urls = pick_urls(client.get_text(SITEMAP))
            if not urls:
                raise RuntimeError("sitemap del CST sin ofertas")
            for key, url in list(urls.items())[:MAX_JOBS]:
                detail = cached_detail(cache, key, lambda u=url: parse_detail(client.get_text(u)))
                if not detail or not detail.get("title"):
                    complete = False
                    continue
                job = build_job(
                    slug=self.slug,
                    company=COMPANY,
                    title=detail["title"],
                    city="Terrassa",
                    description=detail.get("description", ""),
                    source_id=key,
                    url=url,
                    published_at=dmy_to_iso(detail.get("published")),
                )
                if job:
                    jobs.append(job)
        finally:
            client.close()
        cache.save(prune=complete)
        self.last_listings_complete = complete
        return drop_cross_language_dupes(jobs)
