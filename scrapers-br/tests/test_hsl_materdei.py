from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from sources import hsl_sirio
from sources.hsl_sirio import (
    HslSirioScraper,
    clean_title,
    guess_location,
    parse_feed,
)
from sources.mater_dei import MaterDeiScraper

FIXTURES = Path(__file__).resolve().parent / "fixtures"


class HslFeedTests(unittest.TestCase):
    def setUp(self) -> None:
        self.xml = (FIXTURES / "hsl_feed_sample.xml").read_bytes()

    def test_parse_feed_items(self) -> None:
        items = parse_feed(self.xml)
        self.assertEqual(len(items), 4)
        first = items[0]
        self.assertEqual(first["id"], "1334302462")
        self.assertTrue(first["link"].startswith("https://vagas.hsl.org.br/job/"))
        self.assertEqual(first["expires"], "2026-11-23")
        # descrição vem HTML-escapada no CDATA → já desescapada aqui
        self.assertIn("<p>", first["description"])

    @staticmethod
    def _detail(url: str, **_kw: object) -> str:
        if "AGENDAMENTO" in url:
            return "<p><strong>Você não pode ver a vaga porque ela não está disponível no momento.</strong></p>"
        return '<span itemprop="description">ok</span>'

    def test_fetch_builds_payloads_filters_talent_pool_and_closed(self) -> None:
        scraper = HslSirioScraper()
        with mock.patch.object(
            hsl_sirio.HttpClient, "get_bytes", return_value=self.xml
        ), mock.patch.object(hsl_sirio.HttpClient, "get_text", side_effect=self._detail):
            jobs = scraper.fetch()
        titles = [j.title for j in jobs]
        self.assertNotIn("Mecânico de Refrigeração - Banco de Talentos", titles)
        self.assertNotIn("ENFERMEIRO PL AGENDAMENTO CIRÚRGICO", titles)  # fechada
        self.assertEqual(len(jobs), 2)
        enf = jobs[0]
        self.assertEqual(enf.title, "Enfermeiro Clinico Oncologia")
        self.assertEqual(enf.company, "Hospital Sírio-Libanês")
        self.assertEqual(enf.location_district, "Distrito Federal")
        self.assertEqual(enf.location_concelho, "Brasília")
        self.assertEqual(enf.profession, "Enfermagem")
        self.assertEqual(enf.source, "hsl_sirio")
        self.assertNotIn("&lt;", enf.description)
        self.assertGreater(len(enf.description), 200)

    def test_detail_error_keeps_job(self) -> None:
        with mock.patch.object(
            hsl_sirio.HttpClient, "get_bytes", return_value=self.xml
        ), mock.patch.object(
            hsl_sirio.HttpClient, "get_text", side_effect=RuntimeError("timeout")
        ):
            jobs = HslSirioScraper().fetch()
        self.assertEqual(len(jobs), 3)

    def test_all_closed_raises(self) -> None:
        closed = "não está disponível no momento"
        with mock.patch.object(
            hsl_sirio.HttpClient, "get_bytes", return_value=self.xml
        ), mock.patch.object(hsl_sirio.HttpClient, "get_text", return_value=closed):
            with self.assertRaises(RuntimeError):
                HslSirioScraper().fetch()

    def test_feed_errors_raise(self) -> None:
        with self.assertRaises(RuntimeError):
            parse_feed(b"<html><body>Attention Required! | Cloudflare</body></html>")
        with self.assertRaises(RuntimeError):
            parse_feed(b'<?xml version="1.0"?><rss><channel><title>x</title></channel></rss>')
        with self.assertRaises(RuntimeError):
            parse_feed(b"not xml at all")

    def test_clean_title(self) -> None:
        cases = {
            "Enfermeiro Clinico Oncologia - Brasília/ DF (BR)": "Enfermeiro Clinico Oncologia",
            "Técnico(a) de Enfermagem PL -Tomografia / Brasília-DF (BR)": "Técnico(a) de Enfermagem PL -Tomografia",
            "Analista de Eventos Sênior - São Paulo - SP (Vaga Afirmativa) (BR)": "Analista de Eventos Sênior (Vaga Afirmativa)",
            "Pesquisador I - Bela Vista / São Paulo - SP (BR)": "Pesquisador I",
            "Enfermeiro Pleno - UTI Pediátrica | Unidade Bela Vista/SP (BR)": "Enfermeiro Pleno - UTI Pediátrica",
            "ENFERMEIRO PL (BR)": "ENFERMEIRO PL",
        }
        for raw, expected in cases.items():
            self.assertEqual(clean_title(raw), expected, raw)

    def test_guess_location(self) -> None:
        self.assertEqual(guess_location("Biomédico - Brasília/DF (BR)"), ("Brasília", "DF"))
        self.assertEqual(
            guess_location("Farmacêutico Pleno - Foco em APS - Salvador/BA (BR)"),
            ("Salvador", "BA"),
        )
        self.assertEqual(
            guess_location("Assistente de Atendimento Pleno - Rio de Janeiro/RJ (BR)"),
            ("Rio de Janeiro", "RJ"),
        )
        self.assertEqual(guess_location("TEC. ENFERMAGEM PL (BR)"), ("São Paulo", "SP"))
        self.assertEqual(guess_location("ESP. PRATICAS ASSISTENCIAIS (BR)"), ("São Paulo", "SP"))


class MaterDeiTests(unittest.TestCase):
    def test_config(self) -> None:
        s = MaterDeiScraper()
        self.assertEqual(s.slug, "mater_dei")
        self.assertEqual(s.BOARDS, [("hospitalmaterdei", "Rede Mater Dei de Saúde", "privado")])
        self.assertEqual(s.source_id("hospitalmaterdei", "123"), "hospitalmaterdei-123")

    def test_empty_listing_raises(self) -> None:
        empty = '<html><div id="VacancyList"></div><input id="hdn_isLast" value="True"></html>'
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(
            os.environ, {"PANDAPE_DETAIL_CACHE": str(Path(tmp) / "c.json")}
        ), mock.patch.object(MaterDeiScraper, "_get_with_retry", return_value=empty):
            with self.assertRaises(RuntimeError):
                MaterDeiScraper().fetch()


if __name__ == "__main__":
    unittest.main()
