from pathlib import Path

from sources import fresenius as F

FX = Path(__file__).parent / "fixtures"
URL = "https://jobs.freseniusmedicalcare.com/it/x/job/ABC"


def read(name: str) -> str:
    return (FX / name).read_text(encoding="utf-8")


def test_parse_sitemap_dedupes_job_urls():
    xml = (
        "<urlset><url><loc>https://jobs.freseniusmedicalcare.com/it/a/job/1</loc></url>"
        "<url><loc>https://jobs.freseniusmedicalcare.com/it/a/job/1</loc></url>"
        "<url><loc>https://jobs.freseniusmedicalcare.com/it/</loc></url></urlset>"
    )
    assert F.parse_sitemap(xml) == ["https://jobs.freseniusmedicalcare.com/it/a/job/1"]


def test_dialysis_nurse_uses_title_city_not_billing_address():
    job = F.parse_detail(read("fresenius_nurse.html"), URL)
    assert job is not None
    assert job.company == "NephroCare – Fresenius Medical Care" and job.sector == "privato"
    assert job.profession == "Infermieristica" and job.specialty == "Dialisi"
    assert job.location_concelho == "Castellaneta" and job.location_district == "Puglia"  # non Taranto
    assert job.contract_type == "Libero professionale"
    assert job.published_at.startswith("2026-10-22")
    assert job.application_url.startswith("https://jobs.freseniusmedicalcare.com/it/")
    assert job.source_id == "nephrocare-ABC"
    assert len(job.description) > 200


def test_abbreviated_city_is_expanded():
    job = F.parse_detail(read("fresenius_nurse_trescore.html"), URL)
    assert job is not None and job.location_concelho == "Trescore Balneario"
    assert job.location_district == "Lombardia"


def test_foreign_and_non_clinical_postings_are_skipped():
    stats: dict = {}
    assert F.parse_detail(read("fresenius_romania.html"), URL, stats) is None
    assert F.parse_detail(read("fresenius_manutentore.html"), URL, stats) is None
    assert stats == {"not_italy": 1, "not_clinical": 1}
