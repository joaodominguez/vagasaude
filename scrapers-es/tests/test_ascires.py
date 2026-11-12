import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sources.ascires import parse_date, parse_requisition  # noqa: E402


class Ascires(unittest.TestCase):
    def test_parse_clinical(self):
        job = parse_requisition({
            "requisitionId": 66, "postingEffectiveDate": "4/6/2026", "postingExpirationDate": "-",
            "displayJobTitle": "ENFERMERO/A", "locations": [{"city": "València", "country": "ES"}],
            "externalDescription": "<p>Buscamos enfermero/a</p>",
        })
        self.assertEqual((job.profession, job.location_district, job.source_id), ("Enfermería", "Comunidad Valenciana", "66"))
        self.assertIsNone(job.expires_at)

    def test_drop_non_clinical_and_foreign(self):
        self.assertIsNone(parse_requisition({"requisitionId": 1, "displayJobTitle": "COORDINADOR/A CONTABLE", "locations": []}))
        self.assertIsNone(parse_requisition({"requisitionId": 2, "displayJobTitle": "Enfermero", "locations": [{"country": "PT"}]}))
        self.assertTrue(parse_date("24/9/2026").startswith("2026-09-24"))


if __name__ == "__main__":
    unittest.main()
