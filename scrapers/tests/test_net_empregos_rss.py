"""Smoke tests for Net-Empregos RSS query helpers."""

from __future__ import annotations

import unittest
from unittest import mock

from sources import net_empregos as ne


SAMPLE_ITEM = """
<item>
<title><![CDATA[Enfermeiro(a) Cuidados Gerais Lisboa]]></title>
<link>https://www.net-empregos.com/16009999/enfermeiro-a-cuidados-gerais-lisboa/</link>
<description><![CDATA[
<b>Empresa:</b> Clínica Exemplo<br>
<b>Zona:</b> Lisboa<br>
<b>Categoria:</b> Saúde / Medicina / Enfermagem<br>
<b>Data:</b> 17-9-2026<br>
<b>Descrição:</b> Prestação de cuidados de enfermagem em contexto hospitalar.
]]></description>
</item>
"""

NOISE_ITEM = """
<item>
<title><![CDATA[Empregado de Mesa]]></title>
<link>https://www.net-empregos.com/16008888/empregado-de-mesa/</link>
<description><![CDATA[
<b>Empresa:</b> Restaurante X<br>
<b>Zona:</b> Porto<br>
<b>Categoria:</b> Restauração / Bares / Pastelarias<br>
<b>Data:</b> 17-9-2026<br>
]]></description>
</item>
"""


class NetEmpregosRssTests(unittest.TestCase):
    def test_rss_queries_keep_only_health_category(self):
        payload = (
            '<?xml version="1.0"?><rss><channel>'
            + SAMPLE_ITEM
            + NOISE_ITEM
            + "</channel></rss>"
        ).encode("iso-8859-1")

        fake = mock.Mock()
        fake.content = payload
        fake.raise_for_status = mock.Mock()

        with mock.patch("sources.net_empregos.httpx.get", return_value=fake):
            # Uma query basta — o mock devolve o mesmo XML.
            with mock.patch.object(ne, "RSS_QUERIES", ["enfermeiro"]):
                by_id = ne._fetch_rss_health_by_queries()

        self.assertIn("16009999", by_id)
        self.assertNotIn("16008888", by_id)
        self.assertIn("Enfermeiro", by_id["16009999"]["title"])

    def test_listings_complete_flag(self):
        scraper = ne.NetEmpregosScraper()
        with mock.patch.object(scraper, "_fetch_html_listings", return_value=[]):
            with mock.patch(
                "sources.net_empregos._fetch_rss_health_by_queries",
                return_value={},
            ):
                jobs = scraper.fetch()
        self.assertEqual(jobs, [])
        self.assertFalse(scraper.last_listings_complete)


if __name__ == "__main__":
    unittest.main()
