"""Testes offline do parser das ofertas divulgadas pela Ordem dos Enfermeiros."""

from __future__ import annotations

import unittest
from datetime import date
from pathlib import Path

from common.normalize import DISTRICT_ALIASES
from sources.ordem_enfermeiros import (
    PAGE,
    OrdemEnfermeirosScraper,
    _to_payload,
    parse_ordem_enfermeiros,
)

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "ordem-enfermeiros-ofertas.html"
TODAY = date(2026, 10, 20)
VALID = set(DISTRICT_ALIASES.values()) | {"Portugal"}


class OrdemEnfermeirosParseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.items = parse_ordem_enfermeiros(FIXTURE.read_text(encoding="utf-8"), today=TODAY)

    def test_url_encoded(self) -> None:
        self.assertEqual(
            PAGE,
            "https://www.ordemenfermeiros.pt/divulga%C3%A7%C3%A3o-de-ofertas-de-emprego/",
        )

    def test_offers_parsed(self) -> None:
        self.assertGreater(len(self.items), 0)
        for item in self.items:
            self.assertIn(item["district"], VALID)
            self.assertGreater(len(item["description"]), 80)
            self.assertRegex(item["published_at"] or "", r"^\d{4}-\d{2}-\d{2}T00:00:00\+00:00$")
        # 20/08 fica fora da janela de 60 dias; cartaz só com imagem (14/10) é ignorado.
        dates = [i["published_at"][:10] for i in self.items]
        self.assertNotIn("2026-08-20", dates)
        self.assertNotIn("2026-10-14", dates)

    def test_known_offers(self) -> None:
        first = self.items[0]
        self.assertEqual(first["published_at"], "2026-10-18T00:00:00+00:00")
        self.assertEqual(first["company"], "Reabilitar em Casa")
        self.assertEqual(first["district"], "Lisboa")
        arganil = next(i for i in self.items if "Arganil" in i["company"])
        self.assertEqual(arganil["district"], "Coimbra")

    def test_cloudflare_emails_decoded(self) -> None:
        text = " ".join(i["description"] for i in self.items)
        self.assertNotIn("email protected", text)
        self.assertIn("@", text)

    def test_payload_sector(self) -> None:
        prison = next(i for i in self.items if "Prisional" in i["description"])
        job = _to_payload(prison, OrdemEnfermeirosScraper.slug)
        self.assertEqual(job.sector, "publico")
        self.assertEqual(job.location_district, "Setúbal")
        self.assertEqual(job.profession, "Enfermagem")


if __name__ == "__main__":
    unittest.main()
