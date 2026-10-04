from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import MagicMock

from sources.inca import (
    IncaScraper,
    format_cargo_summary,
    parse_cpnu_cargos_xlsx,
    salary_from_cargos,
    title_from_cargos,
)

FIXTURE = Path(__file__).parent / "fixtures" / "cpnu2_cargos_sample.xlsx"

TABBY_HTML = """
<html><body>
<h1>Concurso Público Nacional Unificado 2</h1>
<div id="content-core">
  <div class="govbr-tabs">
    <div class="tab-content" data-id="Apresentação"
      data-url="https://www.gov.br/inca/pt-br/cpnu/apresentacao">
      Aguarde. Carregando conteúdo da aba...
    </div>
    <div class="tab-content" data-id="Editais"
      data-url="https://www.gov.br/inca/pt-br/cpnu/editais">
      Aguarde. Carregando conteúdo da aba...
    </div>
  </div>
</div>
</body></html>
"""

APRESENTACAO_HTML = """
<html><body><div id="content-core">
<p>O CPNU ofertou 3.652 vagas, incluindo o INCA com 84 vagas.</p>
<a href="https://www.gov.br/gestao/pt-br/concursonacional">CPNU 2</a>
</div></body></html>
"""

EDITAIS_HTML = """
<html><body><div id="content-core">
<a href="https://conhecimento.fgv.br/cpnu2">Editais</a>
</div></body></html>
"""

CARGOS_PAGE_HTML = """
<html><body><div id="content-core">
<a href="https://www.gov.br/gestao/pt-br/concursonacional/cpnu-2/cargos-e-salarios-cpnu-2/cargos_salarios_cpnu2_-1.xlsx/view">Cargos e Salários</a>
</div></body></html>
"""


class IncaCpnuEnrichmentTests(unittest.TestCase):
    def test_parse_xlsx_forward_fills_inca_only(self) -> None:
        data = FIXTURE.read_bytes()
        cargos = parse_cpnu_cargos_xlsx(data)
        self.assertEqual(len(cargos), 4)
        self.assertEqual(sum(c["vagas"] or 0 for c in cargos), 84)
        self.assertTrue(all("INCA" in c["org"] for c in cargos))
        self.assertNotIn("Enfermeiro", [c["cargo"] for c in cargos])

    def test_salary_and_title(self) -> None:
        cargos = parse_cpnu_cargos_xlsx(FIXTURE.read_bytes())
        salary = salary_from_cargos(cargos)
        self.assertIsNotNone(salary)
        assert salary is not None
        self.assertIn("R$", salary)
        self.assertIn("a", salary)
        title = title_from_cargos("Concurso Público Nacional Unificado 2", cargos)
        self.assertIn("Pesquisador", title)
        self.assertIn("INCA", title)
        summary = format_cargo_summary(cargos)
        self.assertIn("84", summary)
        self.assertIn("Técnico", summary)

    def test_fetch_detail_loads_tabs_and_xlsx(self) -> None:
        scraper = IncaScraper()
        client = MagicMock()
        xlsx = FIXTURE.read_bytes()

        def get_text(url: str, **_kwargs: object) -> str:
            if url.endswith("/apresentacao") or url.endswith("apresentacao"):
                return APRESENTACAO_HTML
            if url.endswith("/editais") or url.endswith("editais"):
                return EDITAIS_HTML
            if "cargos-e-salarios" in url:
                return CARGOS_PAGE_HTML
            return TABBY_HTML

        def get_bytes(url: str, **_kwargs: object) -> bytes:
            self.assertIn("xlsx", url)
            return xlsx

        client.get_text.side_effect = get_text
        client.get_bytes.side_effect = get_bytes

        detail = scraper._fetch_detail(
            client,
            "https://www.gov.br/inca/pt-br/acesso-a-informacao/institucional/"
            "concurso-publico/2025/concurso-publico-nacional-unificado-2",
        )
        self.assertIn("Pesquisador", detail["title"] or "")
        self.assertIn("84", detail["description"] or "")
        self.assertNotIn("Aguarde. Carregando", detail["description"] or "")
        self.assertIn("fgv.br", detail["description"] or "")
        self.assertIsNotNone(detail["salary"])
        self.assertIn("Nível", detail["requirements"] or "")


if __name__ == "__main__":
    unittest.main()
