import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sources.comb import build_job, parse_detail, parse_listing  # noqa: E402

LISTING = (
    'x\n"data": [{"Oferta":33256,"DOferta":"CIRURGIA GENERAL","OfertaUID":"abc123","CodigoError":null,"DError":null},'
    '{"Oferta":33253,"DOferta":"OFTALMOLOGIA (Mallorca)","OfertaUID":"def456","CodigoError":null,"DError":null}],\n"x"'
)


def detail(place="La Seu d'Urgell"):
    return f"""<h1>Metge/ssa especialista en Cirurgia General</h1><ul class="list-style-9">
<li style='display: block'><span>Nom del Lloc de Treball</span>Metge/ssa especialista en Cirurgia General</li>
<li style='display: block'><span>Especialitat</span>CIR.GRAL.</li>
<li style='display: block'><span>Durada</span>Indefinit</li>
<li style='display: block'><span>Ubicació Geogràfica</span>{place}</li>
<li style='display: none'><span>Idiomes</span></li>
<li style='display: block'><span>Funcions del lloc de treball</span>Activitat assistencial.<br />Guàrdies localitzables.</li></ul>"""


class Comb(unittest.TestCase):
    def test_listing(self):
        rows = parse_listing(LISTING)
        self.assertEqual([r["id"] for r in rows], ["33256", "33253"])
        self.assertEqual(rows[1]["uid"], "def456")

    def test_job(self):
        row = parse_listing(LISTING)[0]
        job = build_job(row, parse_detail(detail()))
        self.assertEqual((job.profession, job.location_district, job.source_id), ("Medicina", "Cataluña", "33256"))
        self.assertTrue(job.application_url.endswith("/ofertes/abc123"))
        self.assertIn("Guàrdies", job.description)
        self.assertEqual(job.contract_type, "Indefinido")

    def test_region_outside_catalonia(self):
        row = parse_listing(LISTING)[1]
        self.assertEqual(build_job(row, parse_detail(detail("Palma de Mallorca"))).location_district, "Islas Baleares")

    def test_no_functions(self):
        self.assertIsNone(build_job({"id": "1", "uid": "u", "specialty": "X"}, {"h1": "T", "fields": {}}))


if __name__ == "__main__":
    unittest.main()
