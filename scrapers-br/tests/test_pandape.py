from __future__ import annotations

import os
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

import httpx

from sources import pandape
from sources.hcor import HcorScraper
from sources.pandape import (
    HapvidaPandapeScraper,
    PandapeBoardScraper,
    PandapeCache,
    format_base_salary,
    format_salary_text,
    listing_description,
    normalize_pandape_datetime,
    parse_detail_page,
    parse_listing_date,
    parse_listing_page,
    split_location,
)

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def fixture(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


class ListingParserTests(unittest.TestCase):
    def setUp(self) -> None:
        self.items, self.meta = parse_listing_page(
            fixture("pandape_listing_hapvidandi_p1.html")
        )

    def test_meta(self) -> None:
        self.assertEqual(self.meta, {"total": 1724, "is_last": False})

    def test_cards(self) -> None:
        self.assertEqual([i["id"] for i in self.items], ["3843633", "3842862", "3840202"])
        first = self.items[0]
        self.assertEqual(first["title"], "MENSAGEIRO - SÃO BERNARDO")
        self.assertEqual(first["city"], "São Bernardo do Campo")
        self.assertEqual(first["uf"], "SP")
        self.assertEqual(first["contract"], "Efetivo – CLT")
        self.assertEqual(first["schedule"], "Parcial noites")
        self.assertEqual(first["salary"], "R$ 1.700,00 - R$ 1.900,00")
        self.assertEqual(first["date_label"], "20 out")
        self.assertEqual(self.items[1]["pcd"], "Pessoa com deficiência")
        self.assertNotIn("salary", self.items[2])

    def test_empty_page(self) -> None:
        items, meta = parse_listing_page(
            '<div id="VacancyList"></div><input id="hdn_isLast" value="True" />'
        )
        self.assertEqual(items, [])
        self.assertTrue(meta["is_last"])


class DetailParserTests(unittest.TestCase):
    def test_jsonld_detail(self) -> None:
        d = parse_detail_page(fixture("pandape_detail_jsonld.html"))
        assert d is not None
        self.assertEqual(d["title"], "MENSAGEIRO - SÃO BERNARDO")
        self.assertEqual(d["city"], "São Bernardo do Campo")
        self.assertEqual(d["uf"], "SP")
        self.assertEqual(d["salary"], "R$ 1.700,00 – R$ 1.900,00 / mês")
        self.assertEqual(d["date_posted"], "2026-10-20T10:47:32-03:00")
        self.assertIsNone(d["valid_through"])
        self.assertTrue(d["description"].startswith("Descrição das atividades"))
        self.assertIn("- Transportar materiais e insumos hospitalares", d["description"])
        self.assertNotIn("#LI-Onsite", d["description"])
        self.assertEqual(d["requirements"], "Estudos: Ensino Médio (2º Grau)")

    def test_html_only_detail(self) -> None:
        d = parse_detail_page(fixture("pandape_detail_no_jsonld.html"))
        assert d is not None
        self.assertTrue(d["title"].startswith("EDITAL 1069/2026"))
        self.assertEqual((d["city"], d["uf"]), ("Barueri", "SP"))
        self.assertEqual(d["salary"], "R$ 1.799,85 / mês")
        self.assertEqual(d["contract"], "Efetivo – CLT")
        self.assertIsNone(d["date_posted"])
        self.assertGreater(len(d["description"]), 100)

    def test_closed_vacancy_page(self) -> None:
        html = '<h1 class="x">Esta vaga não está mais disponível</h1>'
        self.assertIsNone(parse_detail_page(html))


class HelperTests(unittest.TestCase):
    def test_salary_formats(self) -> None:
        base = {
            "currency": "BRL",
            "value": {"unitText": "MONTH", "minValue": 2100.0, "maxValue": 2100.0},
        }
        self.assertEqual(format_base_salary(base), "R$ 2.100,00 / mês")
        base["value"] = {"unitText": "HOUR", "minValue": 25.5}
        self.assertEqual(format_base_salary(base), "R$ 25,50 / hora")
        self.assertIsNone(format_base_salary({"currency": "BRL", "value": {"minValue": 0}}))
        self.assertEqual(format_salary_text("R$ 1.964,00  - R$ 1.965,00"), "R$ 1.964,00 – R$ 1.965,00")
        self.assertIsNone(format_salary_text("A combinar"))

    def test_dates(self) -> None:
        self.assertEqual(normalize_pandape_datetime("2026-10-16T07:58:40.1434702"), "2026-10-16T07:58:40-03:00")
        self.assertEqual(normalize_pandape_datetime("2026-11-30T00:00:00Z"), "2026-11-30T00:00:00+00:00")
        self.assertIsNone(normalize_pandape_datetime(None))
        today = date(2026, 1, 10)
        self.assertEqual(parse_listing_date("05 jan", today), "2026-01-05")
        self.assertEqual(parse_listing_date("20 dez", today), "2025-12-20")
        self.assertIsNone(parse_listing_date("ontem", today))

    def test_location(self) -> None:
        self.assertEqual(split_location("Viamão - RS"), ("Viamão", "RS"))
        self.assertEqual(split_location("Remoto"), ("Remoto", None))
        self.assertEqual(split_location(""), (None, None))

    def test_listing_description_long_enough(self) -> None:
        items, _ = parse_listing_page(fixture("pandape_listing_hapvidandi_p1.html"))
        text = listing_description(items[2])
        self.assertGreaterEqual(len(text), 40)  # < 40 → pending_review na app
        self.assertIn("Local: Teresina - PI", text)

    def test_source_ids(self) -> None:
        self.assertEqual(HapvidaPandapeScraper().source_id("hapvidandi", "123"), "hapvidandi-123")
        self.assertEqual(HcorScraper().source_id("hcor", "123"), "123")  # legado HCor


class FakeClient:
    """Responde a URLs Pandapé a partir de um dict {url: html|status}."""

    def __init__(self, pages: dict[str, object], **_kw: object) -> None:
        self.pages = pages
        self.calls: list[str] = []

    def get_text(self, url: str) -> str:
        self.calls.append(url)
        page = self.pages.get(url, 404)
        if isinstance(page, int):
            req = httpx.Request("GET", url)
            raise httpx.HTTPStatusError("x", request=req, response=httpx.Response(page, request=req))
        return page  # type: ignore[return-value]

    def close(self) -> None:
        pass


def _card(job_id: str, title: str, loc: str = "Curitiba - PR") -> str:
    return (
        f'<a class="card card-vacancy" href="/Detail/{job_id}"><h3 class="link" title="{title}">{title}</h3>'
        f'<div class="vacancy-detail"><div class="d-flex"><div class="align-middle">'
        f'<div class="icon-container"><i class="icon icon-location-pin-1"></i></div>{loc}</div>'
        f'<div class="align-middle"><div class="icon-container"><i class="icon icon-sheet"></i></div>Efetivo – CLT</div>'
        f'</div><div class="vacancy-date">10 out</div></div></a>'
    )


def _page(cards: list[str], last: bool) -> str:
    return (
        f'<span id="subTotal">3</span><div id="VacancyList">{"".join(cards)}</div>'
        f'<input id="hdn_isLast" value="{"True" if last else "False"}" />'
    )


class TwoBoards(PandapeBoardScraper):
    slug = "test_pandape"
    name = "test"
    filter_mode = "hospital"
    BOARDS = [("alfa", "Alfa", "ipss"), ("beta", "Beta", "privado")]


class FetchFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.env = mock.patch.dict(
            os.environ,
            {
                "PANDAPE_DETAIL_CACHE": str(Path(self.tmp.name) / "c.json"),
                "PANDAPE_MAX_DETAILS": "1",
            },
        )
        self.env.start()
        detail = fixture("pandape_detail_no_jsonld.html")
        self.pages: dict[str, object] = {
            "https://alfa.pandape.infojobs.com.br/?PageNumber=1": _page(
                [_card("1", "Enfermeiro UTI"), _card("2", "Desenvolvedor Java")], False
            ),
            "https://alfa.pandape.infojobs.com.br/?PageNumber=2": _page(
                [_card("3", "Técnico de Enfermagem")], True
            ),
            "https://beta.pandape.infojobs.com.br/?PageNumber=1": _page(
                [_card("9", "Recepcionista", "Recife - PE")], True
            ),
            "https://alfa.pandape.infojobs.com.br/Detail/1": detail,
            "https://alfa.pandape.infojobs.com.br/Detail/3": detail,
            "https://beta.pandape.infojobs.com.br/Detail/9": detail,
        }

    def tearDown(self) -> None:
        self.env.stop()
        self.tmp.cleanup()

    def _run(self) -> tuple[list, FakeClient]:
        fake = FakeClient(self.pages)
        with mock.patch.object(pandape, "HttpClient", lambda **kw: fake):
            jobs = TwoBoards().fetch()
        return jobs, fake

    def test_cap_fallback_cache_and_snapshot(self) -> None:
        jobs, fake = self._run()
        # Desenvolvedor filtrado; 3 vagas emitidas mesmo com teto de 1 detalhe.
        self.assertEqual(sorted(j.source_id for j in jobs), ["alfa-1", "alfa-3", "beta-9"])
        detail_calls = [c for c in fake.calls if "/Detail/" in c]
        self.assertEqual(len(detail_calls), 1)
        by_id = {j.source_id: j for j in jobs}
        self.assertEqual(by_id["beta-9"].location_district, "Pernambuco")
        self.assertEqual(by_id["beta-9"].company, "Beta")
        listing_only = [j for j in jobs if j.description.startswith(j.title)]
        self.assertEqual(len(listing_only), 2)
        self.assertTrue(all(len(j.description) >= 40 for j in jobs))

        # 2.ª corrida: só busca o próximo ID novo (cache), não repete o primeiro.
        jobs2, fake2 = self._run()
        detail_calls2 = [c for c in fake2.calls if "/Detail/" in c]
        self.assertEqual(len(detail_calls2), 1)
        self.assertNotEqual(detail_calls2, detail_calls)
        self.assertEqual(len(jobs2), 3)

        # Board beta falha → snapshot evita que beta-9 desapareça (soft-expire).
        self.pages["https://beta.pandape.infojobs.com.br/?PageNumber=1"] = 503
        with mock.patch.object(pandape.time, "sleep", lambda _s: None):
            jobs3, _ = self._run()
        self.assertIn("beta-9", {j.source_id for j in jobs3})

    def test_closed_vacancy_is_dropped(self) -> None:
        self.pages["https://alfa.pandape.infojobs.com.br/Detail/1"] = 404
        os.environ["PANDAPE_MAX_DETAILS"] = "10"
        jobs, _ = self._run()
        self.assertNotIn("alfa-1", {j.source_id for j in jobs})

    def test_all_boards_down_raises(self) -> None:
        for url in list(self.pages):
            self.pages[url] = 404
        with self.assertRaises(RuntimeError):
            self._run()

    def test_unwritable_cache_is_safe(self) -> None:
        os.environ["PANDAPE_DETAIL_CACHE"] = "/proc/nonexistent/dir/c.json"
        cache = PandapeCache()
        cache.put("x:1", {"title": "t"})
        cache.save()  # não rebenta
        jobs, _ = self._run()
        self.assertEqual(len(jobs), 3)

    def test_cache_off(self) -> None:
        os.environ["PANDAPE_DETAIL_CACHE"] = "off"
        cache = PandapeCache()
        self.assertIsNone(cache.path)
        cache.put("x:1", {"title": "t"})
        cache.save()
        jobs, _ = self._run()
        self.assertEqual(len(jobs), 3)


if __name__ == "__main__":
    unittest.main()
