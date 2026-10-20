from __future__ import annotations

import json
import re

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_district,
    guess_profession,
    html_to_text,
    norm,
    strip_accents,
)

BASE = "https://domusvi.zohorecruit.eu"
LIST_URL = f"{BASE}/jobs/Careers"

NON_HEALTH = {"Outros", "Administrativo", "Gestão & suporte"}
HEALTH_RE = re.compile(
    r"enfermeir|fisioterap|terapeuta|fonoaudi|terapia da fala|"
    r"t[eé]cnic[oa] auxiliar de sa[uú]de|ajudante|fisiatra|m[eé]dic|psic[oó]log|nutricion",
    re.I,
)
SKIP_RE = re.compile(r"cozinh|lavandaria|restaura|limpeza|arquitect|animador", re.I)
JOB_TYPES = {"full time": "Tempo inteiro", "part time": "Tempo parcial"}
SECTIONS = ("Requisitos", "Vantagens", "Perfil", "Oferecemos", "Responsabilidades")


class DomusviScraper(BaseScraper):
    slug = "domusvi"
    name = "DomusVi"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(timeout=40.0)
        try:
            html = client.get_text(LIST_URL)
        finally:
            client.close()
        return parse_domusvi_jobs(html, source=self.slug)


def _is_health(title: str) -> bool:
    if SKIP_RE.search(title):
        return False
    return guess_profession(title) not in NON_HEALTH or bool(HEALTH_RE.search(title))


def _url_slug(title: str) -> str:
    # Zoho resolve pelo id; o slug segue o formato do portal (sem acentos).
    text = re.sub(r"[^A-Za-z0-9]+", "-", strip_accents(title)).strip("-")
    return text or "vaga"


def _tidy_city(city: str) -> str:
    # "Vila Nova De Gaia" -> "Vila Nova de Gaia"
    city = re.sub(r"\s+", " ", city).strip()
    return re.sub(r"(?<=\s)(De|Da|Do|Das|Dos|E)(?=\s)", lambda m: m.group(1).lower(), city)


def _format_description(raw: str) -> str:
    # O JSON da listagem traz texto corrido com " - " a separar os pontos.
    text = html_to_text(raw) if "<" in raw else raw.strip()
    text = re.sub(r"\s+-\s+", "\n- ", text)
    for header in SECTIONS:
        text = re.sub(rf"\s+{header}:?\s*\n- ", f"\n\n{header}:\n- ", text)
    return text.strip()


def parse_domusvi_jobs(html: str, source: str = "domusvi") -> list[JobPayload]:
    soup = BeautifulSoup(html, "lxml")
    field = soup.find("input", id="jobs")
    if not field or not field.get("value"):
        return []
    try:
        items = json.loads(field["value"])
    except ValueError:
        return []

    jobs: list[JobPayload] = []
    for item in items:
        title = re.sub(r"\s+", " ", item.get("Posting_Title") or "").strip()
        job_id = str(item.get("id") or "").strip()
        if not title or not job_id or item.get("Publish") is False:
            continue
        country = norm(item.get("Country") or "portugal")
        if country and country != "portugal":
            continue
        if not _is_health(title):
            continue
        city = _tidy_city(item.get("City") or "") or None
        state = (item.get("State") or "").strip() or None
        district = guess_district(state, city)
        if district == "Portugal":
            district = guess_district(city)
        description = _format_description(item.get("Job_Description") or "") or title
        contract = JOB_TYPES.get(norm(item.get("Job_Type") or "")) or guess_contract(
            description
        )
        jobs.append(
            JobPayload(
                title=title,
                company="DomusVi",
                location_district=district,
                location_concelho=city,
                profession=guess_profession(title),
                specialty=None,
                sector="privado",
                contract_type=contract,
                description=description,
                requirements=None,
                salary=None,
                application_url=f"{LIST_URL}/{job_id}/{_url_slug(title)}",
                source=source,
                source_id=job_id,
                published_at=item.get("Date_Opened"),
            )
        )
    return jobs
