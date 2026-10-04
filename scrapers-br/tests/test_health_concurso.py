from __future__ import annotations

import unittest

from common.normalize import (
    extract_concurso_health_roles,
    looks_like_health_concurso,
)


class HealthConcursoFilterTests(unittest.TestCase):
    def test_rejects_trt_judiciario(self) -> None:
        self.assertFalse(
            looks_like_health_concurso(
                "TRT 8 — PA/AP Publica Edital de Concurso para Técnicos e Analistas Judiciários",
                "TRT 8ª Região - Tribunal Regional do Trabalho da 8ª Região",
                "Cadastro Reserva até R$ 16.040,88 Analista Judiciário, Técnico Judiciário",
            )
        )

    def test_rejects_stj_and_mpu(self) -> None:
        self.assertFalse(
            looks_like_health_concurso(
                "STJ Retifica Novamente Concurso Público com 65 Vagas para Analistas e Técnicos",
                "STJ - Superior Tribunal de Justiça",
                "65 vagas Analista e Técnico",
            )
        )
        self.assertFalse(
            looks_like_health_concurso(
                "MPU retifica Concurso com 172 vagas para Analistas e Técnicos",
                "MPU - Ministério Público da União",
                "172 vagas",
            )
        )

    def test_rejects_policia_and_correios(self) -> None:
        self.assertFalse(
            looks_like_health_concurso(
                "Polícia Federal reabre edital de Concurso Público com 192 vagas",
                "Polícia Federal",
                "192 vagas",
            )
        )
        self.assertFalse(
            looks_like_health_concurso(
                "Correios: Concurso Público com 33 Vagas para Diversos Estados É Retificado",
                "Correios - Empresa Brasileira de Correios e Telégrafos",
                "33 vagas",
            )
        )

    def test_rejects_exercito_generic(self) -> None:
        self.assertFalse(
            looks_like_health_concurso(
                "Exército Brasileiro Abre 64 Processos Seletivos para Oficiais e Sargentos",
                "Exército Brasileiro - Comando da 2ª Região Militar",
                "Oficiais e Sargentos",
            )
        )

    def test_keeps_health_military_school(self) -> None:
        self.assertTrue(
            looks_like_health_concurso(
                "Esfcex Abre Concurso para Admissão Ao Curso de Formação de Oficiais do Serviço de Saúde",
                "ESFCex - Escola de Saúde e Formação Complementar do Exército",
                "168 vagas Médico, Farmacêutico, Dentista Superior",
            )
        )

    def test_keeps_pm_medicos(self) -> None:
        self.assertTrue(
            looks_like_health_concurso(
                "SAEB — BA Prorroga Inscrições do Concurso para Oficiais Médicos e Odontólogos na PM e Bombeiros",
                "PMBA e CBMBA - Polícia Militar e Corpo de Bombeiros",
                "Oficiais Médicos e Odontólogos",
            )
        )

    def test_keeps_enfermeiro_prefeitura(self) -> None:
        self.assertTrue(
            looks_like_health_concurso(
                "Prefeitura de X Abre Concurso para Enfermeiro e Técnico de Enfermagem",
                "Prefeitura de X",
                "Enfermeiro, Técnico de Enfermagem",
            )
        )

    def test_keeps_secretaria_saude(self) -> None:
        self.assertTrue(
            looks_like_health_concurso(
                "A Secretaria de Saúde abre processo seletivo",
                "Prefeitura de Braço do Norte",
                "Diversos cargos",
            )
        )

    def test_rejects_generic_prefeitura_without_health_cargo(self) -> None:
        self.assertFalse(
            looks_like_health_concurso(
                "Prefeitura de Novo Progresso — PA Abre Processo Seletivo para Diversos Cargos",
                "Prefeitura de Novo Progresso",
                "193 vagas até R$ 4.308,79 Vários Cargos Fundamental / Médio / Técnico / Superior",
            )
        )

    def test_keeps_prefeitura_when_detail_lists_medico(self) -> None:
        self.assertTrue(
            looks_like_health_concurso(
                "Prefeitura de Novo Progresso — PA Abre Processo Seletivo para Diversos Cargos",
                "Prefeitura de Novo Progresso",
                "Oportunidades para Médico clínico geral e Enfermeiro. Vários cargos.",
            )
        )

    def test_rejects_cbmerj_without_health_cargo(self) -> None:
        self.assertFalse(
            looks_like_health_concurso(
                "CBMERJ - RJ abre processo seletivo para 1º tenente temporário",
                "CBMERJ - Corpo de Bombeiros Militar do Estado do Rio de Janeiro",
                "192 vagas até R$ 12.279,71 Vários Cargos Superior",
            )
        )

    def test_keeps_cbmerj_with_medico_in_detail(self) -> None:
        self.assertTrue(
            looks_like_health_concurso(
                "CBMERJ - RJ abre processo seletivo para 1º tenente temporário",
                "CBMERJ - Corpo de Bombeiros Militar do Estado do Rio de Janeiro",
                "áreas de saúde. 1º Ten BM Médico Cardiologista (3 vagas)",
            )
        )

    def test_entre_hours_not_tre_false_positive(self) -> None:
        # "entre" não deve disparar o token TRE; com cargo clínico, mantém.
        self.assertTrue(
            looks_like_health_concurso(
                "Prefeitura de Pedra Dourada — MG Divulga Retificações do Concurso Público",
                "Prefeitura de Pedra Dourada",
                "carga horaria entre 30 e 40 horas semanais para Enfermeiro",
            )
        )

    def test_extract_roles_cbmerj(self) -> None:
        roles = extract_concurso_health_roles(
            "1º Ten BM Médico Cardiologista; Dentista Periodontista; Psicólogo"
        )
        self.assertIn("Médico", roles)
        self.assertIn("Dentista", roles)
        self.assertIn("Psicólogo", roles)


if __name__ == "__main__":
    unittest.main()
