"""Testes offline dos parsers de oportunidades de emprego do SESARAM."""

from __future__ import annotations

import unittest
from pathlib import Path

from sources.sesaram import (
    SesaramScraper,
    _to_payload,
    parse_sesaram_detail,
    parse_sesaram_list,
)

FIXTURES = Path(__file__).resolve().parent / "fixtures"


class SesaramParseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.items = parse_sesaram_list(
            (FIXTURES / "sesaram-oportunidades.html").read_text(encoding="utf-8")
        )
        cls.detail = parse_sesaram_detail(
            (FIXTURES / "sesaram-detalhe.html").read_text(encoding="utf-8"),
            cls.items[0]["url"] if cls.items else "",
        )

    def test_only_open_section(self) -> None:
        # A fixture tem também "A decorrer" e "Concluídas"; só conta "Abertas".
        self.assertEqual(len(self.items), 1)
        self.assertIn("/abertas/", self.items[0]["url"])
        self.assertEqual(self.items[0]["published"].isoformat(), "2026-10-14")

    def test_detail(self) -> None:
        self.assertIn("Prazo de candidatura", self.detail["text"])
        labels = [label for label, _ in self.detail["attachments"]]
        self.assertIn("Aviso Integral", labels)

    def test_payload(self) -> None:
        job = _to_payload(self.items[0], self.detail, SesaramScraper.slug)
        self.assertEqual(job.company, "SESARAM, EPERAM")
        self.assertEqual(job.location_district, "Madeira")
        self.assertEqual(job.sector, "publico")
        self.assertEqual(job.published_at, "2026-10-14T00:00:00+00:00")
        self.assertTrue(job.application_url.endswith("_integral.pdf"))
        self.assertIn(job.application_url, job.description)
        self.assertEqual(job.title, "Técnico de Anatomia Patológica, Citológica e Tanalógica")
        self.assertGreater(len(job.description), 500)


if __name__ == "__main__":
    unittest.main()
