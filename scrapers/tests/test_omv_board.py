"""Testes offline do parser da Bolsa de Emprego da OMV."""

from __future__ import annotations

import unittest
from datetime import date
from pathlib import Path

from common.normalize import DISTRICT_ALIASES
from sources.omv import OmvScraper, _to_payload, parse_omv

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "omv-bolsa-emprego.html"
TODAY = date(2026, 10, 20)
VALID = set(DISTRICT_ALIASES.values()) | {"Portugal"}


class OmvParseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.items = parse_omv(FIXTURE.read_text(encoding="utf-8"), today=TODAY)

    def test_offers_parsed(self) -> None:
        self.assertGreater(len(self.items), 0)
        for item in self.items:
            self.assertIn(item["district"], VALID)
            self.assertGreater(len(item["description"]), 80)
            self.assertRegex(item["published_at"] or "", r"^\d{4}-\d{2}-\d{2}T00:00:00\+00:00$")
            self.assertTrue(item["application_url"].startswith("https://www.omv.pt/bolsa-de-emprego"))

    def test_first_offer(self) -> None:
        first = self.items[0]
        self.assertIn("VALE DAS FLORES", first["title"])
        self.assertEqual(first["district"], "Coimbra")
        self.assertEqual(first["company"], "Centro Veterinário Vale das Flores")
        self.assertEqual(first["published_at"], "2026-10-19T00:00:00+00:00")
        self.assertIn("Candidaturas", first["description"])

    def test_filters_abroad_and_old(self) -> None:
        titles = " ".join(i["title"] for i in self.items).lower()
        self.assertNotIn("madrid", titles)
        self.assertNotIn("irlanda", titles)
        cutoff = "2026-08-21"
        self.assertTrue(all(i["published_at"][:10] >= cutoff for i in self.items))

    def test_source_ids_unique(self) -> None:
        ids = [i["source_id"] for i in self.items]
        self.assertEqual(len(ids), len(set(ids)))

    def test_payload(self) -> None:
        job = _to_payload(self.items[1], OmvScraper.slug)
        self.assertEqual(job.source, "omv")
        self.assertEqual(job.sector, "privado")
        self.assertEqual(job.location_district, "Porto")
        self.assertIn("Maia", job.company)


if __name__ == "__main__":
    unittest.main()
