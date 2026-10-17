"""Testes offline do parser de detalhe SCML (SuccessFactors)."""

from __future__ import annotations

import unittest
from pathlib import Path

from sources.scml import _clean_title, _parse_body, parse_scml_detail

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "scml-terapeuta-fala.html"
URL = "https://recrutamento.scml.pt/job/Terapeuta-da-Fala-NQ6-NQ8-1/1371544357/"


class ScmlDetailParseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.html = FIXTURE.read_text(encoding="utf-8")
        cls.parsed = _parse_body(cls.html)
        cls.job = parse_scml_detail(
            cls.html,
            url=URL,
            path="/job/Terapeuta-da-Fala-NQ6-NQ8-1/1371544357/",
        )

    def test_labels(self) -> None:
        labels = self.parsed["labels"]
        self.assertEqual(labels.get("referencia"), "4038")
        self.assertEqual(labels.get("data_limite"), "15/09/2026")
        self.assertEqual(labels.get("concelho"), "Cascais")
        self.assertEqual(labels.get("tipo_vaga"), "Vaga temporária")
        self.assertIn("14", labels.get("carga") or "")
        self.assertIn("Alcoitão", labels.get("local") or "")

    def test_sections(self) -> None:
        sections = self.parsed["sections"]
        self.assertIn("Terapia da Fala", sections.get("requisitos") or "")
        self.assertIn("Planeamento", sections.get("competencias") or "")
        self.assertIn("Formação profissional", sections.get("oferecemos") or "")
        self.assertIn("Retribuição mensal", sections.get("remuneracao") or "")
        self.assertIn("Currículo", sections.get("documentos") or "")

    def test_job_payload(self) -> None:
        job = self.job
        assert job is not None
        self.assertEqual(job.title, "Terapeuta da Fala")
        self.assertEqual(job.location_concelho, "Cascais")
        self.assertEqual(job.location_district, "Lisboa")
        self.assertEqual(job.contract_type, "Vaga temporária · 14 horas semanais")
        self.assertEqual(job.expires_at, "2026-09-15T00:00:00+00:00")
        self.assertIn("acordos de empresa", job.salary or "")
        self.assertIn("Licenciatura", job.requirements or "")
        self.assertIn("Local de trabalho", job.description)
        self.assertIn("Documentos de candidatura", job.description)
        self.assertNotEqual(job.description, job.title)
        self.assertGreater(len(job.description), 200)

    def test_title_noise(self) -> None:
        self.assertEqual(
            _clean_title("Terapeuta da Fala-NQ6-NQ8 1"),
            "Terapeuta da Fala",
        )


if __name__ == "__main__":
    unittest.main()
