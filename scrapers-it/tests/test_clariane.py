from datetime import datetime, timezone
from pathlib import Path

from sources import clariane as C

FX = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 11, 12, tzinfo=timezone.utc)
BASE = "https://carriere.clariane.it/dettagli-posizione/"


def read(name: str) -> str:
    return (FX / name).read_text(encoding="utf-8")


def test_parse_sitemap_filters_non_position_urls():
    xml = (
        "<urlset><url><loc>https://carriere.clariane.it/dettagli-posizione/oss-m-f-2026-18664/</loc>"
        "<lastmod>2026-11-09T12:33:33+00:00</lastmod></url>"
        "<url><loc>https://carriere.clariane.it/chi-siamo/</loc></url></urlset>"
    )
    assert C.parse_sitemap(xml) == [(BASE + "oss-m-f-2026-18664/", "2026-11-09T12:33:33+00:00")]


def test_recent_oss_posting():
    stats: dict = {}
    job = C.parse_detail(read("clariane_oss.html"), BASE + "oss-m-f-2026-18664/", NOW, stats)
    assert job is not None and not stats
    assert job.title == "OSS"
    assert job.company == "Clariane (Korian)"
    assert job.sector == "privato"
    assert job.profession == "OSS"
    assert job.location_district == "Piemonte"
    assert job.location_concelho == "Lanzo"
    assert job.contract_type == "Tempo determinato"
    assert job.source_id == "clariane-2026-18664"
    assert job.published_at.startswith("2026-11-06")
    assert job.description.startswith("Struttura: ")
    assert "Stellenbeschreibung" not in job.description and len(job.description) > 200


def test_old_posting_without_valid_through_is_skipped():
    stats: dict = {}
    assert C.parse_detail(read("clariane_stale.html"), BASE + "area-medica-m-f-m-f-2026-18557/", NOW, stats) is None
    assert stats == {"stale": 1}


def test_non_clinical_role_is_skipped():
    stats: dict = {}
    soon = datetime(2026, 6, 20, tzinfo=timezone.utc)
    assert C.parse_detail(read("clariane_cuoco.html"), BASE + "aiuto-cuoco-m-f-2025-16217/", soon, stats) is None
    assert stats == {"not_clinical": 1}
