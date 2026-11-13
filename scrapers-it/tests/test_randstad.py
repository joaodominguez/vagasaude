import json

from sources import randstad as R

URL = "https://www.randstad.it/offerte-lavoro/oss-per-servizio-di-assistenza-domiciliare_cervignano-del-friuli_5906293b-3fde-4f63-8cc3-7cbf17fbf69d/"


def page(**over):
    posting = {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "title": "OSS per servizio di assistenza domiciliare",
        "datePosted": "2026-11-13T08:52:18+0000",
        "description": "<p>Randstad Healthcare, divisione specializzata in ambito sanitario, ricerca OSS per un servizio di assistenza domiciliare.</p><p>Contatti: mario.rossi@gmail.com</p>",
        "industry": "Sanità",
        "identifier": {"@type": "PropertyValue", "name": "Randstad", "value": "CX587756"},
        "jobLocation": {"@type": "Place", "address": {"addressLocality": "Cervignano del Friuli", "addressRegion": "Friuli-Venezia Giulia", "postalCode": "33052", "addressCountry": "IT"}},
        "employmentType": ["TEMPORARY", "PART_TIME"],
        "responsibilities": "<ul><li>assistenza diretta nelle attività quotidiane</li><li>igiene personale e mobilità dei pazienti</li></ul>",
        "qualifications": "<p>Qualifica di OSS.</p><p>Il presente annuncio è rivolto a persone di genere femminile e maschile.</p>",
        "validThrough": "2026-12-31T23:00:00+0000",
        "baseSalary": {"@type": "MonetaryAmount", "currency": "EUR", "value": {"@type": "QuantitativeValue", "value": 22000, "unitText": "YEAR"}},
    }
    posting.update(over)
    return f'<html><script type="application/ld+json">{json.dumps(posting)}</script></html>'


def test_slug_prefilter():
    assert R.is_health_slug(URL)
    assert R.is_health_slug("https://www.randstad.it/offerte-lavoro/infermiere-rsa_milano_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/")
    assert not R.is_health_slug("https://www.randstad.it/offerte-lavoro/magazziniere-fmnb_roma_e38262fa-5e45-492d-adc7-571adcc6439b/")


def test_parse_job_agency_health_posting():
    job = R.parse_job(page(), URL)
    assert job is not None
    assert job.company == "Randstad Healthcare (agenzia per il lavoro)"
    assert job.description.startswith(R.AGENCY_LINE)
    assert "mario.rossi" not in job.description  # contatti personali rimossi
    assert "Il presente annuncio" not in job.description
    assert job.profession == "OSS"
    assert job.location_district == "Friuli-Venezia Giulia" and job.location_concelho == "Cervignano del Friuli"
    assert "Cervignano" in job.title  # citta' nel titolo: niente falsi duplicati tra citta'
    assert job.source_id == "randstad-CX587756"
    assert job.salary == "22.000 € lordi annui"
    assert job.expires_at == "2026-12-31"


def test_parse_job_filters():
    assert R.parse_job(page(industry="Logistica"), URL) is None
    assert R.parse_job(page(title="Magazziniere"), URL) is None
    assert R.parse_job(page(jobLocation={"address": {"addressLocality": "Lugano", "addressCountry": "CH"}}), URL) is None


def test_job_urls_from_sitemap():
    xml = f"<urlset><url><loc>{URL}</loc></url><url><loc>https://www.randstad.it/chi-siamo/</loc></url></urlset>"
    assert R.job_urls(xml) == [URL]


def test_clean_title():
    assert R.clean_title("INFERMIERI (m/f/nb) per importante ospedale privato di Faenza") == "Infermieri per importante ospedale privato di Faenza"
    assert R.clean_title("Infermiere LP_(F/M/NB)_Morosolo (VA)") == "Infermiere LP Morosolo (VA)"
    assert R.clean_title("Operatore Socio Sanitario (OSS) (F/M/NB) zona Spilamberto") == "Operatore Socio Sanitario (OSS) zona Spilamberto"
    assert R.clean_title("Fisioterapista centro diurno f/m/nb") == "Fisioterapista centro diurno"
