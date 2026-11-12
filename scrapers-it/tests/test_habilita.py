from pathlib import Path

from sources import habilita as H

FX = Path(__file__).parent / "fixtures"


def parse(name, slug, stats=None):
    html = (FX / f"habilita_{name}.html").read_text(encoding="utf-8")
    return H.parse_detail(html, f"https://habilita.it/posizioni/{slug}/", stats if stats is not None else {})


def test_parse_sitemap_only_positions():
    xml = (
        "<urlset><url><loc>https://habilita.it/posizioni/medico/</loc></url>"
        "<url><loc>https://habilita.it/posizioni/medico/</loc></url>"
        "<url><loc>https://habilita.it/chi-siamo/</loc></url></urlset>"
    )
    assert H.parse_sitemap(xml) == ["https://habilita.it/posizioni/medico/"]


def test_nurse_in_piedmont_site():
    stats: dict = {}
    job = parse("infermiere", "infermiere", stats)
    assert job is not None and not stats
    assert job.title == "Infermiere - Fara Novarese"
    assert job.company == "Habilita" and job.sector == "privato"
    assert job.profession == "Infermieristica"
    assert job.location_concelho == "Fara Novarese" and job.location_district == "Piemonte"
    assert job.source == "habilita" and job.source_id == "habilita-infermiere"
    assert job.application_url == "https://habilita.it/posizioni/infermiere/"
    assert not job.description.startswith(("'", "‘", "’")) and len(job.description) > 200


def test_freelance_doctor_site_from_text():
    job = parse("medico_dermatologo", "medico-dermatologo")
    assert job.location_concelho == "Zingonia" and job.location_district == "Lombardia"
    assert job.contract_type == "Libero professionale"


def test_non_clinical_and_unlocated_postings_are_skipped():
    stats: dict = {}
    assert parse("direttore_operativo", "direttore-operativo", stats) is None
    assert parse("tecnico_di_laboratorio_biomedico", "tecnico-di-laboratorio-biomedico", stats) is None
    assert stats == {"not_clinical": 1, "no_region": 1}
