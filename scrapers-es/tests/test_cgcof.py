import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sources.cgcof import GENERIC_COMPANY, build_job, nonce_from, parse_response  # noqa: E402


def row(**kw):
    base = {
        "id": 19508, "name": "NOCHES", "start_date": "2026-11-12", "end_date": "2026-12-12", "company": "Maria",
        "country_name": "España", "state_name": "Madrid", "city_name": "Madrid", "contact_email": "x@y.com",
        "description": "<p>SE BUSCA TECNICO/AUXILIAR JORNADA COMPLETA O PARCIAL, TURNO DE TARDE.</p>",
        "offered": "<p>Tipo de contrato: Indefinido<br>Tipo de jornada: Tardes</p>",
        "requirements": "<p>Experiencia mínima: </p>", "job_type_ids": [{"id": 4, "name": "Técnico"}],
    }
    base.update(kw)
    return base


TODAY = date(2026, 11, 12)


class Cgcof(unittest.TestCase):
    def test_nonce_and_response(self):
        self.assertEqual(nonce_from('<script>const nonce_empleo ="a3a41dc809"</script>'), "a3a41dc809")
        rows, total = parse_response({"total_count": "2", "data": '[{"id": 1}, {"id": 2}]'})
        self.assertEqual((len(rows), total), (2, 2))

    def test_job(self):
        job = build_job(row(), today=TODAY)
        self.assertEqual((job.profession, job.location_district, job.source_id), ("Técnico de farmacia", "Madrid", "19508"))
        self.assertEqual(job.title, "Técnico/a de farmacia (noches) - Madrid")
        self.assertEqual((job.published_at, job.expires_at, job.contract_type), ("2026-11-12", "2026-12-12", "Indefinido"))
        self.assertEqual(job.company, GENERIC_COMPANY)  # "Maria" es una persona, no se publica
        self.assertNotIn("x@y.com", job.description)
        self.assertTrue(job.application_url.endswith("/portal-de-empleo/empleo/19508/"))

    def test_business_company_kept(self):
        self.assertEqual(build_job(row(company="FARMACIA ESTEVAN"), today=TODAY).company, "Farmacia Estevan")

    def test_drops(self):
        self.assertIsNone(build_job(row(end_date="2026-11-01"), today=TODAY))
        self.assertIsNone(build_job(row(country_name="Portugal"), today=TODAY))
        self.assertIsNone(build_job(row(job_type_ids=[{"name": "Estudiante"}]), today=TODAY))
        self.assertIsNone(build_job(row(description="<p>Bolsa de candidatos, deja tu CV para futuras ofertas</p>"), today=TODAY))

    def test_adjunto_region(self):
        job = build_job(row(name="Farmacéutic@ adjunto", job_type_ids=[{"name": "Farmacéutico"}], state_name="Granada", city_name="Granada"), today=TODAY)
        self.assertEqual((job.profession, job.location_district, job.title), ("Farmacia", "Andalucía", "Farmacéutico/a adjunto/a - Granada"))


if __name__ == "__main__":
    unittest.main()


def test_clean_text_drops_contacts_and_empty_labels():
    from sources.cgcof import clean_text, is_generic_company

    text = (
        "Se necesita farmacéutico\nInteresados envien CV a jacobo.x@gmail.com\nLlamar al 666 123 456\n"
        "Tipo de contrato: <No especificado>\nExperiencia mínima:\nTipo de jornada: Tardes"
    )
    cleaned = clean_text(text)
    assert "@" not in cleaned and "666" not in cleaned and "No especificado" not in cleaned
    assert "Tipo de jornada: Tardes" in cleaned
    assert is_generic_company("Oficina de Farmacia") and is_generic_company("farmaceutico")
    assert not is_generic_company("Farmacia Tres Cantos")
