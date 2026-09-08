from common.title import shorten_job_title


def test_ipst_assistente_tecnico():
    assert (
        shorten_job_title(
            "1 posto de trabalho da carreira de assistente técnico, categoria de assistente técnico, "
            "na modalidade de vínculo de emprego público por tempo indeterminado para o IPST"
        )
        == "Assistente Técnico"
    )


def test_ipst_tecnico_superior():
    assert (
        shorten_job_title(
            "1 posto de trabalho da carreira de técnico superior, categoria de técnico superior, "
            "na modalidade de vínculo de emprego público por tempo indeterminado para…"
        )
        == "Técnico Superior"
    )


def test_ipst_tsdt():
    out = shorten_job_title(
        "2 postos de trabalho da carreira de técnico superior das áreas de diagnóstico e terapêutica, "
        "categoria de técnico superior das áreas de diagnóstico e terapêutica, na modalidade de vínculo…"
    )
    assert "Diagnóstico" in out or "Técnico Superior" in out
    assert "vínculo" not in out.lower()
    assert "2 vagas" in out or "Diagnóstico" in out


def test_ipst_auxiliar_saude():
    out = shorten_job_title(
        "4 postos de trabalho da carreira especial de técnico auxiliar de saúde, "
        "categoria de técnico auxiliar de saúde, na modalidade de vínculo de emprego público p…"
    )
    assert out.startswith("Técnico Auxiliar de Saúde")
    assert "4 vagas" in out
    assert "modalidade" not in out.lower()


def test_uls_farmaceutico():
    out = shorten_job_title(
        "Procedimento concursal comum para preenchimento de um (1) posto de trabalho na categoria de "
        "Farmacêutico Assessor Sénior — área de exercício profissional de farmácia hospitalar"
    )
    assert "Farmacêutico Assessor Sénior" in out
    assert "procedimento" not in out.lower()


def test_uls_medico():
    out = shorten_job_title(
        "Procedimento concursal comum para ocupação de um posto de trabalho vago na categoria de "
        "Assistente Graduado Sénior de Patologia Clínica da Carreira Médica"
    )
    assert "Assistente Graduado Sénior" in out
    assert "Patologia Clínica" in out or "assistente" in out.lower()
    assert len(out) < 90


def test_ipo_bolsa_tsdt():
    out = shorten_job_title(
        "CONSTITUIÇÃO DE BOLSA DE RESERVAS DE TÉCNICOS SUPERIORES DE DIAGNÓSTICO E TERAPÊUTICA – FISIOTERAPIA"
    )
    assert "Fisioterapia" in out or "Fisioterapeuta" in out
    assert "constituição" not in out.lower()


def test_ipo_contratacao():
    out = shorten_job_title(
        "CONTRATAÇÃO DE 1 FARMACÊUTICO ASSISTENTE – FARMÁCIA HOSPITALAR – CONTRATO INDIVIDUAL DE TRABALHO SEM TERMO"
    )
    assert "Farmacêutico" in out
    assert "contrato individual" not in out.lower()


def test_dre_enfermeiro():
    out = shorten_job_title(
        "Abertura de procedimento concursal comum para constituição de reserva de recrutamento, "
        "na categoria de enfermeiro, da carreira de enfermagem."
    )
    assert out.lower().startswith("enfermeiro")
    assert "procedimento" not in out.lower()


def test_keeps_short_private_titles():
    assert shorten_job_title("Enfermeiro — Urgência") == "Enfermeiro — Urgência"
    assert shorten_job_title("Farmacêutico Adjunto") == "Farmacêutico Adjunto"


def test_sao_joao_reserva():
    out = shorten_job_title(
        "Reserva de Recrutamento para Técnico Superior das Áreas de Diagnóstico e Terapêutica Fisioterapia - 2026"
    )
    assert out == "Técnico Superior de Diagnóstico e Terapêutica — Fisioterapia"


def test_dre_auxiliar():
    assert (
        shorten_job_title(
            "Procedimento concursal para constituição de reserva de recrutamento ― técnico auxiliar de saúde ― m/f."
        )
        == "Técnico Auxiliar de Saúde"
    )
