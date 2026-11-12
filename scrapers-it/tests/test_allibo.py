import json
from pathlib import Path

import pytest

from sources import _allibo as A
from sources.bianalisi import BianalisiScraper
from sources.fatebenefratelli import FatebenefratelliScraper

FX = Path(__file__).parent / "fixtures"


def items():
    return A.list_items(json.loads((FX / "allibo_list.json").read_text(encoding="utf-8")))


def html(name):
    return (FX / name).read_text(encoding="utf-8")


def pick(prefix):
    return next(i for i in items() if i["Title"].startswith(prefix))


def test_list_items_rejects_non_list_widget():
    assert len(items()) == 4
    with pytest.raises(ValueError):
        A.list_items({"ReturnCode": 0, "Content": {"WidgetData": {"SpontaneousButtonLabel": "Invia il tuo CV"}}})
    with pytest.raises(ValueError):
        A.list_items({"ReturnCode": 5})


def test_psychiatrist_fields():
    stats: dict = {}
    item = pick("Medico specialista")
    job = A.parse_detail(html("allibo_psichiatra.html"), item, FatebenefratelliScraper, stats)
    assert job is not None and not stats
    assert job.title == "Medico specialista in Psichiatria - San Colombano al Lambro"
    assert job.company == "Fatebenefratelli" and job.sector == "privato"
    assert job.profession == "Medicina"
    assert job.location_concelho == "San Colombano al Lambro" and job.location_district == "Lombardia"
    assert job.application_url == item["DetailLink"]
    assert job.source == "fatebenefratelli" and job.source_id == "fatebenefratelli-124342"
    assert job.published_at is None and len(job.description) > 200


def test_terp_title_is_expanded_and_classified():
    job = A.parse_detail(html("allibo_terp.html"), pick("TERP"), FatebenefratelliScraper, {})
    assert job is not None and job.title.startswith("TeRP - Tecnico della Riabilitazione Psichiatrica")
    assert job.profession == "Logopedia e riabilitazione"


def test_researcher_is_skipped():
    stats: dict = {}
    assert A.parse_detail(html("allibo_ricercatore.html"), pick("Ricercatore"), FatebenefratelliScraper, stats) is None
    assert stats == {"not_clinical": 1}


def test_other_client_uses_its_own_config():
    job = A.parse_detail(html("allibo_infermiere_lp.html"), items()[-1], BianalisiScraper, {})
    assert job.company == "Bianalisi" and job.source_id.startswith("bianalisi-")
    assert job.contract_type == "Libero professionale" and job.profession == "Infermieristica"
    assert job.location_district == "Liguria"
