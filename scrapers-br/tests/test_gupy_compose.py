from __future__ import annotations

import unittest

from sources.gupy import compose_gupy_description, GupyScraper


SAMPLE_DETAIL_HTML = """
<html><body>
<script id="__NEXT_DATA__" type="application/json">
{
  "props": {
    "pageProps": {
      "job": {
        "id": 12507359,
        "name": "Psicólogo |  |Yutaka Takeda",
        "description": "<p>Somos uma rede que acredita no cuidado.</p>",
        "responsibilities": "<ul><li>Realizar consultas de atendimento psicoterapêutico;</li><li>Participar de Reunião do Setor;</li></ul>",
        "prerequisites": "<ul><li>Graduação em Psicologia Completo.</li><li>Registro em conselho (OBRIGATÓRIO);</li></ul>",
        "relevantExperiences": "<ul><li>Assistência médica;</li><li>Vale Refeição;</li></ul>",
        "addressCity": "Parauapebas",
        "addressStateShortName": "PA",
        "addressState": "Pará",
        "jobType": "vacancy_type_effective",
        "publishedAt": "2026-10-01T12:00:00.000Z",
        "expiresAt": null
      }
    }
  }
}
</script>
</body></html>
"""


class ComposeGupyDescriptionTests(unittest.TestCase):
    def test_includes_sections(self) -> None:
        text = compose_gupy_description(
            "Perfil da vaga.",
            "- Fazer triagem\n- Atender pacientes",
            "- Plano de saúde\n- Vale refeição",
        )
        self.assertIn("Perfil da vaga.", text)
        self.assertIn("Responsabilidades:", text)
        self.assertIn("- Fazer triagem", text)
        self.assertIn("O que oferecemos:", text)
        self.assertIn("- Plano de saúde", text)

    def test_skips_empty_sections(self) -> None:
        text = compose_gupy_description("Só perfil.", "", "")
        self.assertEqual(text, "Só perfil.")
        self.assertNotIn("Responsabilidades:", text)


class ParseDetailTests(unittest.TestCase):
    def test_parse_detail_fields(self) -> None:
        scraper = GupyScraper.__new__(RedeDorLike)
        detail = scraper._parse_detail_html(SAMPLE_DETAIL_HTML, "rededor")
        assert detail is not None
        self.assertEqual(detail["id"], 12507359)
        self.assertIn("cuidado", detail["description"])
        self.assertIn("psicoterapêutico", detail["responsibilities"])
        self.assertIn("Assistência médica", detail["relevantExperiences"])


class RedeDorLike(GupyScraper):
    slug = "rededor"
    name = "Rede D'Or"
    subdomain = "rededor"
    company = "Rede D'Or"
    sector = "privado"


if __name__ == "__main__":
    unittest.main()
