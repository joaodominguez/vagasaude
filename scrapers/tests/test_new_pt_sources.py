"""Testes offline dos parsers Fresenius, DomusVi, SYNLAB e Unisana (HTML sintético)."""

from __future__ import annotations

import html
import json
import unittest

from sources.domusvi import parse_domusvi_jobs
from sources.fresenius import parse_fresenius_detail
from sources.synlab import parse_synlab_detail
from sources.unisana import parse_unisana_jobs


def _ld(posting: dict) -> str:
    return f'<html><script type="application/ld+json">{json.dumps(posting)}</script></html>'


class FreseniusTest(unittest.TestCase):
    def test_pt_job(self) -> None:
        page = _ld(
            {
                "@type": "JobPosting",
                "title": "Enfermeiro | Madeira - Machico",
                "description": "<p>Vencimento Base Anual, entre 21.350€ e 27.300€</p>",
                "datePosted": "2026-10-15T12:34:25+00:00",
                "validThrough": "2026-12-31T00:00:00+00:00",
                "employmentType": ["FULL_TIME"],
                "jobLocation": [
                    {
                        "address": {
                            "addressLocality": "Água de Pena",
                            "addressRegion": "Madeira",
                            "addressCountry": "PT",
                        }
                    }
                ],
            }
        )
        job = parse_fresenius_detail(page, url="https://x/pt/enfermeiro/job/ABC123")
        assert job is not None
        self.assertEqual(job.location_district, "Madeira")
        self.assertEqual(job.location_concelho, "Machico")
        self.assertEqual(job.expires_at, "2026-12-31")
        self.assertEqual(job.contract_type, "Tempo inteiro")
        self.assertEqual(job.source_id, "ABC123")
        self.assertIn("21.350€", job.salary or "")

    def test_brazil_skipped(self) -> None:
        page = _ld(
            {
                "@type": "JobPosting",
                "title": "Assistente Social",
                "jobLocation": [{"address": {"addressCountry": "BR"}}],
            }
        )
        self.assertIsNone(parse_fresenius_detail(page, url="https://x/job/1"))


class DomusviTest(unittest.TestCase):
    def test_health_filter(self) -> None:
        items = [
            {
                "id": "1",
                "Posting_Title": "Enfermeiro (m/f) - DomusVi Possolo 24",
                "City": "Vila Nova De Gaia",
                "State": "Porto",
                "Country": "Portugal",
                "Date_Opened": "2026-10-01",
                "Job_Type": "Full time",
                "Job_Description": "Responsabilidades: - Cuidar Requisitos - Licenciatura",
            },
            {
                "id": "2",
                "Posting_Title": "Ajudante de Cozinha (m/f) - DomusVi",
                "City": "Lisboa",
                "State": "Lisboa",
                "Country": "Portugal",
            },
        ]
        page = f'<input type="hidden" value="{html.escape(json.dumps(items))}" id="jobs">'
        jobs = parse_domusvi_jobs(page)
        self.assertEqual([j.source_id for j in jobs], ["1"])
        self.assertEqual(jobs[0].location_concelho, "Vila Nova de Gaia")
        self.assertIn("\n\nRequisitos:\n- Licenciatura", jobs[0].description)
        self.assertTrue(jobs[0].application_url.endswith("/1/Enfermeiro-m-f-DomusVi-Possolo-24"))


class SynlabTest(unittest.TestCase):
    def test_canonical_source_id(self) -> None:
        page = """
        <link rel="canonical" href="http://www.synlab.pt/recrutamento/tecnico-m/f-mora"/>
        <section class="recruitment-detail"><div class="recruitment-body">
        <p class="location">Mora</p><h1 class="title">Técnico (M/F) – Mora</h1>
        <div class="rich-text"><p>Intro de prestação de serviços.</p>
        <ul><p class="list-label">O que oferecemos?</p><li> Horário 40h<br /> </li></ul></div>
        </div></section>"""
        job = parse_synlab_detail(page, url="https://www.synlab.pt/recrutamento/tecnico-m/f-leiria-1")
        assert job is not None
        self.assertEqual(job.source_id, "tecnico-m-f-mora")
        self.assertEqual((job.location_district, job.location_concelho), ("Évora", "Mora"))
        self.assertIsNone(job.contract_type)
        self.assertIn("- Horário 40h", job.description)


class UnisanaTest(unittest.TestCase):
    def test_parse(self) -> None:
        page = """
        <div class="fusion-panel fusion-faq-post fusion-faq-post-15131 rh-porto">
          <span class="entry-title">Farmacêutico (M/F) &#8211; Porto</span>
          <span class="updated">2026-08-25T11:21:00+00:00</span>
          <a data-target="#collapse-1-15131" href="#collapse-1-15131">x</a>
          <div class="panel-body"><p>O <strong>Hospital da Lapa</strong> , unidade do grupo.</p></div>
        </div>
        <div class="fusion-panel fusion-faq-post fusion-faq-post-16058 rh-porto">
          <span class="entry-title">Assistente de Manutenção e Limpeza (M/F) – Porto</span>
        </div>"""
        jobs = parse_unisana_jobs(page)
        self.assertEqual(len(jobs), 1)
        job = jobs[0]
        self.assertEqual(job.company, "Hospital da Lapa")
        self.assertEqual(job.location_district, "Porto")
        self.assertEqual(job.published_at, "2026-08-25T11:21:00+00:00")
        self.assertTrue(job.application_url.endswith("#collapse-1-15131"))
        self.assertIn("Hospital da Lapa, unidade", job.description)


if __name__ == "__main__":
    unittest.main()
