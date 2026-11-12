import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common import normalize as n  # noqa: E402
from common.normalize import (  # noqa: E402
    guess_contract, guess_district, guess_profession, html_to_text, profession_slug,
)
from sources import SCRAPERS  # noqa: E402


def test_registry_has_public_sources():
    assert {"veneto-concorsi", "inpa", "gu-s4"} <= set(SCRAPERS)
    assert all(cls.slug == slug for slug, cls in SCRAPERS.items())


def test_all_tables_point_to_official_regions():
    for table in (n.REGION_ALIASES, n.PROVINCE_TO_REGION, n.CITY_TO_REGION, n.SIGLA_TO_REGION):
        assert set(table.values()) <= set(n.REGIONS)
    assert len(n.REGIONS) == 20
    # ogni regione ha almeno una provincia e una sigla
    assert set(n.PROVINCE_TO_REGION.values()) == set(n.REGIONS)


def test_all_107_province_sigle_present():
    assert len(set(n.SIGLA_TO_REGION)) >= 105


@pytest.mark.parametrize("city,region,expected", [
    ("Milano", None, "Lombardia"),
    ("Roma", "Lazio", "Lazio"),
    ("Napoli (NA)", None, "Campania"),
    ("Sesto San Giovanni", None, "Lombardia"),
    ("Reggio Emilia", None, "Emilia-Romagna"),
    ("Reggio Calabria", None, "Calabria"),
    ("Reggio di Calabria", None, "Calabria"),
    ("Forlì", None, "Emilia-Romagna"),
    ("Bolzano", None, "Trentino-Alto Adige"),
    ("Merano (BZ)", None, "Trentino-Alto Adige"),
    ("Aosta", None, "Valle d'Aosta"),
    ("Cagliari", "Sardegna", "Sardegna"),
    ("Olbia", None, "Sardegna"),
    ("Trieste", "Friuli Venezia Giulia", "Friuli-Venezia Giulia"),
    ("Trentino-Alto Adige/Südtirol", None, "Trentino-Alto Adige"),
    ("Torino, Piemonte, Italia", None, "Piemonte"),
    ("Altamura, Bari", None, "Puglia"),
    ("Pesaro e Urbino", None, "Marche"),
    ("Fermo, Marche", None, "Marche"),
    ("Via Garibaldi 10, 20100 Milano MI", None, "Lombardia"),
    ("Rome", None, "Lazio"),
])
def test_district(city, region, expected):
    assert guess_district(city, region) == expected


def test_district_unknown():
    assert guess_district(None, None) == "Italia"
    assert guess_district("Italia") == "Italia"
    assert guess_district("Barcellona") == "Italia"
    # parola intera: niente match su sottostringhe, ne' su parole comuni
    assert guess_district("Il paziente e' fermo da ieri") == "Italia"
    assert guess_district("Fantastico") == "Italia"


def test_profession_labels_and_slugs_are_consistent():
    expected = {
        "medicina", "infermieristica", "oss", "fisioterapia", "tecnici-sanitari", "ostetricia", "farmacia",
        "psicologia", "odontoiatria", "veterinaria", "servizio-sociale", "nutrizione-dietistica",
        "logopedia-riabilitazione", "ottica-audiometria", "amministrativo", "gestione-supporto", "formazione", "altro",
    }
    assert set(n.PROFESSION_SLUGS.values()) == expected


PROFESSION_CASES = {
    "Infermiere/a di sala operatoria": "Infermieristica",
    "Infermiere pediatrico": "Infermieristica",
    "Coordinatore infermieristico": "Infermieristica",
    "OSS - Operatore Socio Sanitario": "OSS",
    "Operatore Socio-Sanitario per RSA": "OSS",
    "Ausiliario socio assistenziale ASA": "OSS",
    "Dirigente medico di Cardiologia": "Medicina",
    "Dirigente Medico di Ostetricia e Ginecologia": "Medicina",
    "Medico di medicina generale": "Medicina",
    "Medico/a competente": "Medicina",
    "Anestesista rianimatore": "Medicina",
    "Medico odontoiatra": "Odontoiatria",
    "Medico veterinario": "Veterinaria",
    "Fisioterapista": "Fisioterapia",
    "Osteopata": "Fisioterapia",
    "Tecnico sanitario di radiologia medica (TSRM)": "Tecnici sanitari",
    "Tecnico di laboratorio biomedico": "Tecnici sanitari",
    "Biologo": "Tecnici sanitari",
    "Ostetrica/o": "Ostetricia",
    "Farmacista collaboratore": "Farmacia",
    "Psicologo/a clinico": "Psicologia",
    "Psicoterapeuta": "Psicologia",
    "Igienista dentale": "Odontoiatria",
    "Assistente alla poltrona": "Odontoiatria",
    "Assistente sociale": "Servizio sociale",
    "Educatore/trice professionale": "Servizio sociale",
    "Dietista": "Nutrizione e dietistica",
    "Biologo nutrizionista": "Nutrizione e dietistica",
    "Logopedista": "Logopedia e riabilitazione",
    "Terapista occupazionale": "Logopedia e riabilitazione",
    "Ottico optometrista": "Ottica e audiometria",
    "Audioprotesista": "Ottica e audiometria",
    "Impiegato amministrativo": "Amministrativo",
    "Addetto/a reception": "Amministrativo",
    "Operatore CUP": "Amministrativo",
    "Responsabile qualità": "Gestione e supporto",
    "Direttore sanitario": "Medicina",
    "Responsabile risorse umane": "Gestione e supporto",
    "Formatore ECM": "Formazione",
    "Informatore scientifico del farmaco": "Altro",
    "Sviluppatore web": "Altro",
    "Autista ambulanza": "Altro",
}


@pytest.mark.parametrize("title,expected", PROFESSION_CASES.items())
def test_profession(title, expected):
    assert guess_profession(title) == expected, title


def test_profession_fallback_and_default():
    assert guess_profession("Posizione aperta", fallback="Infermiere") == "Infermieristica"
    assert guess_profession("Posizione aperta") == "Altro"
    assert profession_slug("Nutrizione e dietistica") == "nutrizione-dietistica"
    assert profession_slug("sconosciuta") == "altro"


@pytest.mark.parametrize("text,expected", [
    ("Contratto a tempo indeterminato", "Tempo indeterminato"),
    ("Tempo determinato 12 mesi", "Tempo determinato"),
    ("Sostituzione maternità", "Tempo determinato"),
    ("Part-time 20 ore", "Part-time"),
    ("Part time a tempo indeterminato", "Part-time"),
    ("Libero professionista con partita IVA", "Libero professionale"),
    ("Incarico libero-professionale", "Libero professionale"),
    ("Lavoro su turni", "Turni"),
    ("Tempo pieno", "Full-time"),
    ("Apprendistato", "Apprendistato"),
    ("Tirocinio extracurriculare", "Tirocinio"),
    ("Contratto CCNL Sanità privata", "Contratto"),
])
def test_contract(text, expected):
    assert guess_contract(text) == expected


def test_contract_none():
    assert guess_contract(None) is None
    assert guess_contract("") is None
    assert guess_contract("Sede a Milano") is None


def test_html_to_text_italian_edge_cases():
    html = "<p>Requisiti:&nbsp;laurea</p><ul><li>Esperienza</li><li>Disponibilit&agrave;</li></ul>"
    out = html_to_text(html)
    assert "\xa0" not in out
    assert "- Disponibilità" in out
    assert html_to_text(None) == ""


def test_slugify_and_hash():
    assert n.slugify("Infermiere — Pronto Soccorso, Città") == "infermiere-pronto-soccorso-citta"
    assert n.dedupe_hash("A", "B", "C") == n.dedupe_hash(" a ", "b", "c")
