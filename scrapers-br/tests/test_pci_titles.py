from __future__ import annotations

import unittest

from sources.pci_concursos import PciConcursosScraper


CBMERJ_BODY = """
O Corpo de Bombeiros Militar do Estado do Rio de Janeiro (CBMERJ)
abriu um Processo Seletivo para preencher vagas no cargo de 1º Tenente BM Temporário Especialista.
O processo abrange vagas para profissionais de nível superior nas áreas de saúde.
1º Ten BM Médico Cardiologista (3 vagas)
1º Ten BM Dentista Radiologista (2 vagas)
1º Ten BM Psicólogo com pós-graduação (3 vagas)
"""


class PciTitleComposeTests(unittest.TestCase):
    def test_cbmerj_title_from_roles(self) -> None:
        from common.normalize import extract_concurso_health_roles

        roles = extract_concurso_health_roles(CBMERJ_BODY)
        title = PciConcursosScraper._compose_title(
            roles=roles,
            org="CBMERJ - Corpo de Bombeiros Militar do Estado do Rio de Janeiro",
            uf="RJ",
            listing_title="CBMERJ - RJ abre processo seletivo para 1º tenente temporário",
            detail_title="CBMERJ - RJ abre processo seletivo para 1º tenente temporário",
        )
        self.assertEqual(title, "Médico, Dentista e outras especialidades — CBMERJ (RJ)")

    def test_single_role_title(self) -> None:
        title = PciConcursosScraper._compose_title(
            roles=["Enfermeiro"],
            org="Prefeitura de Saltinho",
            uf="SP",
            listing_title="Prefeitura de Saltinho - SP abre processo seletivo para Agente Comunitário de Saúde",
            detail_title="",
        )
        self.assertEqual(title, "Enfermeiro — Prefeitura de Saltinho (SP)")

    def test_reject_bureaucratic_without_roles(self) -> None:
        title = PciConcursosScraper._compose_title(
            roles=[],
            org="CBMERJ - Corpo de Bombeiros Militar do Estado do Rio de Janeiro",
            uf="RJ",
            listing_title="CBMERJ - RJ abre processo seletivo para 1º tenente temporário",
            detail_title="CBMERJ - RJ abre processo seletivo para 1º tenente temporário",
        )
        self.assertIsNone(title)

    def test_detail_headline_skips_logo_h1(self) -> None:
        from bs4 import BeautifulSoup

        html = """
        <html><head><title>Edital X</title></head><body>
        <h1 id="logo"></h1>
        <h1 itemprop="headline">Headline real do edital</h1>
        <div itemprop="articleBody">Texto com Médico clínico.</div>
        </body></html>
        """
        soup = BeautifulSoup(html, "lxml")
        self.assertEqual(
            PciConcursosScraper._detail_headline(soup),
            "Headline real do edital",
        )


if __name__ == "__main__":
    unittest.main()
