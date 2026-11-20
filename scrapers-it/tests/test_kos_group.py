from pathlib import Path

import pytest

from sources import kos_group as K

FX = Path(__file__).parent / "fixtures"


def cards():
    return K.parse_list((FX / "kos_list.html").read_text(encoding="utf-8"))


def test_parse_list_divisoes_e_campos():
    cs = cards()
    assert len(cs) >= 8
    assert {c["division"] for c in cs} == {"psichiatria", "riabilitazione", "rsa", "servizi ospedalieri"}
    first = cs[0]
    assert first["id"].isdigit() and first["city"] and first["region_raw"]


def test_jobs_so_clinicos_marcados_privado_com_empresa_certa():
    stats = {}
    jobs = [j for j in (K.to_job(c, stats) for c in cards()) if j]
    assert jobs and all(j.sector == "privato" and j.source == "kos-group" and j.expires_at is None for j in jobs)
    assert all(j.profession in {"OSS", "Infermieristica", "Fisioterapia", "Medicina", "Servizio sociale"} for j in jobs)
    rsa = [j for j in jobs if j.company.startswith("Anni Azzurri")]
    santo = [j for j in jobs if j.company.startswith("Santo Stefano")]
    assert rsa and all("RSA" in j.description for j in rsa)
    assert santo and all("riabilitazione" in j.description for j in santo)
    assert all(j.application_url.startswith("https://lavoraconnoi.kosgroup.com/job/view-job.php?id=") for j in jobs)
    assert all("@" not in j.description for j in jobs)


def test_nao_clinicos_ficam_fora():
    for title in ["ADDETTO/A PULIZIE STRUTTURA SANITARIA", "AIUTO CUOCO", "ADDETTO FRONT OFFICE - CATEGORIE PROTETTE L.68/99"]:
        card = {"id": "1", "title": title, "city": "Roma", "region_raw": "Lazio", "contract": "Contratto a tempo determinato", "division": "rsa", "new": False}
        assert K.to_job(card, {}) is None
    for title, prof in [("OPERATORE SOCIO SANITARIO (OSS)", "OSS"), ("ADDETTO/A ALL'ASSISTENZA DI BASE (ADB)", "OSS"), ("EDUCATORE ABA", "Servizio sociale"),
                        ("INFERMIERE (ARCUGNANO, VI)", "Infermieristica"), ("MEDICO DI GUARDIA", "Medicina"), ("FISIOTERAPISTA", "Fisioterapia")]:
        card = {"id": "2", "title": title, "city": "Vicenza", "region_raw": "Veneto", "contract": "Contratto di collaborazione", "division": "riabilitazione", "new": False}
        j = K.to_job(card, {})
        assert j and j.profession == prof and j.contract_type == "Libero professionale"


def test_contratos():
    assert K._contract("Contratto a tempo indeterminato") == "Tempo indeterminato"
    assert K._contract("Contratto a tempo determinato") == "Tempo determinato"


def test_estrutura_mudada_levanta_erro():
    with pytest.raises(RuntimeError):
        K.parse_list("<html><body>JS</body></html>")


def test_sentinela_contagem_anunciada():
    html = (FX / "kos_list.html").read_text(encoding="utf-8").replace("POSIZIONI APERTE (10)", "POSIZIONI APERTE (78)")
    with pytest.raises(RuntimeError):
        K.parse_list(html)  # leu 10 de 78: estrutura mudou
