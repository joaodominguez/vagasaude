from __future__ import annotations

import re
from html import unescape

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_profession, html_to_text, norm
from sources._ats_pt import resolve_pt_place

CLINICAL_RE = re.compile(
    r"physiotherap|physical therap|fisioterap|physician|pediatric|doctor|medic[oa]\b"
    r"|nurse|enfermeir|psycholog|psicolog|dietitian|nutritionist|nutricion"
)
# Funções comerciais/gestão com palavras clínicas no título (ex.: "Clinical Sales Manager").
NON_CLINICAL_RE = re.compile(r"sales|manager|head|director|lead|marketing|engineer")


class SwordHealthScraper(BaseScraper):
    slug = "sword_health"
    name = "Sword Health"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        try:
            data = client.get_json(
                "https://boards-api.greenhouse.io/v1/boards/swordhealth/jobs?content=true"
            )
        finally:
            client.close()

        jobs: list[JobPayload] = []
        for item in data.get("jobs", []):
            title = (item.get("title") or "").strip()
            t = norm(title)
            if not CLINICAL_RE.search(t) or NON_CLINICAL_RE.search(t):
                continue
            place = _portugal_place(item)
            if not place:
                continue
            district, concelho = place

            # O conteúdo vem com HTML escapado (&lt;p&gt;...).
            description = html_to_text(unescape(item.get("content") or ""))
            jobs.append(
                JobPayload(
                    title=title,
                    company="Sword Health",
                    location_district=district,
                    location_concelho=concelho,
                    profession=guess_profession(title, "physician"),
                    specialty=None,
                    sector="privado",
                    contract_type=guess_contract(title),
                    description=description or title,
                    requirements=None,
                    salary=_salary(item.get("metadata") or []),
                    application_url=item.get("absolute_url")
                    or f"https://job-boards.greenhouse.io/swordhealth/jobs/{item.get('id')}",
                    source=self.slug,
                    source_id=str(item.get("id")),
                    published_at=item.get("first_published") or item.get("updated_at"),
                )
            )
        return jobs


def _portugal_place(item: dict) -> tuple[str, str | None] | None:
    names = [(item.get("location") or {}).get("name") or ""]
    names += [o.get("name") or "" for o in item.get("offices") or []]
    labels = [p.strip() for n in names for p in n.split(";") if p.strip()]
    # "Hybrid - Lisbon" / "Hybrid - Porto" → cidade concreta.
    for label in labels:
        city = label.split("-", 1)[-1].strip()
        if norm(city) in {"portugal", "europe", "us", "uk", "germany", "greece", "canada"}:
            continue
        place = resolve_pt_place(city)
        if place and norm(label).startswith(("hybrid", "on site", "onsite", "office")):
            return place
    # Remoto em Portugal sem cidade: distrito da sede (Porto), concelho "Remoto".
    if any(norm(label) in {"remote portugal", "portugal"} for label in labels):
        return "Porto", "Remoto"
    return None


def _salary(metadata: list[dict]) -> str | None:
    for field in metadata:
        value = field.get("value")
        if field.get("value_type") != "currency_range" or not isinstance(value, dict):
            continue
        try:
            low, high = float(value["min_value"]), float(value["max_value"])
        except (KeyError, TypeError, ValueError):
            continue
        # Valores baixos (contractors: €10–€35) são por hora/sessão sem unidade explícita.
        if low < 1000:
            return None
        fmt = lambda v: "€" + f"{int(v):,}".replace(",", ".")
        if low == high:
            return f"{fmt(low)} (anual)"
        return f"{fmt(low)} – {fmt(high)} (anual)"
    return None
