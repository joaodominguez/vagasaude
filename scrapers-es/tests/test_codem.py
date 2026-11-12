import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sources.codem import build_job, parse_detail, parse_listing  # noqa: E402

LISTING = """<ul id="ctl00_ch_ulResultados" class="pagina0"><li><span class="Fecha">12/11/2026</span><br/>
<a href="Canales/Ficha.aspx?IdMenu=25eb&amp;Cod=0CE9BF7D-6852&amp;Idioma=es-ES">Coordinador/a quirófano Moncloa</a></li></ul>"""
DETAIL = """<div class="CanalFicha">Empresa: Talentia Salud
<br />Puesto requerido:&nbsp;Enfermera/o Generalista
<br />Lugar físico del centro de trabajo: Moncloa
<br />Duración del contrato: Indefinido
<br />Jornada laboral: Completa 40h.
<br />Persona contacto: Ana
<br />Teléfono: 600000000
<br />Email: a@b.com
<br /></div>"""


class Codem(unittest.TestCase):
    def test_listing(self):
        rows = parse_listing(LISTING)
        self.assertEqual(rows, [{"id": "0ce9bf7d-6852", "title": "Coordinador/a quirófano Moncloa", "published": "2026-11-12"}])

    def test_job_without_contact_data(self):
        job = build_job(parse_listing(LISTING)[0], parse_detail(DETAIL))
        self.assertEqual((job.company, job.profession, job.location_district), ("Talentia Salud", "Enfermería", "Madrid"))
        self.assertEqual((job.contract_type, job.published_at), ("Indefinido", "2026-11-12"))
        for secret in ("600000000", "a@b.com", "Ana"):
            self.assertNotIn(secret, job.description)

    def test_barrio_salamanca_is_not_castilla(self):
        d = parse_detail(DETAIL.replace("Moncloa", "Barrio Salamanca y Torrejón de Ardoz"))
        self.assertEqual(build_job(parse_listing(LISTING)[0], d).location_district, "Madrid")


if __name__ == "__main__":
    unittest.main()
