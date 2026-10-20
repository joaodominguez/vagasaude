"""Testes offline dos scrapers de farmácias (Reis Barata, Elo Farma, Silveira, Factorial)."""

from __future__ import annotations

import unittest

from sources._farmacia_pt import is_pharmacy_role, resolve_place
from sources.elo_farma import parse_page as parse_elo
from sources.factorial_farmacias import (
    FarmaciasCuidoScraper,
    _parse_detail,
    _parse_listing,
)
from sources.farmacias_silveira import parse_page as parse_silveira
from sources.reis_barata import parse_page as parse_reis_barata


class RoleFilterTest(unittest.TestCase):
    def test_includes(self) -> None:
        for title in (
            "Farmacêutico(a) | Farmácia Alcochete | Tempo Inteiro",
            "Farmacêutico/Farmacêutico Substituto - Margem Sul",
            "Diretor(a) Técnico(a) Adjunto(a) | Farmácia Carnaxide",
            "Técnico(a) Auxiliar de Farmácia | Farmácia Colombo",
            "Técnico/a de Farmácia - Full-Time",
            "Técnico Auxiliar de Farmácia (TAF) - Part-Time",
            "Técnico (a) de Farmácia",
        ):
            self.assertTrue(is_pharmacy_role(title), title)

    def test_excludes(self) -> None:
        for title in (
            "VENDEDOR/A DE SAÚDE/ÓTICA",
            "Técnico(a) de Backoffice | Farmácia Marbel",
            "Estágio Remunerado (para alunos do MICF, 4º e 5º ano)",
            "B2B & Medical Marketing Manager - Full-Time",
            "Delegado de Informação Médica",
            "Repositor/a",
            "Enfermeiro - Regime de Prestação de serviços",
        ):
            self.assertFalse(is_pharmacy_role(title), title)

    def test_places(self) -> None:
        self.assertEqual(resolve_place("Alcochete, Portugal"), ("Setúbal", "Alcochete"))
        self.assertEqual(resolve_place("Torre de D. Chama"), ("Bragança", "Mirandela"))
        self.assertEqual(resolve_place("., ., Portugal"), None)
        self.assertEqual(resolve_place("Viso", "Viseu")[0], "Viseu")


REIS_BARATA = """
<select name="agendafarmacia1" id="agendafarmacia1">
  <option value="0">-- Selecione --</option>
  <option value="3457">Farm&#225;cia Reis Barata - Almada</option>
  <option value="3456">Farm&#225;cia Reis Barata Lisboa - Av. Rep&#250;blica</option>
  <option value="4643">Farm&#225;cia Maria Aboim - Algarve</option>
</select>
<div class="vagascontent" data-rid="3457"><ul>
<li class="job-item">Farmacêutico/a -<span> Full<i>-Time</i></span></li>
<li class="job-item">Estágio Remunerado (para alunos do MICF, 4º e 5º ano)</li>
</ul></div>
<div class="vagascontent" data-rid="3456"><ul>
<li class="job-item">Técnico de Farmácia -<span> <i>Part-Time</i></span></li>
<li><span>B2B &amp; Medical Marketing Manager - </span><i>Full-Time</i></li>
</ul></div>
<div class="vagascontent" data-rid="4643"><ul>
<li class="job-item">Farmacêutico/a - <i>Full-Time e<span> </span>Part-Time</i> (2 vagas)</li>
</ul></div>
"""


class ReisBarataTest(unittest.TestCase):
    def test_parse(self) -> None:
        jobs = {job.source_id: job for job in parse_reis_barata(REIS_BARATA)}
        self.assertEqual(
            set(jobs),
            {"3457-farmaceutico-a", "3456-tecnico-de-farmacia", "4643-farmaceutico-a"},
        )
        almada = jobs["3457-farmaceutico-a"]
        self.assertEqual(almada.location_district, "Setúbal")
        self.assertEqual(almada.contract_type, "Tempo inteiro")
        self.assertEqual(almada.profession, "Farmácia")
        self.assertEqual(jobs["3456-tecnico-de-farmacia"].location_district, "Lisboa")
        self.assertEqual(
            jobs["3456-tecnico-de-farmacia"].contract_type, "Tempo parcial"
        )
        algarve = jobs["4643-farmaceutico-a"]
        self.assertEqual(algarve.location_district, "Faro")
        self.assertIsNone(algarve.contract_type)
        self.assertIn("2 vagas", algarve.description)


ELO = """
<div class="rich-text-block w-richtext">
<h2>Vagas em aberto</h2><h3><strong>Vagas a Norte</strong></h3>
<h4>&#8205;<strong>Farmácia Cruz Pires  - Torre de D. Chama (Mirandela)</strong></h4>
<p><strong>Vaga:</strong> Farmacêutico (a) I Técnico (a) de Farmácia</p>
<p><strong>Email:</strong> <a href="mailto:x@y.pt">farmaciacruzpires@sapo.pt</a></p>
<p><strong>Contacto: </strong>278318100</p>
<h3>Vagas a Centro</h3>
<h4><strong>Farmácia Roldão do Lavradio  - Barreiro</strong></h4>
<h6><strong>Vaga:</strong> Técnico (a) de Farmácia I Técnico (a) Auxiliar de Farmácia (para fazer Sábados)</h6>
<p><strong>Email: </strong>geral@farmaciaroldao.com</p>
</div>
"""


class EloFarmaTest(unittest.TestCase):
    def test_parse(self) -> None:
        jobs = {job.source_id: job for job in parse_elo(ELO)}
        self.assertEqual(
            set(jobs),
            {
                "farmacia-cruz-pires-farmaceutico",
                "farmacia-cruz-pires-tecnico",
                "farmacia-roldao-do-lavradio-tecnico",
                "farmacia-roldao-do-lavradio-tecnico-auxiliar",
            },
        )
        cruz = jobs["farmacia-cruz-pires-farmaceutico"]
        self.assertEqual(cruz.location_district, "Bragança")
        self.assertEqual(cruz.company, "Farmácia Cruz Pires")
        self.assertIn("farmaciacruzpires@sapo.pt", cruz.description)
        self.assertEqual(
            jobs["farmacia-roldao-do-lavradio-tecnico-auxiliar"].location_district,
            "Setúbal",
        )


SILVEIRA = """
<div class="oportunidade-wrapper"><h5 class="mb-3">Farmacêutico (Sintra &amp; Cascais)</h5>
<a href="#" class="oportunidade-btn" data-oportunidade-id="70">saiba mais</a></div>
<div class="oportunidade-wrapper"><h5 class="mb-3">Backoffice (Sintra &amp; Cascais)</h5>
<a href="#" class="oportunidade-btn" data-oportunidade-id="73">saiba mais</a></div>
<div class="oportunidade-modal oportunidade-70"><div class="modal-body">
<p>HABILITAÇÕES<br/>• Mestrado Integrado em Ciências Farmacêuticas<br/>PERFIL DO CANDIDATO<br/>
• Boa capacidade de comunicação e relacionamento interpessoal; • Disponibilidade de horários.</p>
</div></div>
"""


class SilveiraTest(unittest.TestCase):
    def test_parse(self) -> None:
        jobs = parse_silveira(SILVEIRA)
        self.assertEqual([job.source_id for job in jobs], ["70"])
        self.assertEqual(jobs[0].location_district, "Lisboa")
        self.assertEqual(jobs[0].location_concelho, "Sintra / Cascais")
        self.assertIn("Mestrado Integrado", jobs[0].description)


FACTORIAL_LISTING = """
<select><option value='380626'>Almada </option><option value='376036'>Lisboa </option></select>
<li class='job-offer-item w-full' data-job-postings-url='https://farmaciascuido.factorialhr.pt/job_posting/farmaceutico-a-farmacia-almada-tempo-inteiro-296518' data-location-id='380626'>
<div class="factorial__headingFontFamily">Farmacêutico(a) | Farmácia Almada | Tempo Inteiro</div></li>
<li class='job-offer-item w-full' data-job-postings-url='https://farmaciascuido.factorialhr.pt/job_posting/tecnico-a-de-backoffice-308394' data-location-id='376036'>
<div class="factorial__headingFontFamily">Técnico(a) de Backoffice | Farmácia Marbel</div></li>
"""

FACTORIAL_DETAIL = """
<ul><li><span class='inline-block align-middle mr-2 ml-2'>Indefinido</span></li>
<li><span class='inline-block align-middle mr-2 ml-2'>Tempo integral</span></li>
<li><span class='inline-block align-middle mr-2 ml-2'>Almada, Portugal</span></li></ul>
<div class='styledText'><p>Para reforçar a equipa da Farmácia Almada procuramos Farmacêuticos (m/f).</p>
<p>- Mestrado Integrado em Ciências Farmacêuticas</p><p>- Inscrição na Ordem dos Farmacêuticos</p></div>
"""


class FactorialTest(unittest.TestCase):
    def test_listing_and_detail(self) -> None:
        items = _parse_listing(FACTORIAL_LISTING)
        self.assertEqual([i["source_id"] for i in items], ["296518", "308394"])
        self.assertEqual(items[0]["location"], "Almada")
        meta, description = _parse_detail(FACTORIAL_DETAIL)
        self.assertEqual(meta["location"], "Almada, Portugal")
        self.assertIn("Ordem dos Farmacêuticos", description)
        job = FarmaciasCuidoScraper()._to_job(items[0], FACTORIAL_DETAIL)
        self.assertIsNotNone(job)
        self.assertEqual(job.title, "Farmacêutico(a) – Farmácia Almada")
        self.assertEqual(job.location_district, "Setúbal")
        self.assertEqual(job.contract_type, "Tempo inteiro")
        self.assertEqual(job.source, "farmacias_cuido")


if __name__ == "__main__":
    unittest.main()
