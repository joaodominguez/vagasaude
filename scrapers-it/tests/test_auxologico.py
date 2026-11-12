from pathlib import Path

from sources import auxologico as A

FX = Path(__file__).parent / "fixtures"
BASE = A.BASE + "/lavora-con-noi/posizioni-aperte/"


def load(name):
    return (FX / name).read_text(encoding="utf-8")


def test_parse_list_links():
    links = A.parse_list(load("auxologico_list.html"))
    assert len(links) == 3 and all(href.startswith("/lavora-con-noi/posizioni-aperte/") for href in links)


def test_doctor_fields():
    stats: dict = {}
    job = A.parse_detail(load("auxologico_medico_como.html"), BASE + "medico-radiologo", stats)
    assert job is not None and not stats
    assert job.title == "Medico Radiologo"
    assert job.company == "Istituto Auxologico Italiano" and job.sector == "privato"
    assert job.profession == "Medicina"
    assert job.location_concelho == "Como" and job.location_district == "Lombardia"
    assert job.source == "auxologico" and job.source_id == "auxologico-medico-radiologo"
    assert job.application_url == BASE + "medico-radiologo"
    assert job.published_at and len(job.description) > 100 and "@" not in job.description


def test_neurophysiology_technician_is_not_a_doctor():
    job = A.parse_detail(load("auxologico_tecnico_neuro.html"), BASE + "tecnicoa-neurofisiopatologia", {})
    assert job is not None and job.profession == "Tecnici sanitari"


def test_admin_role_is_skipped():
    stats: dict = {}
    assert A.parse_detail(load("auxologico_addetto.html"), BASE + "addetto-ciclo-passivo", stats) is None
    assert stats == {"not_clinical": 1}


def test_place_from_site_name():
    assert A._place("Auxologico Piancavallo - Strada Cadorna 90 Oggebbio (VB)") == ("Oggebbio", "Piemonte")
    assert A._place("Sedi Milano, Sedi Lombardia") == ("Milano", "Lombardia")
    assert A._place("Sedi Piemonte") == (None, "Piemonte")
