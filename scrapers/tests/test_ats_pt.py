"""Testes offline dos helpers partilhados dos scrapers ATS (IVC, AniCura, ...)."""

from __future__ import annotations

import unittest

from sources import _ats_pt as ats


def _item(title: str, *addresses: tuple[str, str]) -> dict:
    return {
        "id": "uuid",
        "title": title,
        "url": "https://example.teamtailor.com/jobs/1-x",
        "date_published": "2026-10-01T10:00:00+01:00",
        "_jobposting": {
            "description": "<p>Descrição <b>completa</b></p><ul><li>Requisito</li></ul>",
            "identifier": {"value": 123},
            "jobLocation": [
                {"address": {"addressCountry": c, "addressLocality": loc}}
                for c, loc in addresses
            ],
        },
    }


class AtsPtTests(unittest.TestCase):
    def test_clinical_titles(self):
        self.assertTrue(ats.is_clinical_title("Médico Veterinário (M/F) - HV Póvoa"))
        self.assertTrue(ats.is_clinical_title("Rececionista/ Auxiliar de Veterinária"))
        self.assertTrue(ats.is_clinical_title("Veterinário Generalista - AniCura Aveiro"))
        self.assertFalse(ats.is_clinical_title("Rececionista AniCura Restelo Hospital Veterinário"))
        self.assertFalse(ats.is_clinical_title("Hospital Director - AniCura Hospital Veterinário"))
        self.assertFalse(ats.is_clinical_title("Payroll Specialist (m/f)"))

    def test_resolve_pt_place(self):
        self.assertEqual(ats.resolve_pt_place("Lisbon"), ("Lisboa", "Lisboa"))
        self.assertEqual(ats.resolve_pt_place("Alcabideche"), ("Lisboa", "Cascais"))
        self.assertEqual(ats.resolve_pt_place("Almada"), ("Setúbal", "Almada"))
        self.assertIsNone(ats.resolve_pt_place("Portugal"))

    def test_teamtailor_skips_spain(self):
        item = _item("Veterinario/a generalista", ("ES", "Madrid"))
        self.assertIsNone(ats._teamtailor_item(item, "x", "X", ats.is_clinical_title))

    def test_teamtailor_uses_pt_location(self):
        item = _item("Médico Veterinário", ("PT", "Portugal"), ("PT", "Póvoa de Varzim"))
        job = ats._teamtailor_item(item, "x", "X", ats.is_clinical_title)
        self.assertEqual(job.location_district, "Porto")
        self.assertEqual(job.location_concelho, "Póvoa de Varzim")
        self.assertEqual(job.profession, "Medicina")
        self.assertEqual(job.source_id, "123")
        self.assertIn("- Requisito", job.description)

    def test_teamtailor_generic_location_without_city_is_skipped(self):
        item = _item("Programa VetStar – Médico Veterinário Júnior", ("PT", "Portugal"))
        self.assertIsNone(ats._teamtailor_item(item, "x", "X", ats.is_clinical_title))


if __name__ == "__main__":
    unittest.main()
