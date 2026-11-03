import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.normalize import guess_contract, guess_district, guess_profession  # noqa: E402


class NormalizeEs(unittest.TestCase):
    def test_district(self):
        self.assertEqual(guess_district("Getafe", "Madrid"), "Madrid")
        self.assertEqual(guess_district("Sevilla"), "Andalucía")
        self.assertEqual(guess_district("L'Hospitalet de Llobregat"), "Cataluña")
        self.assertEqual(guess_district("Palma", "Illes Balears"), "Islas Baleares")
        self.assertEqual(guess_district("Vitoria-Gasteiz"), "País Vasco")
        self.assertEqual(guess_district("Getafe, Madrid, España"), "Madrid")
        self.assertEqual(guess_district("Napoleón"), "España")
        self.assertEqual(guess_district(None, None), "España")

    def test_profession(self):
        cases = {
            "Enfermero/a UCI": "Enfermería",
            "TCAE para residencia": "TCAE",
            "Auxiliar de enfermería": "TCAE",
            "Técnico en Cuidados Auxiliares de Enfermería": "TCAE",
            "Médico/a de familia": "Medicina",
            "Facultativo Especialista de Área Pediatría": "Medicina",
            "Fisioterapeuta": "Fisioterapia",
            "Técnico Superior en Imagen para el Diagnóstico": "Técnico sanitario",
            "Técnico de Laboratorio": "Técnico sanitario",
            "Farmacéutico adjunto": "Farmacia",
            "Técnico en Farmacia y Parafarmacia": "Técnico de farmacia",
            "Celador/a": "Celador",
            "Psicólogo/a clínico": "Psicología",
            "Dietista-Nutricionista": "Nutrición",
            "Higienista dental": "Odontología",
            "Veterinario/a clínico": "Veterinaria",
            "Trabajador/a social": "Trabajo social",
            "Delegado de información médica": "Comercial / Farma",
            "Administrativo/a": "Administrativo",
            "Responsable de calidad": "Gestión y apoyo",
            "Desarrollador web": "Otros",
        }
        for title, expected in cases.items():
            self.assertEqual(guess_profession(title), expected, title)

    def test_contract(self):
        self.assertEqual(guess_contract("Contrato indefinido, jornada completa"), "Indefinido")
        self.assertEqual(guess_contract("Interinidad"), "Temporal")
        self.assertEqual(guess_contract("Media jornada"), "Media jornada")
        self.assertIsNone(guess_contract(None))


if __name__ == "__main__":
    unittest.main()
