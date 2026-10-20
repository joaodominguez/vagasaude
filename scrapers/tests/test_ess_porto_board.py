"""Testes offline do parser das ofertas de emprego da ESS P.Porto."""

from __future__ import annotations

import unittest
from datetime import date
from pathlib import Path

from common.normalize import DISTRICT_ALIASES
from sources.ess_porto import EssPortoScraper, _to_payload, parse_ess_porto

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "ess-porto-ofertas.html"
TODAY = date(2026, 10, 20)
VALID = set(DISTRICT_ALIASES.values()) | {"Portugal"}


class EssPortoParseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.items = parse_ess_porto(FIXTURE.read_text(encoding="utf-8"), today=TODAY)

    def test_offers_parsed(self) -> None:
        self.assertGreater(len(self.items), 0)
        for item in self.items:
            self.assertIn(item["district"], VALID)
            self.assertGreater(len(item["description"]), 80)
            self.assertRegex(item["published_at"] or "", r"^\d{4}-\d{2}-\d{2}T00:00:00\+00:00$")
            self.assertNotIn("publicado a", item["description"].split("\n\n", 2)[-1].lower()[:40])

    def test_employer_and_place(self) -> None:
        by_company = {i["company"]: i for i in self.items}
        landim = by_company["Farmácia de Landim"]
        self.assertEqual(landim["district"], "Braga")
        self.assertEqual(landim["title"], "Técnico(a) de Farmácia — Vila Nova de Famalicão")
        matos = by_company["Farmácia Matos Vieira"]
        self.assertEqual(matos["district"], "Braga")
        self.assertTrue(matos["title"].startswith("Técnico de Farmácia"))
        self.assertIn("Associação Tempos Brilhantes", by_company)

    def test_skips_abroad(self) -> None:
        text = " ".join(i["description"] for i in self.items)
        self.assertNotIn("Paris", text)

    def test_payload(self) -> None:
        job = _to_payload(self.items[0], EssPortoScraper.slug)
        self.assertEqual(job.source, "ess_porto")
        self.assertEqual(job.sector, "ipss")  # IRIS – IPSS
        self.assertEqual(job.published_at, "2026-10-19T00:00:00+00:00")


if __name__ == "__main__":
    unittest.main()
