"""ICS — Institut Català de la Salut: «Convocatòries de treball temporal» vigents.

https://ics.gencat.cat/ca/lics/treballeu-a-lics/treball-temporal/convocatories-de-treball-temporal/llista-de-convocatories/
(robots.txt del dominio sin restricciones para esta ruta). Convocatorias específicas de plazas temporales
publicadas por cada ámbito (Centre Corporatiu, Atenció Primària, Girona, Metropolitana Sud, Vall d'Hebron...).
No sustituye a la «borsa de treball» general (inscripción continua, sin oferta concreta) ni a las oposiciones
de torn lliure (llegan por el DOGC/BOE).

Cada convocatoria es un bloque con un enlace a la convocatoria (PDF) y, cuando el proceso avanza, enlaces de
«Diligència ...» (listas de admitidos, aptos...). Con una diligencia publicada el plazo de solicitudes ya
terminó: esos bloques se descartan. El plazo exacto va dentro del PDF (no se lee) y no hay fecha de
publicación en el listado; la oferta se mantiene mientras aparezca en la lista vigente
(`last_listings_complete`).
"""
from __future__ import annotations

import hashlib
import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import norm

from ._pub_common import dedupe_titles
from ._siscat_es import build_job, clean_title

LIST_URL = (
    "https://ics.gencat.cat/ca/lics/treballeu-a-lics/treball-temporal/"
    "convocatories-de-treball-temporal/llista-de-convocatories/"
)
COMPANY = "Institut Català de la Salut (ICS)"
_OFFER_PREFIX_RE = re.compile(r"^\s*(?:convocat[òo]ria(?:\s+\d+[-/]\d{4})?|oferta|anunci)\s*(?:per\s+a\s+(?:la\s+)?(?:selecci[óo]|cobertura)\s+)?"
                              r"(?:de\s+|d['’]\s*)?(?:l['’]\s*)?", re.I)
_LEAD_RE = re.compile(r"^(?:un|una|dos|dues|tres|quatre|cinc)\s+(?:llocs?\s+de\s+(?:treball\s+)?(?:de\s+)?|places?\s+de\s+)?", re.I)
_REF_RE = re.compile(r"[\s.(]*\(?\s*ref(?:er[èe]ncia)?\s*[.:]\s*[^)]*\)?\s*$", re.I)
_CLOSED_RE = re.compile(r"dilig[èe]ncia|resoluci[óo]|resultat|desert", re.I)


def _nice(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip(" .:-")
    if text.isupper():
        text = text.lower()
    return text[:1].upper() + text[1:]


def short_title(raw: str) -> str:
    """"Convocatòria per a la selecció d'un/a Infermer/a clínic/a ... (Ref. X)" -> "Infermer/a clínic/a ..."."""
    t = re.sub(r"\s+", " ", raw).strip()
    t = _REF_RE.sub("", t)
    t = re.sub(r"^\s*convocat[òo]ria\s+\d+[-/]\d{4}\.?\s*", "", t, flags=re.I)
    t = re.sub(r"^\s*(?:convocat[òo]ria|oferta|anunci)\s+(?:per\s+a\s+(?:la\s+)?(?:selecci[óo]|cobertura)\s+)?(?:de\s+|d['’]\s*)?", "", t, flags=re.I)
    t = re.sub(r"^\s*d['’]\s*(?:un|una)\s+lloc\s+de\s*:?\s*", "", t, flags=re.I)
    t = _LEAD_RE.sub("", t)
    t = re.sub(r"^(?:un/a|un|una)\s+(?:lloc\s+de\s+)?", "", t, flags=re.I)
    t = re.sub(r"^lloc\s+d['’]\s*", "", t, flags=re.I)
    # "Facultatiu/va ... Pediatria. Gerència d'Atenció Primària ..." -> solo la primera frase (el ámbito va aparte)
    first = re.split(r"\.\s+(?=[A-ZÀ-Ý])", t, maxsplit=1)[0]
    if len(first) >= 25:
        t = first
    t = re.sub(r"\s+(?:per|per a|para) (?:la|l['’]) ?(?:g[eè]ncia|unitat).*$", "", t, flags=re.I) if len(t) > 90 else t
    return _nice(t)


def parse_listing(html: str, base: str = LIST_URL) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []
    area = ""
    for h in soup.find_all("h2"):
        classes = h.get("class") or []
        if "subtitle" in classes:
            area = re.sub(r"\s+", " ", h.get_text(" ", strip=True))
            continue
        if "basic_title" not in classes:
            continue
        block = h.find_parent("div", class_="blocs")
        if block is None:
            continue
        links = [(re.sub(r"\s+", " ", a.get_text(" ", strip=True)), a["href"]) for a in block.find_all("a", href=True)]
        if not links:
            continue
        status = [text for text, _ in links if _CLOSED_RE.search(text)]
        rows.append({
            "title": re.sub(r"\s+", " ", h.get_text(" ", strip=True)),
            "area": area,
            "url": urljoin(base, links[0][1]),
            "closed": bool(status),
        })
    return rows


def build(row: dict) -> JobPayload | None:
    if row["closed"]:
        return None
    short = short_title(row["title"])
    area = row["area"]
    title = f"{short} — ICS {area}" if area and norm(area) not in norm(short) else f"{short} — ICS"
    description = (
        f"{row['title']}\n\nÀmbit: {area or 'ICS'}. Convocatòria de treball temporal de l'Institut Català de la Salut, "
        "publicada a la llista de convocatòries vigents. Les bases, els requisits, els mèrits i el termini de "
        "presentació de sol·licituds consten a la convocatòria oficial (document PDF enllaçat)."
    )
    source_id = "ics-" + hashlib.md5(row["url"].split("?")[0].encode()).hexdigest()[:12]
    job = build_job(
        slug="ics", company=COMPANY, title=title[:200], city=None, description=description,
        source_id=source_id, url=row["url"], contract_text=f"temporal {row['title']}",
    )
    if job:
        job.contract_type = "Temporal"
    return job


class IcsScraper(BaseScraper):
    slug = "ics"
    name = "ICS Catalunya — Convocatòries de treball temporal"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        try:
            html = client.get_text(LIST_URL)
        finally:
            client.close()
        rows = parse_listing(html)
        if not rows:
            raise RuntimeError("ICS: listado de convocatorias vigentes sin bloques")
        jobs, seen = [], set()
        for row in rows:
            job = build(row)
            if job and job.source_id not in seen:
                seen.add(job.source_id)
                jobs.append(job)
        return dedupe_titles(jobs)
