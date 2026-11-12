from pathlib import Path

from sources import ieo as I

FX = Path(__file__).parent / "fixtures"


def jobs(stats=None):
    return I.parse_page((FX / "ieo_page.html").read_text(encoding="utf-8"), stats if stats is not None else {})


def test_only_clinical_postings_are_kept():
    stats: dict = {}
    found = jobs(stats)
    assert [j.profession for j in found] == ["Infermieristica", "Medicina", "Tecnici sanitari"]
    assert stats == {"not_clinical": 2}  # bando di borsa di studio + contabilita'


def test_nurse_fields_and_anchor():
    nurse = jobs()[0]
    assert nurse.title == "Infermiere/a Ginecologia"
    assert nurse.company.startswith("Istituto Europeo di Oncologia") and nurse.sector == "privato"
    assert nurse.location_concelho == "Milano" and nurse.location_district == "Lombardia"
    assert nurse.application_url == I.PAGE + "#infermiere-a-ginecologia"
    assert nurse.source == "ieo" and nurse.source_id == "ieo-infermiere-a-ginecologia"
    assert len(nurse.description) > 200


def test_no_email_or_phone_anywhere():
    for job in jobs():
        blob = " ".join(str(v) for v in job.to_dict().values())
        assert "@" not in blob and "mailto" not in blob
        assert job.description.endswith("Istituto Europeo di Oncologia.")


def test_contract_and_pharmacy_lab_technician():
    doctor, technician = jobs()[1], jobs()[2]
    assert doctor.contract_type == "Libero professionale"
    assert technician.profession == "Tecnici sanitari"  # "Servizio Farmacia" non lo rende farmacista
