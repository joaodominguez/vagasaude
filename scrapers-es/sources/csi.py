"""Consorci Sanitari Integral (CSI): tabla HTML de ofertas + ficha de cada oferta."""
from __future__ import annotations

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import html_to_text

from ._siscat_es import DetailCache, build_job, cached_detail, dmy_to_iso

LIST_URL = "https://www.csi.cat/treballeu-al-csi/ofertes-de-feina/"
COMPANY = "Consorci Sanitari Integral"
MAX_JOBS = 200


def centre_city(centre: str) -> str:
    c = centre.lower()
    if "sant joan desp" in c or "broggi" in c:
        return "Sant Joan Despí"
    if "dos de maig" in c and "hospitalet" not in c:
        return "Barcelona"
    if "gaud" in c:
        return "Barcelona"
    return "L'Hospitalet de Llobregat"


def parse_listing(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for tr in soup.select(".convocat-table tbody tr"):
        tds = tr.find_all("td")
        link = tr.find("a", href=True)
        if len(tds) < 4 or not link:
            continue
        cells = [td.get_text(" ", strip=True) for td in tds]
        rows.append({"title": cells[0], "centre": cells[1], "specialty": cells[2],
                     "deadline": cells[3], "url": link["href"]})
    return rows


def parse_detail(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    fields: dict[str, str] = {}
    for li in soup.select(".fitxa-cont li"):
        label = li.find("span")
        body = li.find("p")
        if label and body:
            fields[label.get_text(strip=True).lower()] = html_to_text(str(body))
    parts = []
    for key in ("què oferim?", "requisits"):
        if fields.get(key):
            parts.append(f"{key.capitalize().rstrip('?')}:\n{fields[key]}")
    return {
        "description": "\n\n".join(parts),
        "requirements": fields.get("requisits"),
        "published": fields.get("publicada el"),
        "deadline": fields.get("data límit"),
        "title": soup.find("h1").get_text(" ", strip=True) if soup.find("h1") else "",
    }


class CsiScraper(BaseScraper):
    slug = "csi"
    name = "Consorci Sanitari Integral — Ofertas"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        cache = DetailCache(self.slug)
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        complete = True
        try:
            rows = parse_listing(client.get_text(LIST_URL))[:MAX_JOBS]
            if not rows:
                raise RuntimeError("listado del CSI sin ofertas")
            for row in rows:
                source_id = row["url"].rstrip("/").rsplit("/", 1)[-1]
                if source_id in seen:
                    continue
                seen.add(source_id)
                detail = cached_detail(cache, source_id, lambda u=row["url"]: parse_detail(client.get_text(u)))
                if detail is None:
                    complete = False
                    detail = {}
                title = row["title"]
                job = build_job(
                    slug=self.slug,
                    company=COMPANY,
                    title=title,
                    city=centre_city(row["centre"]),
                    description=_describe(row, detail),
                    requirements=detail.get("requirements"),
                    source_id=source_id,
                    url=row["url"],
                    published_at=dmy_to_iso(detail.get("published")),
                    expires_at=dmy_to_iso(row["deadline"], end_of_day=True),
                    contract_text=detail.get("description", ""),
                )
                if job:
                    jobs.append(job)
        finally:
            client.close()
        cache.save(prune=complete)
        self.last_listings_complete = complete
        return jobs


def _describe(row: dict, detail: dict) -> str:
    head = f"{row['title']} — {row['centre']}"
    if row.get("specialty"):
        head += f" ({row['specialty']})"
    body = detail.get("description") or ""
    return f"{head}\n\n{body}" if body else head
