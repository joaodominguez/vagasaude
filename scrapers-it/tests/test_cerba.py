from pathlib import Path

from sources import cerba as C

FX = Path(__file__).parent / "fixtures"


def read(name: str) -> str:
    return (FX / name).read_text(encoding="utf-8")


def test_parse_list_cards():
    rows = C.parse_list(read("cerba_list.html"))
    assert len(rows) == 6
    assert rows[0] == {
        "id": "19406",
        "path": "/job/job-medico-anatomia-patologica-limena-pd-_19406.aspx",
        "title": "MEDICO ANATOMIA PATOLOGICA - Limena (PD)",
        "date": "11/11/2026",
        "entity": "CHC ITALY",
        "region": "VENETO",
    }


def test_select_rows_keeps_only_clinical_and_skips_pools():
    stats: dict = {}
    kept = C.select_rows(C.parse_list(read("cerba_list.html")), stats)
    assert [r["id"] for r in kept] == ["19406", "22844", "21505"]
    assert [r["profession"] for r in kept] == ["Medicina", "Infermieristica", "Infermieristica"]
    assert kept[1]["title"] == "Infermiere P.iva - Mottola (TA)"
    assert kept[2]["title"] == "Infermiere castel di sangro"
    assert stats == {"talent_pool": 1, "not_clinical": 2}


def test_detail_doctor():
    row = {**C.parse_list(read("cerba_list.html"))[0], "profession": "Medicina"}
    job = C.parse_detail(read("cerba_detail_medico.html"), row)
    assert job is not None
    assert job.company == "Cerba HealthCare" and job.sector == "privato"
    assert job.location_district == "Veneto" and job.location_concelho == "Limena"
    assert job.contract_type == "Libero professionale"
    assert job.published_at == "2026-11-11T00:00:00+00:00"
    assert job.application_url == (
        "https://cerbahealthcare-career.talent-soft.com/job/job-medico-anatomia-patologica-limena-pd-_19406.aspx?LCID=1040"
    )
    assert job.source_id == "cerba-19406"
    assert "Anatomia Patologica" in job.description and "Invia" not in job.description[:20]


def test_detail_without_location_uses_list_region():
    row = {
        "id": "23140", "path": "/job/job-infermiere-m-f_23140.aspx", "title": "Infermiere",
        "date": "06/10/2026", "entity": "X", "region": "LAZIO", "profession": "Infermieristica",
    }
    job = C.parse_detail(read("cerba_detail_infermiere.html"), row)
    assert job is not None and job.location_district == "Lazio"
