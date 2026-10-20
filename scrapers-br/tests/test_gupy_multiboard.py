from __future__ import annotations

import json
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

import httpx

from sources import gupy
from sources.gupy import (
    FarmaciasGupyScraper,
    GupyDetailCache,
    GupyScraper,
    looks_like_pharmacist_job,
)


def _next_data(page_props: dict) -> str:
    return (
        '<html><script id="__NEXT_DATA__" type="application/json">'
        + json.dumps({"props": {"pageProps": page_props}})
        + "</script></html>"
    )


def _listing_item(job_id: int, title: str) -> dict:
    return {
        "id": job_id,
        "title": title,
        "type": "vacancy_type_effective",
        "department": "Loja",
        "workplace": {
            "address": {"stateShortName": "SP", "state": "São Paulo", "city": "Campinas"}
        },
    }


class FakeClient:
    """Responde a boards/detalhes a partir de dicts; regista os URLs pedidos."""

    def __init__(self, boards: dict[str, list[dict]], failing: set[str] | None = None):
        self.boards = boards
        self.failing = failing or set()
        self.requested: list[str] = []

    def get_text(self, url: str) -> str:
        self.requested.append(url)
        sub = url.split("//", 1)[1].split(".gupy.io", 1)[0]
        if sub in self.failing:
            raise httpx.ConnectError("boom")
        if "/jobs/" in url:
            job_id = int(url.rsplit("/", 1)[1])
            item = next(j for j in self.boards[sub] if j["id"] == job_id)
            return _next_data(
                {
                    "job": {
                        "id": job_id,
                        "name": item["title"],
                        "description": "<p>Descrição completa.</p>",
                        "addressCity": "Campinas",
                        "addressStateShortName": "SP",
                    }
                }
            )
        return _next_data({"jobs": self.boards[sub]})

    def close(self) -> None:
        pass


class PharmacistFilterTests(unittest.TestCase):
    def test_keeps_pharmacists_and_technicians(self) -> None:
        for title in (
            "Farmacêutico(a) - São Paulo/SP",
            "PP Farmacêutico(a) - Centro - Florianópolis",
            "Pessoa Farmacêutica - Campo Grande",
            "Farmacêutico Substituto - Ribeirão Preto",
            "Gerente Farmacêutico Trainee DG",
            "RESP TECNICO - FARMACEUTICO RT - LAGES",
            "Encarregado Farmacêutico - Indaiatuba/SP",
            "Técnico(a) em Farmácia",
            "Técnica de Farmácia Hospitalar",
        ):
            self.assertTrue(looks_like_pharmacist_job(title), title)

    def test_excludes_store_roles(self) -> None:
        for title in (
            "Atendente de Farmácia - São Paulo",
            "Balconista de Farmácia DG",
            "Operador(a) de Caixa",
            "Estoquista",
            "Repositor",
            "Perfumista",
            "Gerente de Loja - Vila Nova",
            "Orientador(a) de Loja",
            "Estagiário Farmacêutico - Capim Macio RN",
            "Estagiário(a) em Farmácia - Campos",
            "Consultor de Vendas Perfumaria",
            "Motoboy",
            "Técnico de Enfermagem do Trabalho",
        ):
            self.assertFalse(looks_like_pharmacist_job(title), title)


class DetailCacheTests(unittest.TestCase):
    def test_roundtrip_ttl_and_title_change(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sub" / "cache.json"
            cache = GupyDetailCache(path)
            cache.put("rd", 1, {"name": "Farmacêutico", "description": "x", "junk": 1})
            cache.save()
            self.assertTrue(path.exists())

            again = GupyDetailCache(path)
            hit = again.get("rd", 1, "Farmacêutico ")
            self.assertEqual(hit, {"name": "Farmacêutico", "description": "x"})
            # Título editado no board → miss (relê detalhe).
            self.assertIsNone(again.get("rd", 1, "Farmacêutico RT"))
            self.assertIsNone(again.get("rd", 2))

            # Entradas fora do TTL são descartadas no load.
            raw = json.loads(path.read_text())
            raw["rd:1"]["t"] = int(time.time()) - gupy.DETAIL_CACHE_TTL_SECONDS - 10
            path.write_text(json.dumps(raw))
            self.assertIsNone(GupyDetailCache(path).get("rd", 1))

    def test_corrupt_or_unwritable_is_safe(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "cache.json"
            path.write_text("{not json")
            cache = GupyDetailCache(path)
            self.assertEqual(cache.entries, {})

            # Pai é um ficheiro → mkdir falha → desliga escrita sem excepção.
            blocker = Path(tmp) / "file"
            blocker.write_text("x")
            bad = GupyDetailCache(blocker / "cache.json")
            bad.put("rd", 1, {"name": "a"})
            bad.save()
            self.assertFalse(bad.writable)

    def test_env_off_disables_path(self) -> None:
        with mock.patch.dict(os.environ, {"GUPY_DETAIL_CACHE": "off"}):
            with mock.patch.object(gupy, "_detail_cache", None):
                cache = gupy.get_detail_cache()
                self.assertIsNone(cache.path)


class TwoBoardScraper(GupyScraper):
    slug = "test_multi"
    name = "Test"
    subdomain = "legacy"
    company = "Legacy"
    sector = "privado"
    filter_mode = "all"
    board_retry_delay = 0.0
    BOARDS = [
        ("legacy", "Legacy Co", "privado", ""),
        ("broken", "Broken Co", "privado", "broken"),
        ("newer", "Newer Co", "ipss", "new"),
    ]


class MultiBoardFetchTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        patcher = mock.patch.object(
            gupy, "_detail_cache", GupyDetailCache(Path(self._tmp.name) / "c.json")
        )
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self._tmp.cleanup)

    def test_failed_board_skipped_others_kept_and_legacy_ids(self) -> None:
        client = FakeClient(
            {
                "legacy": [_listing_item(10, "Enfermeiro")],
                "newer": [_listing_item(20, "Médico")],
                "broken": [],
            },
            failing={"broken"},
        )
        jobs = TwoBoardScraper()._fetch_boards(client, TwoBoardScraper.BOARDS)
        ids = {j.source_id for j in jobs}
        self.assertEqual(ids, {"10", "new:20"})
        # Board em erro foi tentado 2× (retry) e não bloqueou os outros.
        broken_hits = [u for u in client.requested if "broken" in u]
        self.assertEqual(len(broken_hits), 2)
        newer = next(j for j in jobs if j.source_id == "new:20")
        self.assertEqual(newer.company, "Newer Co")
        self.assertEqual(newer.sector, "ipss")
        self.assertEqual(newer.location_district, "São Paulo")

    def test_pharmacy_filters_before_detail_and_uses_cache(self) -> None:
        board = [
            _listing_item(1, "Farmacêutico(a) - Campinas"),
            _listing_item(2, "Atendente de Farmácia - Campinas"),
            _listing_item(3, "Balconista"),
            _listing_item(4, "Técnico em Farmácia"),
        ]
        scraper = FarmaciasGupyScraper()
        boards = [("rdsaude-farmacia", "RD Saúde (Raia Drogasil)", "privado", "rd")]

        client = FakeClient({"rdsaude-farmacia": board})
        jobs = scraper._fetch_boards(client, boards)
        self.assertEqual({j.source_id for j in jobs}, {"rd:1", "rd:4"})
        self.assertTrue(all(j.profession == "Farmácia" for j in jobs))
        self.assertIn("Descrição completa.", jobs[0].description)
        detail_urls = [u for u in client.requested if "/jobs/" in u]
        self.assertEqual(
            sorted(detail_urls),
            [
                "https://rdsaude-farmacia.gupy.io/jobs/1",
                "https://rdsaude-farmacia.gupy.io/jobs/4",
            ],
        )

        # 2.ª corrida: só a listagem — detalhes vêm da cache.
        client2 = FakeClient({"rdsaude-farmacia": board})
        jobs2 = scraper._fetch_boards(client2, boards)
        self.assertEqual(len(jobs2), 2)
        self.assertEqual(client2.requested, ["https://rdsaude-farmacia.gupy.io/"])
        self.assertIn("Descrição completa.", jobs2[0].description)


if __name__ == "__main__":
    unittest.main()
