"""Medicina Dentária: médicos dentistas, assistentes, higienistas e protésicos ficam juntos."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from common.normalize import guess_profession
from sources.oralmed import profession_for

DENTARIA = "Medicina Dentária"


class MedicinaDentariaTest(unittest.TestCase):
    def test_clinical_roles(self):
        for title in (
            "Médico Dentista (m/f) | Odontopediatria | Prestação de Serviços",
            "Médico(a) Dentista Generalista",
            "Médico/a Dentista - Endodontista - Clinica Aveiro",
            "Assistente Dentária (M/F)",
            "ASSISTENTE DENTÁRIO (m/f) - BARREIRO",
            "Assistente de Medicina Dentária (m/f) Porto",
            "Auxiliar de Medicina Dentária (m/f) - BRAGA",
            "Higienista Oral (m/f) | Prestação de Serviços",
            "Técnico de Prótese Dentária (m/f) - Trofa Saúde Gaia",
        ):
            self.assertEqual(guess_profession(title), DENTARIA, title)

    def test_admin_in_dental_clinic_stays_administrativo(self):
        for title in (
            "Recepcionista - Dentária (m/f/d) - Avenidas Novas",
            "Clínica Dentária: Rececionista / Assistente Administrativa (M/F)",
            "Gestor de Clientes (m/f) | Medicina Dentária | Sintra",
            "Gestor(a) de Pacientes - Medicina Dentária",
        ):
            self.assertEqual(guess_profession(title), "Administrativo", title)

    def test_unrelated_titles_unchanged(self):
        self.assertEqual(guess_profession("Médico de Medicina Geral e Familiar"), "Medicina")
        self.assertEqual(guess_profession("Auxiliar de Ação Médica"), "Auxiliares")
        self.assertEqual(guess_profession("Enfermeiro"), "Enfermagem")
        self.assertEqual(guess_profession("Accidental injury nurse"), "Enfermagem")

    def test_oralmed(self):
        self.assertEqual(profession_for("Assistência Dentária – OralMED Maia"), DENTARIA)
        self.assertEqual(profession_for("Médico Dentista – OralMED Porto"), DENTARIA)
        self.assertEqual(profession_for("Técnico de Prótese Dentária — Oralmed"), DENTARIA)
        self.assertEqual(profession_for("Receção – OralMED Faro"), "Administrativo")


if __name__ == "__main__":
    unittest.main()
