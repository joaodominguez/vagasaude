import json
import sys
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sources._es_common import es_profession, is_clinical, region_from  # noqa: E402
from sources._teamtailor_es import parse_item  # noqa: E402
from sources.boe import add_business_days, company_from, parse_sumario  # noqa: E402
from sources.hospiten import parse_job, sitemap_job_urls  # noqa: E402
from sources.osakidetza import parse_announcements  # noqa: E402

FIX = Path(__file__).resolve().parent / "fixtures"


class EsCommon(unittest.TestCase):
    def test_region_from_postal_fallback(self):
        self.assertEqual(region_from(None, None, "35100"), "Canarias")
        self.assertEqual(region_from("Madr", "Madr", "28660"), "Madrid")
        self.assertEqual(region_from("Melilla", None), "Melilla")
        self.assertEqual(region_from(None, None, "51001"), "Ceuta")

    def test_dental_and_clinical(self):
        self.assertEqual(es_profession("Higienista bucodental (indefinido)"), "Odontología")
        self.assertEqual(es_profession("Técnico/a Superior en Higiene Bucodental"), "Odontología")
        self.assertEqual(es_profession("Técnico/a Medio Sanitario en Cuidados Auxiliares de Enfermería"), "TCAE")
        self.assertEqual(es_profession("Técnico/a Medio Sanitario/a: Farmacia de las Instituciones Sanitarias"), "Técnico de farmacia")
        self.assertFalse(is_clinical("Pinche de cocina"))
        self.assertFalse(is_clinical("Recepcionista clínica dental"))
        self.assertTrue(is_clinical("Radiofísico/a Hospitalario/a"))


class Teamtailor(unittest.TestCase):
    def test_parse_items(self):
        items = json.loads((FIX / "teamtailor_sanitas_items.json").read_text())["items"]
        jobs = [parse_item(i, "sanitas", "Sanitas") for i in items]
        # El segundo es de Portugal -> descartado
        self.assertIsNone(jobs[1])
        self.assertEqual(jobs[0].location_district, "Cataluña")
        self.assertEqual(jobs[0].profession, "Enfermería")
        self.assertEqual(jobs[0].sector, "privado")
        self.assertEqual(jobs[2].location_district, "Islas Baleares")
        self.assertEqual(jobs[2].profession, "Odontología")
        self.assertTrue(jobs[0].source_id.isdigit())


class Boe(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((FIX / "boe_sumario_2b.json").read_text())

    def test_only_open_health_convocatorias(self):
        now = datetime(2026, 10, 10, tzinfo=timezone.utc)
        jobs = parse_sumario(self.data, date(2026, 10, 5), now=now)
        titles = [j.title for j in jobs]
        self.assertIn("Oposición: Enfermero/a", titles)
        # relación de aprobados y libre designación fuera
        self.assertFalse(any("Cardiología" in t for t in titles))
        self.assertEqual(len([j for j in jobs if j.source_id == "BOE-A-2026-20625"]), 1)
        ing = [j for j in jobs if j.source_id == "BOE-A-2026-20625"][0]
        self.assertEqual(ing.sector, "publico")
        self.assertEqual(ing.location_district, "Ceuta")
        self.assertEqual(ing.profession, "Enfermería")
        self.assertEqual(ing.expires_at[:10], "2026-11-02")  # 20 días hábiles desde 5-oct
        self.assertTrue(any(j.location_district == "País Vasco" and j.company.startswith("Osakidetza") for j in jobs))

    def test_closed_deadline_dropped(self):
        jobs = parse_sumario(self.data, date(2026, 10, 5), now=datetime(2026, 12, 1, tzinfo=timezone.utc))
        self.assertFalse(any(j.source_id == "BOE-A-2026-20625" for j in jobs))

    def test_business_days_and_company(self):
        self.assertEqual(add_business_days(date(2026, 10, 5), 5), date(2026, 10, 12))
        self.assertEqual(
            company_from("Resolución 1/2026, de 19 de mayo, de la Dirección Gerencia de la Organización Sanitaria Integrada Barrualde-Galdakao, por la que se convoca concurso.", ""),
            "Osakidetza — OSI Barrualde-Galdakao",
        )


class Hospiten(unittest.TestCase):
    def test_parse_job(self):
        page = (FIX / "hospiten_job.html").read_text()
        url = "https://jobs.hospiten.com/MDAnderson/job/Madrid-Medicoa-de-Urgencias/1370831455/"
        job = parse_job(page, url)
        self.assertEqual(job.source_id, "1370831455")
        self.assertEqual(job.location_district, "Madrid")
        self.assertEqual(job.profession, "Medicina")
        self.assertEqual(job.published_at[:10], "2026-10-07")
        self.assertEqual(job.contract_type, "Indefinido")

    def test_sitemap(self):
        xml = "<urlset><url><loc>https://jobs.hospiten.com/job/a/1/</loc></url><url><loc>https://jobs.hospiten.com/go/x/2/</loc></url></urlset>"
        self.assertEqual(sitemap_job_urls(xml), ["https://jobs.hospiten.com/job/a/1/"])


class Osakidetza(unittest.TestCase):
    TEXT = (
        "APERTURA PLAZO INSCRIPCIÓN ENFERMERÍA PEDIATRICA\n"
        "Hoy, día 6 de julio de 2026 , mediante la Resolución 1059/2026, de la Directora, se abre el plazo.\n"
        "Plazo de inscripción hasta el 27 de julio de 2026 .\n"
        "APERTURA PLAZO INSCRIPCIÓN PUESTOS FUNCIONALES OFICIAL MANTENIMIENTO\n"
        "Hoy, día 6 de julio de 2026 , mediante la Resolución 1063/2026, apertura. Más información.\n"
    )

    def test_open_only(self):
        jobs = parse_announcements(self.TEXT, now=datetime(2026, 7, 10, tzinfo=timezone.utc))
        self.assertEqual([j.source_id for j in jobs], ["res-1059-2026"])
        self.assertEqual(jobs[0].profession, "Enfermería")
        self.assertEqual(parse_announcements(self.TEXT, now=datetime(2026, 8, 1, tzinfo=timezone.utc)), [])


if __name__ == "__main__":
    unittest.main()
