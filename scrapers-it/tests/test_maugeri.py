from pathlib import Path

from sources import maugeri as M

FX = Path(__file__).parent / "fixtures"
URL = "https://carriere.icsmaugeri.it/job/Pavia-Medico-Neurologo-27100/1376610355/"


def test_clinical_job_fields():
    stats: dict = {}
    job = M.parse_detail((FX / "maugeri_neurologo.html").read_text(encoding="utf-8"), URL, stats)
    assert job is not None and not stats
    assert job.title == "Medico Neurologo"
    assert job.company == "ICS Maugeri" and job.sector == "privato"
    assert job.profession == "Medicina"
    assert job.location_concelho == "Pavia" and job.location_district == "Lombardia"
    assert job.published_at == "2026-11-11T00:00:00+00:00"
    assert job.application_url == URL
    assert job.source == "maugeri" and job.source_id == "maugeri-1376610355"
    assert len(job.description) > 300 and "@" not in job.description


def test_non_clinical_role_is_skipped():
    stats: dict = {}
    html = (FX / "maugeri_bed_manager.html").read_text(encoding="utf-8")
    assert M.parse_detail(html, "https://carriere.icsmaugeri.it/job/Milano-Bed-Manager-20138/1374952255/", stats) is None
    assert stats == {"not_clinical": 1}


def test_known_site_region_table():
    assert M._SITES["montescano"] == "Lombardia" and M._SITES["telese terme"] == "Campania"
