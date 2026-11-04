import json
import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from common.models import JobPayload  # noqa: E402
from sources import _private_es, _sf_es  # noqa: E402
from sources._private_es import fetch_teamtailor_private, is_health_role, region_with_fallback  # noqa: E402
from sources.affidea import parse_offer  # noqa: E402
from sources.domusvi import build_job as domusvi_build, parse_detail, parse_listing as domusvi_listing  # noqa: E402

FIX = Path(__file__).resolve().parent / "fixtures"


class PrivateHelpers(unittest.TestCase):
    def test_health_role_filters_false_positives(self):
        self.assertTrue(is_health_role("Gerocultor/a - Auxiliar de enfermería"))
        self.assertTrue(is_health_role("Fisioterapeuta 50% JORNADA LLEIDA"))
        self.assertFalse(is_health_role("Limpiador/a. Laboratorios Celrà"))
        self.assertFalse(is_health_role("Asesor/a Vithas Partner (Comercial Veterinaria) VIGO"))
        self.assertFalse(is_health_role("Recepcionista Centro Residencial"))

    def test_region_fallback_uses_ine_municipios(self):
        self.assertEqual(region_with_fallback("Calp", None), "Comunidad Valenciana")
        self.assertEqual(region_with_fallback("El Campello", None), "Comunidad Valenciana")
        self.assertEqual(region_with_fallback("Puig-reig", None), "Cataluña")
        self.assertEqual(region_with_fallback("Sant Vicent del Raspeig/San Vicente del Raspeig", None), "Comunidad Valenciana")
        self.assertEqual(region_with_fallback(None, None, "35100"), "Canarias")
        self.assertEqual(region_with_fallback("Pueblo Inventado", None), "España")

    def test_teamtailor_private_sector_and_default_region(self):
        def job(title, district, city=None):
            return JobPayload(title=title, company="X", location_district=district, location_concelho=city,
                              profession="Enfermería", specialty=None, sector="privado", contract_type=None,
                              description="d", requirements=None, salary=None, application_url="u",
                              source="s", source_id=title, published_at=None)

        fake = ([job("Enfermero/a Hospital", "España"), job("Técnico de Limpieza", "España"), job("Médico/a", "Madrid")], True)
        with mock.patch("sources._teamtailor_es.fetch_teamtailor_es", return_value=fake):
            jobs, complete = fetch_teamtailor_private("https://x", "s", "X", sector="concertado", default_region="País Vasco")
        self.assertTrue(complete)
        self.assertEqual([j.title for j in jobs], ["Enfermero/a Hospital", "Médico/a"])
        self.assertEqual([j.location_district for j in jobs], ["País Vasco", "Madrid"])
        self.assertTrue(all(j.sector == "concertado" for j in jobs))


class SuccessFactors(unittest.TestCase):
    def test_parse_date_and_location(self):
        self.assertEqual(_sf_es.parse_date("4 nov 2026"), "2026-11-04T00:00:00+00:00")
        self.assertEqual(_sf_es.parse_date("15 sept 2026"), "2026-09-15T00:00:00+00:00")
        self.assertEqual(_sf_es.parse_location("Arnedo, La Rioja , España, 28580"), ("Arnedo", "La Rioja", "28580", True))
        self.assertEqual(_sf_es.parse_location("Lleida, ES")[0:2], ("Lleida", None))
        self.assertFalse(_sf_es.parse_location("Lisboa, Portugal")[3])

    def test_listing_to_jobs(self):
        rows, total = _sf_es.parse_listing((FIX / "sf_listing.html").read_text())
        self.assertEqual(total, 5)
        self.assertEqual(len(rows), 5)
        jobs = [_sf_es.build_job(r, "https://canaldeempleo.es", "clece", "Clece") for r in rows]
        # limpiador y Portugal descartados
        self.assertEqual([bool(j) for j in jobs], [True, True, False, False, True])
        self.assertEqual(jobs[0].location_district, "La Rioja")
        self.assertEqual(jobs[0].profession, "TCAE")
        self.assertEqual(jobs[0].source_id, "1358138157")
        self.assertEqual(jobs[0].published_at, "2026-11-04T00:00:00+00:00")
        self.assertTrue(jobs[0].application_url.startswith("https://canaldeempleo.es/CLECE/job/"))
        self.assertEqual(jobs[1].location_district, "Andalucía")
        self.assertEqual(jobs[4].location_district, "Castilla y León")

    def test_detail_description(self):
        text = _sf_es.parse_description((FIX / "sf_detail.html").read_text())
        self.assertIn("Residencia de Mayores de Arnedo", text)
        self.assertIn("Turnos rotativos", text)


class Domusvi(unittest.TestCase):
    def test_listing_and_job(self):
        rows = domusvi_listing((FIX / "domusvi_listing.html").read_text())
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[1]["city"], "Calp")
        jobs = [domusvi_build(r) for r in rows]
        self.assertIsNone(jobs[2])  # recepcionista
        self.assertEqual(jobs[0].location_district, "Comunidad Valenciana")
        self.assertEqual(jobs[0].profession, "Enfermería")
        self.assertEqual(jobs[1].profession, "TCAE")
        self.assertEqual(jobs[1].location_district, "Comunidad Valenciana")
        self.assertEqual(jobs[0].source_id, "dd310321-df50-4f5f-8bf9-0b4ab9c45d4e")

    def test_detail(self):
        from datetime import datetime, timezone
        description, published = parse_detail((FIX / "domusvi_detail.html").read_text(),
                                              today=datetime(2026, 11, 5, tzinfo=timezone.utc))
        self.assertIn("administración de medicamentos", description)
        self.assertEqual(published, "2026-11-04T00:00:00+00:00")
        # 'Publicada 4 de Noviembre' visto en enero -> año anterior
        _, published = parse_detail((FIX / "domusvi_detail.html").read_text(),
                                    today=datetime(2027, 1, 10, tzinfo=timezone.utc))
        self.assertEqual(published, "2026-11-04T00:00:00+00:00")


class Affidea(unittest.TestCase):
    def test_offers(self):
        offers = json.loads((FIX / "recruitee_affidea.json").read_text())["offers"]
        jobs = [parse_offer(o) for o in offers]
        self.assertIsNone(jobs[2])  # Portugal
        self.assertIsNone(jobs[3])  # no sanitario
        self.assertEqual(jobs[0].title, "Radiólogo/a - Presencial centros Murcia")
        self.assertEqual(jobs[0].location_district, "Murcia")
        self.assertEqual(jobs[0].published_at, "2025-09-30T11:26:09+00:00")
        self.assertEqual(jobs[0].requirements, "- Especialidad MIR")
        # especialidad suelta que el normalizador no entiende -> Medicina por categoría
        self.assertEqual(jobs[1].profession, "Medicina")
        self.assertEqual(jobs[1].location_district, "Madrid")
        self.assertEqual(jobs[1].contract_type, "Indefinido")


if __name__ == "__main__":
    unittest.main()
