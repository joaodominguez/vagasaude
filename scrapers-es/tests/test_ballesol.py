import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sources.ballesol import parse_detail, sitemap_urls  # noqa: E402


def page(title, country="ES"):
    posting = {
        "@type": "JobPosting", "title": title, "description": "<p>Descripción</p>", "datePosted": "2026-09-01",
        "jobLocation": {"address": {"addressLocality": "Reus", "addressRegion": "Tarragona", "addressCountry": country}},
        "identifier": {"value": "abc123"}, "url": "https://empleo.ballesol.es/x/",
    }
    return f'<script type="application/ld+json">{json.dumps(posting)}</script>'


class Ballesol(unittest.TestCase):
    def test_clinical(self):
        job = parse_detail(page("DUE - ENFERMERO/A CENTRO RESIDENCIAL (BALLESOL REUS)"), "https://empleo.ballesol.es/x/")
        self.assertEqual((job.profession, job.location_district, job.source_id), ("Enfermería", "Cataluña", "abc123"))

    def test_gerocultor_and_drops(self):
        self.assertEqual(parse_detail(page("GEROCULTOR/A CENTRO RESIDENCIAL"), "u").profession, "TCAE")
        self.assertIsNone(parse_detail(page("PERSONAL DE LIMPIEZA CENTRO RESIDENCIAL"), "u"))
        self.assertIsNone(parse_detail(page("Enfermero/a", country="PT"), "u"))
        self.assertIsNone(parse_detail(page("Candidatura espontánea"), "u"))

    def test_sitemap(self):
        xml = "<loc>https://empleo.ballesol.es/</loc><loc>https://empleo.ballesol.es/a-1/</loc>"
        self.assertEqual(sitemap_urls(xml), ["https://empleo.ballesol.es/a-1/"])


if __name__ == "__main__":
    unittest.main()
