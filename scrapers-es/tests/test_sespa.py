import sys
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sources.sespa import parse_jobs, parse_list, parse_pages, parse_resolution_date  # noqa: E402

BASE = "https://www.astursalud.es/noticias/-/noticias/"


def cell(title, slug):
    return f'<li class="list-cell"><a href="{BASE}{slug}"><span class="title">{title}</span></a></li>'


HTML = "<ul class=\"content-list\">" + "".join([
    cell("Resolución de 15 de octubre de 2026, de la Gerencia del Área de Salud II Centro-Suroccidente del Servicio de Salud del "
         "Principado de Asturias, por la que se convoca la cobertura temporal de una plaza de Facultativo Especialista de Área, en el Servicio de Genética", "a"),
    cell("Anuncio: Relación provisional de personas aspirantes admitidas y excluidas de la convocatoria para la cobertura temporal de una plaza de Enfermero/a", "b"),
    cell("Resolución de 4 de noviembre de 2026 de la Dirección Gerencia del Servicio de Salud del Principado de Asturias, por la que se convoca "
         "la cobertura con carácter temporal de una plaza de profesor/a en la Facultad de Enfermería de Gijón", "c"),
    cell("Resolución de 20 de octubre de 2026 de la Gerencia del Área de Salud III-Oriente del Sespa por la que se efectúa convocatoria pública "
         "para la cobertura del puesto de Jefe/a del Servicio Facultativo de Radiodiagnóstico.", "d"),
    cell("Resolución de 20 de octubre de 2026 de la Gerencia del Área de Salud II del Sespa, por la que se convoca la cobertura temporal de tres plazas de Grupo de Gestión de la Función Administrativa", "e"),
]) + "</ul>"
PAGER = '<ul class="pagination"><a href="https://x.es/c?_page=1">1</a><a href="https://x.es/c?a=1&amp;_page=2">2</a><a href="https://x.es/c?_page=3">3</a></ul>'


class Sespa(unittest.TestCase):
    def test_dates(self):
        self.assertEqual(parse_resolution_date("Resolución de 4 de noviembre de 2026 de la"), date(2026, 11, 4))
        self.assertEqual(parse_resolution_date("Resolución de 3 noviembre de 2026"), date(2026, 11, 3))
        self.assertEqual(parse_resolution_date("Resolución de 29/9/2026, de la"), date(2026, 9, 29))
        self.assertEqual(parse_resolution_date("Resolución de 27 de Agosto de 2026"), date(2026, 8, 27))

    def test_pages(self):
        self.assertEqual(parse_pages(PAGER), ["https://x.es/c?a=1&_page=2"])

    def test_jobs(self):
        entries = parse_list(HTML)
        self.assertEqual(len(entries), 4)  # el anuncio de trámite sin fecha de resolución se descarta
        jobs = parse_jobs(entries, now=datetime(2026, 11, 12, tzinfo=timezone.utc))
        titles = [j.title for j in jobs]
        # profesorado, trámites y plazas administrativas fuera; FEA temporal y jefatura clínica dentro
        self.assertEqual(len(jobs), 2, titles)
        self.assertTrue(titles[0].startswith("Contratación temporal Facultativo Especialista"))
        self.assertIn("Jefe/a de Servicio Facultativo de Radiodiagnóstico", titles[1])
        for j in jobs:
            self.assertEqual((j.sector, j.location_district, j.profession), ("publico", "Asturias", "Medicina"))
            self.assertTrue(j.source_id.startswith("sespa-"))
            self.assertTrue(j.expires_at > "2026-11-12")
        # plazo estimado ya vencido -> no se emite
        self.assertEqual(parse_jobs(entries, now=datetime(2027, 1, 1, tzinfo=timezone.utc)), [])


if __name__ == "__main__":
    unittest.main()
