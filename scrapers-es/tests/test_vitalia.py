import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sources.vitalia import parse_detail, sitemap_urls  # noqa: E402


def page(title, region="Madrid", city="Getafe"):
    posting = {
        "@type": "JobPosting", "title": title, "description": "<p>Perfil</p>", "datePosted": "2026-11-11T01:00:00+01:00",
        "employmentType": ["FULL_TIME"], "identifier": {"value": "92932"}, "url": "https://www.vitaliahome.es/vitaliaempleo/x/",
        "validThrough": "2027-01-07T00:59:59+01:00",
        "jobLocation": {"name": "Vitalia Getafe", "address": {"addressLocality": city, "addressRegion": region, "addressCountry": "ES"}},
    }
    return f'<script type="application/ld+json">{json.dumps({"@graph": [{"@type": "Organization"}, posting]})}</script>'


class Vitalia(unittest.TestCase):
    def test_graph_posting(self):
        job = parse_detail(page("Enfermero/a"), "u")
        self.assertEqual((job.profession, job.location_district, job.source_id), ("Enfermería", "Madrid", "92932"))
        self.assertEqual(job.title, "Enfermero/a - Vitalia Getafe")
        self.assertEqual((job.published_at, job.expires_at), ("2026-11-11", "2027-01-07"))

    def test_drops(self):
        self.assertIsNone(parse_detail(page("Cocinero/a"), "u"))
        self.assertIsNone(parse_detail(page("Arquitecto técnico para servicios centrales"), "u"))

    def test_sitemap(self):
        xml = "<loc>https://www.vitaliahome.es/vitaliaempleo/</loc><loc>https://www.vitaliahome.es/vitaliaempleo/a/</loc>"
        self.assertEqual(sitemap_urls(xml), ["https://www.vitaliahome.es/vitaliaempleo/a/"])


if __name__ == "__main__":
    unittest.main()
