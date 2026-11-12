import json
from pathlib import Path

from sources import affidea as A

FX = Path(__file__).parent / "fixtures"


def offers():
    return json.loads((FX / "affidea_offers.json").read_text(encoding="utf-8"))["offers"]


def test_freelance_nurse_fields():
    stats: dict = {}
    job = A.parse_offer(offers()[0], stats)
    assert job is not None and not stats
    assert job.title.startswith("Infermiere/a in libera professione")
    assert "ID" not in job.title
    assert job.company == "Affidea" and job.sector == "privato"
    assert job.profession == "Infermieristica"
    assert job.location_concelho == "Verbania" and job.location_district == "Piemonte"
    assert job.contract_type == "Libero professionale"
    assert job.application_url.startswith("https://affideaitaly.recruitee.com/o/")
    assert job.source == "affidea" and job.source_id == f"affidea-{offers()[0]['id']}"
    assert job.published_at.startswith("2026-11-12")
    assert len(job.description) > 200 and "@" not in job.description


def test_place_comes_from_title_not_api_city():
    job = A.parse_offer(offers()[2], {})  # titolo "... Modena (MO)", city API sbagliata
    assert job.location_concelho == "Modena" and job.location_district == "Emilia-Romagna"
    brescia = A.parse_offer(offers()[4], {})  # multi-sede: la regione resta quella dell'API
    assert brescia.location_district == "Lombardia"


def test_non_clinical_roles_are_skipped():
    stats: dict = {}
    assert A.parse_offer(offers()[1], stats) is None  # receptionist
    assert A.parse_offer(offers()[3], stats) is None  # sales
    assert stats == {"not_clinical": 2}


def test_unpublished_or_thin_is_skipped():
    stats: dict = {}
    off = dict(offers()[0], status="archived")
    assert A.parse_offer(off, stats) is None
    thin = dict(offers()[0], description="<p>Ok</p>", requirements="")
    assert A.parse_offer(thin, stats) is None
    assert stats == {"not_published": 1, "thin": 1}
