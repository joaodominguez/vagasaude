import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sources.ics import build, parse_listing, short_title  # noqa: E402

HTML = """
<h2 class="subtitle">Gerència Territorial Girona</h2>
<div class="blocs"><h2 class="basic_title">Oferta d’un lloc de Facultatiu/va especialista en Pediatria</h2>
  <ul><li><a href="/web/.content/Seleccio/oferta-pediatria.pdf">Oferta d’un lloc de Facultatiu/va especialista en Pediatria</a></li></ul></div>
<div class="blocs"><h2 class="basic_title">Convocatòria per a la selecció d’un/a Infermer/a clínic/a de cronicitat (Ref. GAP-INF-3/2026)</h2>
  <ul><li><a href="/web/.content/Seleccio/inf.pdf">Convocatòria</a></li>
      <li><a href="/web/.content/Seleccio/inf-dil.pdf">Diligència provisional d'admesos i exclosos</a></li></ul></div>
<h2 class="subtitle">Centre Corporatiu</h2>
<div class="blocs"><h2 class="basic_title">Convocatòria per a la selecció d'un/a Tècnic/a de contractació administrativa. Ref. USIP-41/2026</h2>
  <ul><li><a href="/web/.content/Seleccio/ctr.pdf">Convocatòria</a></li></ul></div>
"""


class Ics(unittest.TestCase):
    def test_parse_and_build(self):
        rows = parse_listing(HTML)
        self.assertEqual(len(rows), 3)
        self.assertTrue(rows[1]["closed"])  # diligència publicada: plazo cerrado
        jobs = [j for j in (build(r) for r in rows) if j]
        self.assertEqual(len(jobs), 1)  # cerrada y no sanitaria descartadas
        job = jobs[0]
        self.assertEqual((job.profession, job.location_district, job.sector, job.contract_type),
                         ("Medicina", "Cataluña", "publico", "Temporal"))
        self.assertTrue(job.title.startswith("Facultatiu/va especialista en Pediatria"))
        self.assertTrue(job.application_url.startswith("https://ics.gencat.cat/web/.content/"))
        self.assertTrue(job.source_id.startswith("ics-"))

    def test_short_title_keeps_referents(self):
        self.assertEqual(short_title("Convocatòria per a la Selecció de cinc Facultatius/ives referents en Cronicitat Complexa"),
                         "Facultatius/ives referents en Cronicitat Complexa")
        self.assertEqual(short_title("Convocatòria per a la selecció d'un/a Infermer/a de PADES. (Ref. BLL-1)"), "Infermer/a de PADES")


if __name__ == "__main__":
    unittest.main()
