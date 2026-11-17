import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sources import SCRAPERS, _sf_es  # noqa: E402
from sources.ilunion import _EXCLUDE_RE, clean_title  # noqa: E402
from sources.impress import city_from_title  # noqa: E402

FIX = Path(__file__).resolve().parent / "fixtures"


class Registry(unittest.TestCase):
    def test_new_sources_registered(self):
        for slug in ("imed", "vetpartners", "impress", "ilunion"):
            self.assertIn(slug, SCRAPERS)
            self.assertEqual(SCRAPERS[slug].slug, slug)


class IlunionTiles(unittest.TestCase):
    def test_tile_listing(self):
        rows, total = _sf_es.parse_listing((FIX / "sf_tiles_ilunion.html").read_text())
        self.assertEqual(total, 452)
        self.assertEqual(len(rows), 4)
        self.assertEqual(rows[1]["path"], "/job/Toledo-Fisioterapeuta/1375000002/")
        self.assertEqual(rows[1]["location"], "Toledo")
        self.assertEqual(rows[1]["date"], "15 nov 2026")

    def test_health_filter_and_fields(self):
        rows, _ = _sf_es.parse_listing((FIX / "sf_tiles_ilunion.html").read_text())
        jobs = [
            _sf_es.build_job(r, "https://empleo.ilunion.com", "ilunion", "Ilunion", clean_title=clean_title, exclude_re=_EXCLUDE_RE)
            for r in rows
        ]
        # teleoperador (aseguradora médica) y vigilante descartados
        self.assertEqual([bool(j) for j in jobs], [True, True, False, False])
        self.assertEqual(jobs[0].title, "Enfermeria Residencia Parla")
        self.assertEqual(jobs[0].location_district, "Madrid")
        self.assertEqual(jobs[0].profession, "Enfermería")
        self.assertEqual(jobs[0].source_id, "1375000001")
        self.assertEqual(jobs[1].title, "Fisioterapeuta Residencia Sonseca (Toledo)")
        self.assertEqual(jobs[1].location_district, "Castilla-La Mancha")
        self.assertEqual(jobs[1].location_concelho, "Toledo")
        self.assertEqual(jobs[1].profession, "Fisioterapia")
        self.assertEqual(jobs[1].published_at, "2026-11-15T00:00:00+00:00")

    def test_clean_title(self):
        self.assertEqual(clean_title("ILUNION VidaSénior - Auxiliar de enfermería con/sin discapacidad (H/M/D) Residencia La Solana"),
                         "Auxiliar de enfermería Residencia La Solana")
        self.assertEqual(clean_title("ILUNION VidaSénior - Enfermero/a con/sin discapacidad (La Solana,Ciudad Real)"),
                         "Enfermero/a (La Solana, Ciudad Real)")

    def test_table_listing_still_uses_table_parser(self):
        rows, total = _sf_es.parse_listing((FIX / "sf_listing.html").read_text())
        self.assertEqual(total, 5)
        self.assertEqual(len(rows), 5)


class ImpressCity(unittest.TestCase):
    def test_city_from_title(self):
        self.assertEqual(city_from_title("Auxiliar Dental - Toledo 21 H"), "Toledo")
        self.assertEqual(city_from_title("Ortodoncista - Valladolid - 26h"), "Valladolid")
        self.assertIsNone(city_from_title("Ortodoncista"))
        self.assertIsNone(city_from_title("Auxiliar dental - 16 Horas"))


if __name__ == "__main__":
    unittest.main()
