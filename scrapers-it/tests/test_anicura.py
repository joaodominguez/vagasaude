import json
from pathlib import Path

from sources import anicura as A

FX = Path(__file__).parent / "fixtures"


def feed():
    return json.loads((FX / "anicura_feed.json").read_text(encoding="utf-8"))["items"]


def test_veterinary_doctor_fields():
    stats: dict = {}
    job = A.parse_item(feed()[0], stats)
    assert job is not None and not stats
    assert job.title == "Medico Veterinario - Neurologia (NO)"
    assert job.company == "AniCura" and job.sector == "privato"
    assert job.profession == "Veterinaria"
    assert job.location_district == "Piemonte"
    assert job.location_concelho == "Granozzo Con Monticello"
    assert job.application_url.startswith("https://jobs.anicura.it/jobs/")
    assert job.source == "anicura" and job.source_id.startswith("anicura-")
    assert job.published_at.startswith("2026-11-03")
    assert len(job.description) > 100 and not job.description.startswith("R-")


def test_non_clinical_roles_are_skipped():
    stats: dict = {}
    jobs = [A.parse_item(item, stats) for item in feed()[1:]]
    assert jobs == [None, None, None]
    assert stats == {"not_clinical": 3}
