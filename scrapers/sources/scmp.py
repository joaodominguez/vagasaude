from __future__ import annotations

import re

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_profession

API = "https://scmp.pt/api/pages/oportunidades-de-recrutamento"
PAGE = "https://scmp.pt/oportunidades-de-recrutamento"

HEALTH_RE = re.compile(
    r"enferm|auxiliar\s+de\s+a[cç][aã]o\s+m[eé]dica|ajudante\s+de\s+lar|"
    r"fisioterap|terapeuta|m[eé]dic|farmac|psicolog|nutric|cuidador|"
    r"assistente\s+social|t[eé]cnic[oa].{0,20}sa[uú]de",
    re.I,
)
SKIP_RE = re.compile(r"jardinagem|jardineiro|motorista|cozinh|limpeza\b", re.I)


class ScmpScraper(BaseScraper):
    slug = "scmp"
    name = "Misericórdia do Porto (SCMP)"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(timeout=40.0, min_interval=0.35)
        try:
            payload = client.get_json(API)
        finally:
            client.close()

        docs = _documents(payload)
        jobs: list[JobPayload] = []
        for doc in docs:
            title = (doc.get("name") or "").strip()
            if not title:
                continue
            if SKIP_RE.search(title) or not HEALTH_RE.search(title):
                continue
            media = doc.get("media") or {}
            url = (media.get("url") or doc.get("url") or PAGE).strip()
            source_id = str(doc.get("id") or title)
            clean_title = re.sub(r"\.pdf$", "", title, flags=re.I).strip()
            jobs.append(
                JobPayload(
                    title=clean_title,
                    company="Santa Casa da Misericórdia do Porto",
                    location_district="Porto",
                    location_concelho="Porto",
                    profession=guess_profession(clean_title),
                    specialty=None,
                    sector="ipss",
                    contract_type=None,
                    description=(
                        f"{clean_title}. Consulta o aviso PDF e candidata-te "
                        f"junto da Misericórdia do Porto (recrutamento@scmp.pt)."
                    ),
                    requirements=None,
                    salary=None,
                    application_url=(media.get("url") if isinstance(media, dict) else None)
                    or url
                    or PAGE,
                    source=self.slug,
                    source_id=source_id,
                    published_at=None,
                )
            )
        return jobs


def _documents(payload: dict) -> list[dict]:
    out: list[dict] = []

    def walk(obj: object) -> None:
        if isinstance(obj, dict):
            if obj.get("type") == "document_categories":
                cats = (obj.get("data") or {}).get("categories") or obj.get("categories") or []
                for category in cats:
                    for doc in category.get("documents") or []:
                        out.append(doc)
                return
            for value in obj.values():
                walk(value)
        elif isinstance(obj, list):
            for value in obj:
                walk(value)

    walk(payload)
    return out
