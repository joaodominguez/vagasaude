import json
from pathlib import Path

import pytest

from sources import _intervieweb as I
from sources.gemelli import GemelliScraper
from sources.gsd import job_urls as gsd_job_urls, parse_detail as gsd_parse
from sources.gvm import GvmScraper
from sources.hsr import list_items as hsr_items, prefilter as hsr_prefilter
from sources.synlab import SynlabScraper

FX = Path(__file__).parent / "fixtures"


def fx(name):
    return (FX / name).read_text(encoding="utf-8")


def test_career_page_info_and_list():
    html = fx("intervieweb_career.html")
    info = I.career_page_info(html)
    assert info["pages"] == 4 and info["section"] and "newcareer" in info["ajax_url"] and "&amp;" not in info["ajax_url"]
    rows = I.parse_list(html)
    assert len(rows) == 3
    fisio = next(r for r in rows if r["title"].startswith("Fisioterapista"))
    assert fisio["url"].endswith("-718815/it/") and fisio["place"] == "Bologna Italia" and fisio["function"] == "Servizi Sanitari"
    with pytest.raises(ValueError):
        I.career_page_info("<html></html>")


def test_classify_row_filters_non_clinical():
    rows = {r["title"].split(" - ")[0]: I.classify_row(r) for r in I.parse_list(fx("intervieweb_career.html"))}
    assert rows["Fisioterapista"] == "Fisioterapia"
    assert rows["Addetta/o Accettazione"] is None
    cases = {
        "Infermiere (m/f) - Roma": "Infermieristica",
        "Tecnici di Radiologia (m/f) - Bordighera (IM)": "Tecnici sanitari",
        "Medico Radiologo - Cortina": "Medicina",
        "Addetta alle pulizie (m/f) - Roma": None,
        "Specialista di accoglienza - Full time": None,
        "Controller Junior (m/f) - Lecce": None,
        "HR Internship": None,
        "Coordinatore Retail Punti Prelievo - area BERGAMO": None,
        "Data Scientist - progetto EU4Health": None,
        "BANDO PNC-E3 titolo INNOVA finanziato dal MUR": None,
        "Candidatura spontanea": None,
    }
    for title, expected in cases.items():
        assert I.classify_row({"title": title, "function": ""}) == expected, title


def test_synlab_detail_fields():
    url = "https://inrecruiting.intervieweb.it/synlabitalia/jobs/fisioterapista-libero-professionista-bologna-718815/it/"
    stats: dict = {}
    job = I.parse_detail(fx("intervieweb_synlab_fisio.html"), url, SynlabScraper, "Fisioterapia", stats)
    assert job is not None and not stats
    assert job.title == "Fisioterapista - Libero Professionista - Bologna"
    assert job.company == "Synlab Italia" and job.sector == "privato" and job.profession == "Fisioterapia"
    assert job.location_concelho == "Bologna" and job.location_district == "Emilia-Romagna"
    assert job.contract_type == "Libero professionale"
    assert job.application_url == url and job.source == "synlab" and job.source_id == "synlab-718815"
    assert "@" not in job.description and len(job.description) > 300


def test_gemelli_research_call_title_expiry_and_city():
    url = "https://policlinicogemelli.intervieweb.it/jobs/n-1-cococo-per-medicoa-specialista-in-cardiologia-159314/it/"
    job = I.parse_detail(fx("intervieweb_gemelli_cococo.html"), url, GemelliScraper, "Medicina", {})
    assert job is not None
    assert job.title == "Medico/a specialista in Cardiologia - Roma"
    assert job.company == "Policlinico Gemelli" and job.location_district == "Lazio"
    assert job.source_id == "gemelli-159314"
    assert "@" not in job.description


def test_role_title_cleaning():
    assert I.clean_role_title("BANDO PNRR-MR1-2023-1 per N.1 MEDICO/A CON CONTRATTO cococo - Sostituzione") == "Medico/a - progetto di ricerca"
    assert I.clean_role_title("N. 1 Contratto Libero-Professionale per Fisioterapista") == "Fisioterapista"
    assert I.clean_role_title("Medico cardiologo_Como") == "Medico cardiologo - Como"


def test_future_date_ignores_past():
    assert I._future_date("scadenza domanda", "Scadenza domanda: 01/01/2020") is None
    assert I._future_date("scadenza domanda", "Scadenza domanda: 31/12/2999") == "2999-12-31"


def test_cache_rows_expire_by_version_and_age():
    assert I.cache_get({"k": {"v": 0, "t": 9e9, "job": None}}, "k") is None
    assert I.cache_get({"k": {"v": I.CACHE_VERSION, "t": 1, "job": None}}, "k") is None
    assert I.cache_get({"k": I.cache_row(None)}, "k") is not None


def test_gvm_config():
    assert GvmScraper.slug == "gvm" and GvmScraper.career_url.startswith("https://jobgvm.intervieweb.it/")


def test_hsr_list_and_prefilter():
    html = (
        '<a href="https://joblink.allibo.com/ats3/job-offer.aspx?">Medico Specialista (PNRR-X)</a>'
        '<a href="https://joblink.allibo.com/ats3/job-offer.aspx?DM=1959&amp;SG=6&amp;FT=1399&amp;ID=104382&amp;LN=IT">Fisioterapista (PNRR-Y)</a>'
        '<a href="https://joblink.allibo.com/ats3/job-offer.aspx?DM=1959&amp;SG=6&amp;FT=1399&amp;ID=104382&amp;LN=IT">Fisioterapista (dup)</a>'
        '<a href="https://joblink.allibo.com/ats3/job-offer.aspx?DM=1959&amp;SG=6&amp;FT=1399&amp;ID=103247&amp;LN=IT">Ricercatore Biologo</a>'
    )
    items = hsr_items(html)
    assert [i["Title"] for i in items] == ["Fisioterapista (PNRR-Y)", "Ricercatore Biologo"]
    assert hsr_prefilter("Fisioterapista (PNRR-Y)") == "Fisioterapia"
    assert hsr_prefilter("Ricercatore Biologo") is None
    assert hsr_prefilter("Study Coordinator") is None


def test_gsd_sitemap_and_detail():
    xml = (
        "<urlset>"
        "<url><loc>https://www.grupposandonato.it/lavora-con-noi/medico</loc></url>"
        "<url><loc>https://www.grupposandonato.it/lavora-con-noi/medico/medico-specialista-medicina-interna</loc></url>"
        "<url><loc>https://www.grupposandonato.it/lavora-con-noi/it/icpv-stage-servizio-tecnico</loc></url>"
        "<url><loc>https://www.grupposandonato.it/lavora-con-noi/infermiere/infermiere-icsan</loc></url>"
        "</urlset>"
    )
    assert [c for c, _ in gsd_job_urls(xml)] == ["medico", "infermiere"]
    html = (
        '<h1 class="title-page">Medico Specialista in Medicina Interna</h1><div class="c-text text-left">'
        "<p>L'Istituto Clinico S. Anna cerca un Medico Specialista in Medicina Interna per il reparto di Geriatria.</p>"
        "<h2>Dove?</h2><ul><li>Via del Franzone, 31 &ndash; 25127 Brescia</li></ul>"
        "<h2>Dettagli lavorativi</h2><ul><li>Tipo di contratto: Libera Professione</li></ul></div>"
    )
    job = gsd_parse(html, "https://www.grupposandonato.it/lavora-con-noi/medico/medico-specialista-medicina-interna", "medico")
    assert job is not None
    assert job.title == "Medico Specialista in Medicina Interna - Brescia"
    assert job.company == "Gruppo San Donato" and job.location_concelho == "Brescia" and job.location_district == "Lombardia"
    assert job.profession == "Medicina" and job.contract_type == "Libero professionale"
    assert job.source_id == "gsd-medico-specialista-medicina-interna"


def test_job_id_accepts_underscore_slugs():
    assert I.job_id("https://jobgvm.intervieweb.it/jobs/infermiere_gb_mangioni_hospital__lecco_71033/it/") == "71033"
    assert I.job_id("https://jobgvm.intervieweb.it/jobs/addetta-alle-pulizie-364358/it/") == "364358"
    assert I.job_id("https://jobgvm.intervieweb.it/jobs/senza-id/it/") is None
