"""Testes offline do parser de detalhe IEFP."""

from __future__ import annotations

import unittest
from pathlib import Path

from sources.iefp import (
    _compose_description,
    _contract_from_fields,
    _labeled_fields,
    _requirements_from_fields,
    _salary_from_fields,
    _vacancies,
)


SAMPLE = Path("/tmp/iefp-589445252.html")


@unittest.skipUnless(SAMPLE.exists(), "HTML de amostra IEFP em falta")
class IefpDetailParseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.html = SAMPLE.read_text(encoding="utf-8", errors="replace")
        cls.fields = _labeled_fields(cls.html)

    def test_labeled_core_fields(self) -> None:
        self.assertEqual(self.fields.get("Tipo de contrato"), "Sem termo")
        self.assertEqual(self.fields.get("Regime de trabalho"), "A tempo completo")
        self.assertEqual(self.fields.get("Habilitações Mínimas"), "Licenciatura")
        self.assertIn("1499", self.fields.get("Remuneração base ilíquida", ""))

    def test_contract_salary_requirements(self) -> None:
        self.assertIn("Sem termo", _contract_from_fields(self.fields) or "")
        self.assertEqual(_salary_from_fields(self.fields), "1499.15 €/mês")
        req = _requirements_from_fields(self.fields) or ""
        self.assertIn("Habilitações Mínimas: Licenciatura", req)
        self.assertIn("Carta de condução: Ligeiros", req)
        self.assertIn("Início previsto: 2026-10-01", req)

    def test_description_includes_offered(self) -> None:
        desc = _compose_description(
            "Perfil de enfermagem.",
            self.fields,
            _vacancies(self.html),
        )
        self.assertIn("Perfil de enfermagem.", desc)
        self.assertIn("Condições oferecidas:", desc)
        self.assertIn("Tipo de contrato: Sem termo", desc)
        self.assertIn("N.º de vagas: 1", desc)


if __name__ == "__main__":
    unittest.main()
