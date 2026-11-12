from pathlib import Path

from sources import _it_priv as P
from sources import humanitas as H

FX = Path(__file__).parent / "fixtures"
URL = "https://jobs.humanitas.it/job/Rozzano-Medico-Ecografia-Mila-20089/1374951657/"


def test_parse_sitemap_only_jobs():
    xml = (
        "<urlset><url><loc>https://jobs.humanitas.it/job/A-1/111/</loc></url>"
        "<url><loc>https://jobs.humanitas.it/job/A-1/111/</loc></url>"
        "<url><loc>https://jobs.humanitas.it/search/</loc></url></urlset>"
    )
    assert H.parse_sitemap(xml) == ["https://jobs.humanitas.it/job/A-1/111/"]


def test_clinical_job_fields():
    stats: dict = {}
    job = H.parse_detail((FX / "humanitas_medico.html").read_text(encoding="utf-8"), URL, stats)
    assert job is not None and not stats
    assert job.title == "Medico Ecografia"
    assert job.company == "Humanitas"
    assert job.sector == "privato"
    assert job.profession == "Medicina"
    assert job.location_district == "Lombardia"
    assert job.location_concelho == "Rozzano"
    assert job.contract_type == "Libero professionale"
    assert job.published_at == "2026-10-15T00:00:00+00:00"
    assert job.application_url == URL
    assert job.source == "humanitas" and job.source_id == "humanitas-1374951657"
    assert len(job.description) > 200 and "@" not in job.description
    assert not any(ch in job.description for ch in "📍📄")


def test_non_clinical_role_is_skipped():
    stats: dict = {}
    job = H.parse_detail(
        (FX / "humanitas_study_coordinator.html").read_text(encoding="utf-8"),
        "https://jobs.humanitas.it/job/x/1375014557/",
        stats,
    )
    assert job is None and stats == {"not_clinical": 1}


def test_clean_text_drops_contact_lines():
    text = "Requisiti: laurea\nScrivi a hr.recruiting@example.it\nChiama 02 8224 1234\nNote finali"
    assert P.clean_text(text) == "Requisiti: laurea\nNote finali"


def test_talent_pool_titles():
    assert P.is_talent_pool("Candidatura spontanea")
    assert P.is_talent_pool("Talent Pool Infermieri")
    assert not P.is_talent_pool("Infermiere/a | Degenza")
