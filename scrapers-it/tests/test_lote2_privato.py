from datetime import date, datetime, timezone
from pathlib import Path

from sources import _it_priv as PRIV
from sources import apoteca_natura as AN
from sources import casa_sollievo as CS
from sources import cazampa as CZ
from sources import israelitico as IS
from sources import mater_olbia as MO
from sources import sereni_orizzonti as SO
from sources import sospiro as SP

FX = Path(__file__).parent / "fixtures"


def read(name):
    return (FX / name).read_text(encoding="utf-8")


def no_contacts(job):
    blob = " ".join(str(v) for v in job.to_dict().values())
    assert "@" not in blob and "mailto" not in blob


def test_mater_olbia_accordion():
    stats: dict = {}
    jobs = MO.parse_page(read("mater_olbia_page.html"), stats)
    assert [j.title for j in jobs] == ["Medico Dermatologo", "Fisico Medico"]
    assert stats == {"not_clinical": 1}
    derm, fisico = jobs
    assert derm.location_district == "Sardegna" and derm.location_concelho == "Olbia" and derm.sector == "privato"
    assert derm.profession == "Medicina" and derm.contract_type == "Libero professionale"
    assert fisico.profession == "Tecnici sanitari"
    assert derm.application_url == MO.PAGE + "#medico-dermatologo"
    assert derm.source == "mater-olbia" and derm.source_id == "mater-olbia-medico-dermatologo"
    for job in jobs:
        no_contacts(job)
        assert job.description.endswith("Mater Olbia Hospital.")


def test_casa_sollievo_list_and_detail():
    rows = CS.parse_list(read("casa_sollievo_list.html"))
    assert len(rows) == 3 and all(u.startswith("https://www.operapadrepio.it/it/notizie-e-comunicati/") for _, u in rows)
    assert CS.short_title(rows[0][0]) == "Medico specializzando - Ostetricia e Ginecologia"
    assert CS.short_title(rows[1][0]) == "Dirigente Medico specialista Ostetricia e Ginecologia"
    stats: dict = {}
    job = CS.parse_detail(read("casa_sollievo_detail.html"), rows[1][1], rows[1][0], today=date(2026, 11, 25), stats=stats)
    assert job is not None and not stats
    assert job.profession == "Medicina" and job.location_district == "Puglia" and job.contract_type == "Tempo indeterminato"
    assert job.expires_at == "2026-11-30" and job.published_at.startswith("2026-11-04")
    assert "Cognome" not in job.description and job.application_url == rows[1][1]
    assert job.source == "casa-sollievo"
    # scaduta: fora
    stats = {}
    assert CS.parse_detail(read("casa_sollievo_detail.html"), rows[1][1], rows[1][0], today=date(2026, 12, 1), stats=stats) is None
    assert stats == {"expired": 1}


def test_casa_sollievo_deadline():
    assert CS.parse_deadline("entro e non oltre il\n30 Novembre 2026 a pena") == "2026-11-30"  # a capo, come in html_to_text
    assert CS.parse_deadline("entro e non oltre il 30 Novembre 2026 a pena di esclusione") == "2026-11-30"
    assert CS.parse_deadline("senza scadenza") is None


def test_israelitico_page_and_post():
    html = read("israelitico_page.html")
    jobs = IS.parse_page(html, {})
    assert len(jobs) == 3 and all(j.location_district == "Lazio" and j.location_concelho == "Roma" for j in jobs)
    assert jobs[0].title == "Dirigente Medico - Diagnostica per Immagini" and jobs[0].contract_type == "Tempo indeterminato"
    assert jobs[0].application_url == IS.PAGE + "#dirigente-medico-diagnostica-per-immagini"
    for job in jobs:
        no_contacts(job)
        assert "Tel" not in job.description and "UOC" not in job.description
    links = IS.post_links(html)
    assert len(links) == 1 and "radiodiagnostica" in links[0]
    now = datetime(2026, 11, 25, tzinfo=timezone.utc)
    post = IS.parse_post(read("israelitico_post.html"), links[0], now)
    assert post is not None and post.title.startswith("Medico Specialista in Radiodiagnostica")
    assert post.published_at.startswith("2026-10-02") and post.application_url == links[0]
    no_contacts(post)
    # articolo troppo vecchio
    stats: dict = {}
    assert IS.parse_post(read("israelitico_post.html"), links[0], datetime(2027, 6, 1, tzinfo=timezone.utc), stats) is None
    assert stats == {"stale": 1}


def test_cazampa_detail_and_sitemap():
    assert CZ.parse_sitemap(read("cazampa_sitemap.xml")) == [
        "https://www.cazampa.it/lavoro/tecnico-veterinario-senior/",
        "https://www.cazampa.it/lavoro/receptionist-test/",
    ]
    job = CZ.parse_detail(read("cazampa_detail.html"), "https://www.cazampa.it/lavoro/tecnico-veterinario-senior/", {})
    assert job is not None
    assert job.title == "Tecnico Veterinario Senior - Policlinico Veterinario Gregorio VII"
    assert job.profession == "Veterinaria" and job.location_district == "Lazio" and job.sector == "privato"
    assert job.contract_type is None  # "full-time che part-time" = non definito
    assert job.description.startswith("Struttura: Policlinico Veterinario Gregorio VII")
    assert "Home >" not in job.description and "Candidati per questo ruolo" not in job.description
    assert job.source == "cazampa" and job.source_id == "cazampa-tecnico-veterinario-senior"


def test_cazampa_non_clinical_skipped():
    html = read("cazampa_detail.html").replace("Tecnico Veterinario Senior |", "Receptionist |")
    stats: dict = {}
    assert CZ.parse_detail(html, "https://www.cazampa.it/lavoro/receptionist/", stats) is None
    assert stats == {"not_clinical": 1}


def test_sospiro_list_and_detail():
    listing = '<a href="https://www.fondazionesospiro.it/lavora-con-noi/posizione/fisioterapista/?area_provenienza=rsd">x</a>' \
              '<a href="/lavora-con-noi/posizione/fisioterapista/">y</a><a href="/lavora-con-noi/">z</a>'
    assert SP.parse_list(listing) == ["https://www.fondazionesospiro.it/lavora-con-noi/posizione/fisioterapista/"]
    job = SP.parse_detail(read("sospiro_detail.html"), "https://www.fondazionesospiro.it/lavora-con-noi/posizione/fisioterapista/", {})
    assert job is not None and job.title == "Fisioterapista" and job.profession == "Fisioterapia"
    assert job.location_district == "Lombardia" and job.location_concelho == "Sospiro" and job.contract_type == "Part-time"
    assert job.published_at.startswith("2026-08-03") and job.source_id == "sospiro-fisioterapista"
    assert not job.description.startswith("RSD")


def test_sereni_orizzonti_only_clinical():
    stats: dict = {}
    jobs = SO.parse_page(read("sereni_orizzonti_page.html"), stats)
    assert len(jobs) == 1 and stats == {"not_clinical": 1}
    nurse = jobs[0]
    assert nurse.title == "Infermieri/e" and nurse.profession == "Infermieristica"
    assert nurse.location_district == "Italia" and nurse.location_concelho is None
    assert nurse.contract_type is None  # elenco di piu' forme
    assert nurse.published_at.startswith("2026-08-20") and nurse.source_id == "sereni-orizzonti-43109"
    assert nurse.application_url.endswith("#posizione-43109")
    no_contacts(nurse)


def test_apoteca_natura_titles_and_filter_exemption():
    rows = AN.parse_list(read("apoteca_list.html"))
    assert len(rows) == 10 and len(AN.parse_list(read("apoteca_list1.html"))) == 3
    cipolla = rows[0]
    assert AN.pharmacy_name(cipolla["title"]) == "Farmacia Cipolla"
    assert AN.pharmacy_name("Farmacista Collaboratore/Collaboratrice DE LISI &amp; D&#039;AMELIO - Candidatura Spontanea") == "Farmacia De Lisi & D'Amelio"
    assert AN.pharmacy_name("Candidatura spontanea") is None
    assert AN.build_title(cipolla["title"], cipolla["role"], "Campobasso") == "Farmacista collaboratore/a - Farmacia Cipolla, Campobasso"
    assert AN.build_title("Commessa di farmacia FARMACIA X - Candidatura Spontanea", None, "Roma") == "Commesso/a di farmacia - Farmacia X, Roma"
    # filtro talent-pool: esentata solo apoteca-natura
    assert PRIV.is_talent_pool(cipolla["title"]) is True
    assert PRIV.is_talent_pool(cipolla["title"], source="sospiro") is True
    assert PRIV.is_talent_pool(cipolla["title"], source="apoteca-natura") is False


def test_apoteca_natura_job_and_expiry():
    row = AN.parse_list(read("apoteca_list.html"))[0]
    body = AN.parse_body(read("apoteca_detail.html"))
    assert body.startswith("La Farmacia Cipolla di Campobasso") and "Le Farmacie Apoteca Natura si impegnano" not in body
    stats: dict = {}
    job = AN.build_job(row, body, datetime(2026, 8, 1, tzinfo=timezone.utc), stats)
    assert job is not None and job.title == "Farmacista collaboratore/a - Farmacia Cipolla, Campobasso"
    assert job.profession == "Farmacia" and job.sector == "privato" and job.company == "Apoteca Natura"
    assert job.location_district == "Molise" and job.location_concelho == "Campobasso"
    assert job.expires_at.startswith("2026-09-30") and job.published_at.startswith("2026-07-08")
    assert job.application_url == "https://job.apotecanatura.it" + row["href"]
    assert job.source == "apoteca-natura" and job.source_id.startswith("apoteca-natura-farmacista-collaboratore")
    assert "Candidatura Spontanea" not in job.title and stats == {}
    no_contacts(job)
    # scaduto (dopo il 30/09/2026) -> escluso
    assert AN.build_job(row, body, datetime(2026, 11, 25, tzinfo=timezone.utc), stats) is None and stats == {"expired": 1}
    # scheda generica senza sede -> esclusa
    generic = AN.parse_list(read("apoteca_list1.html"))[-1]
    assert AN.build_job(generic, body, datetime(2026, 8, 1, tzinfo=timezone.utc), {}) is None
