"""Tests de los scrapers del sector público (boletines autonómicos) y de los títulos cortos."""
import sys
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sources import boc_canarias, bocm, bocyl, boib, boja, borm, docm, doe, dog  # noqa: E402
from sources._pub_common import (  # noqa: E402
    Entry,
    build_title,
    classify,
    dedupe_titles,
    deadline_for,
    extract_position,
    ingesa_place,
    jobs_from_entries,
    plazas_from,
    split_workplace,
)

NOW = datetime(2026, 11, 4, tzinfo=timezone.utc)


class Titles(unittest.TestCase):
    def test_classify(self):
        self.assertEqual(classify("por la que se convoca proceso selectivo, por concurso-oposición, para acceso a la condición de personal estatutario fijo en la categoría de Enfermero/a"), "Oposición")
        self.assertEqual(classify("por la que se convoca concurso de traslados voluntario a plazas de la categoría de Pediatra"), "Concurso de traslados")
        self.assertEqual(classify("por la que se convoca concurso de méritos para la cobertura del puesto de Jefe/a de Servicio"), "Concurso")
        self.assertEqual(classify("por la que se abre la bolsa de empleo temporal de Enfermero/a"), "Bolsa de empleo")
        self.assertEqual(classify("oferta de contratación temporal de Médico/a de familia"), "Contratación temporal")

    def test_build_title(self):
        self.assertEqual(build_title("Oposición", "Enfermero/a", "INGESA", 12), "Oposición Enfermero/a — INGESA (12 plazas)")
        self.assertEqual(build_title("Concurso", "Jefe/a de Servicio de Cardiología", "Osakidetza"), "Concurso Jefe/a de Servicio de Cardiología — Osakidetza")
        self.assertEqual(build_title("Concurso", "jefe/a de sección", "SAS", 1, place="Hospital de Jaén"), "Concurso Jefe/a de sección — SAS (Hospital de Jaén, 1 plaza)")
        long = build_title("Oposición", "X " * 100, "SAS")
        self.assertLess(len(long), 120)

    def test_position_and_plazas(self):
        t = "Resolución de 1 de octubre de 2026, de la Dirección Gerencia, por la que se convoca proceso selectivo para el acceso a la condición de personal estatutario fijo en la categoría de Facultativo/a Especialista de Área en Cardiología, convocado por Resolución de 19 de diciembre."
        self.assertEqual(extract_position(t), "Facultativo/a Especialista de Área en Cardiología")
        self.assertEqual(extract_position("por la que se convoca concurso de méritos para la cobertura del puesto de cargo intermedio de Jefe/a de Sección en el Hospital Universitario de Jaén."),
                         "Jefe/a de Sección en el Hospital Universitario de Jaén")
        self.assertEqual(split_workplace("Jefe/a de Sección en el Hospital Universitario de Jaén"), ("Jefe/a de Sección", "Hospital Universitario de Jaén"))
        self.assertEqual(plazas_from("para cubrir 25 plazas de Enfermero"), 25)
        self.assertEqual(plazas_from("la cobertura de dos puestos de cargo intermedio"), 2)

    def test_dedupe_titles_distinguishes_same_title(self):
        e = lambda i, d: Entry(i, "Resolución, por la que se convoca proceso selectivo para el acceso a la condición de personal estatutario fijo en la categoría de Enfermero/a del Servicio Gallego de Salud.", f"https://x/{i}", d, "Servicio Gallego de Salud")
        jobs = jobs_from_entries([e("a", date(2026, 10, 30)), e("b", date(2026, 11, 3))], slug="dog", gazette="DOG", region="Galicia", now=NOW)
        self.assertEqual(len(jobs), 2)
        self.assertNotEqual(jobs[0].title, jobs[1].title)
        self.assertTrue(jobs[0].title.startswith("Oposición Enfermero/a — Sergas"))

    def test_refine_profession_and_provisional_convoca(self):
        from sources._pub_common import refine_profession
        self.assertEqual(refine_profession("Jefe/a de Servicio de Neurocirugía", "Gestión y apoyo", True), "Medicina")
        self.assertEqual(refine_profession("Jefe/a de Equipo de Celadores", "Gestión y apoyo", True), "Gestión y apoyo")
        self.assertEqual(refine_profession("Jefe/a de Unidad de Enfermería", "Enfermería", True), "Enfermería")
        e = Entry("1", "Resolución de 6 de octubre de 2026, de la Dirección-Gerencia del Hospital Clínico San Carlos del Servicio Madrileño de Salud, por la que se convoca un puesto de Jefe/a de Servicio de Análisis Clínicos, en este centro asistencial para su cobertura mediante nombramiento provisional", "https://x/1", date(2026, 11, 4), "HOSPITAL CLÍNICO “SAN CARLOS”")
        jobs = jobs_from_entries([e], slug="bocm", gazette="BOCM", region="Madrid", now=NOW)
        self.assertEqual(jobs[0].title, "Concurso Jefe/a de Servicio de Análisis Clínicos — SERMAS (Hospital Clínico “San Carlos”)")
        self.assertEqual(jobs[0].profession, "Medicina")

    def test_deadline(self):
        self.assertEqual(deadline_for(date(2026, 10, 5)).date(), date(2026, 11, 2))
        self.assertEqual(deadline_for(date(2026, 10, 5), "plazo de 10 días naturales").date(), date(2026, 10, 15))

    def test_ingesa_place(self):
        self.assertEqual(ingesa_place("... INGESA ... en Melilla"), ("Melilla", "Melilla"))
        self.assertEqual(ingesa_place("... INGESA, hospital de Ceuta"), ("Ceuta", "Ceuta"))
        self.assertEqual(ingesa_place("... Ceuta y Melilla ..."), ("Ceuta", "Ceuta y Melilla"))
        self.assertEqual(ingesa_place("... INGESA ..."), ("Ceuta", "Ceuta y Melilla"))

    def test_filters(self):
        base = dict(url="https://x/1", published=date(2026, 11, 3))
        closed = Entry("1", "Resolución, por la que se aprueba la lista definitiva de personas admitidas y excluidas en el proceso selectivo para la categoría de Enfermero/a", department="Servicio Gallego de Salud", **base)
        libre = Entry("2", "Resolución, por la que se convoca, por libre designación, el puesto de Jefe/a de Servicio de Cardiología", department="Servicio Gallego de Salud", **base)
        univ = Entry("3", "Resolución, por la que se convoca concurso para plazas de profesor de Medicina", department="Universidad de X", **base)
        old = Entry("4", "Resolución, por la que se convoca proceso selectivo en la categoría de Enfermero/a", department="Servicio Gallego de Salud", url="https://x/4", published=date(2026, 8, 1))
        self.assertEqual(jobs_from_entries([closed, libre, univ, old], slug="dog", gazette="DOG", region="Galicia", now=NOW), [])


class Dog(unittest.TestCase):
    RSS = """<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>x</title>
<item><title>RESOLUCIÓN de 27 de octubre de 2026, de la Dirección General de Recursos Humanos, por la que se convoca proceso selectivo para el acceso a la condición de personal estatutario fijo en la categoría de Enfermero/a, por el sistema de promoción interna.</title>
<description><![CDATA[IV. Oposiciones y concursos </br> Servicio Gallego de Salud]]></description>
<link>https://www.xunta.gal/dog/Publicados/2026/20261104/AnuncioG0003-281026-0001_es.html</link>
<pubDate>Wed, 04 Nov 2026 00:00:00 +0100</pubDate><guid isPermaLink="true">https://www.xunta.gal/dog/Publicados/2026/20261104/AnuncioG0003-281026-0001_es.html</guid></item>
<item><title>ORDEN de 2 de noviembre de 2026 por la que se establecen los criterios para centros docentes.</title>
<description><![CDATA[I. Disposiciones generales </br> Consellería de Educación]]></description>
<link>https://www.xunta.gal/dog/Publicados/2026/20261104/AnuncioG0761-021126-0001_es.html</link><pubDate>Wed, 04 Nov 2026 00:00:00 +0100</pubDate></item>
</channel></rss>""".encode()

    def test_parse_and_jobs(self):
        entries = dog.parse_feed(self.RSS)
        self.assertEqual(len(entries), 2)
        self.assertEqual(entries[0].department, "Servicio Gallego de Salud")
        jobs = jobs_from_entries(entries, slug="dog", gazette="DOG", region="Galicia", now=NOW)
        self.assertEqual(len(jobs), 1)
        j = jobs[0]
        self.assertEqual(j.title, "Oposición Enfermero/a — Sergas (promoción interna)")
        self.assertEqual(j.company, "Servicio Gallego de Salud (Sergas)")
        self.assertEqual((j.location_district, j.sector, j.profession), ("Galicia", "publico", "Enfermería"))
        self.assertTrue(j.description.startswith("RESOLUCIÓN de 27 de octubre"))
        self.assertEqual(j.expires_at[:10], "2026-12-02")


class Borm(unittest.TestCase):
    RSS = """<?xml version="1.0" encoding="UTF-8" ?><rss version="2.0"><channel><title>b</title>
<item><title><![CDATA[5390 Resolución del Director Gerente del Servicio Murciano de Salud, por la que se convoca proceso selectivo para el acceso a la condición de personal estatutario fijo en la categoría de Fisioterapeuta. (4 página/s - 210.5KB)]]></title>
<link><![CDATA[https://www.borm.es/services/anuncio/846070/pdf]]></link><description> <![CDATA[Servicio Murciano de Salud]]> </description>
<pubDate><![CDATA[Wed, 4 Nov 2026 00:00:00 +0100]]></pubDate><guid isPermaLink="true"><![CDATA[https://www.borm.es/services/anuncio/846070/pdf]]></guid>
<category><![CDATA[I2. Autoridades y Personal]]></category><category><![CDATA[Servicio Murciano de Salud]]></category></item>
<item><title><![CDATA[5399 Convocatoria para el otorgamiento de subvenciones sociosanitarias. (3 página/s - 207.37KB)]]></title>
<link><![CDATA[https://www.borm.es/services/anuncio/846075/pdf]]></link><description><![CDATA[Jumilla]]></description><pubDate><![CDATA[Wed, 4 Nov 2026 00:00:00 +0100]]></pubDate>
<guid isPermaLink="true"><![CDATA[https://www.borm.es/services/anuncio/846075/pdf]]></guid></item></channel></rss>""".encode()

    def test_parse_and_jobs(self):
        entries = borm.parse_feed(self.RSS)
        self.assertEqual(entries[0].ident, "borm-846070")
        self.assertTrue(entries[0].title.startswith("Resolución del Director Gerente"))
        self.assertFalse(entries[0].title.endswith(")"))
        jobs = jobs_from_entries(entries, slug="borm", gazette="BORM", region="Murcia", now=NOW)
        self.assertEqual([j.title for j in jobs], ["Oposición Fisioterapeuta — SMS"])
        self.assertEqual(jobs[0].location_district, "Murcia")


class Doe(unittest.TestCase):
    RSS = """<?xml version="1.0" encoding="iso-8859-1"?><rss version="2.0"><channel><title>A</title>
<item><title><![CDATA[Resolución de 30 de octubre de 2026, de la Dirección General de Recursos Humanos, por la que se convoca concurso de traslados a plazas de la categoría de Facultativo Especialista de Área en Pediatría.]]></title>
<link>http://doe.juntaex.es/pdfs/doe/2026/2120o/26062807.pdf</link><pubDate>2026-11-04</pubDate><category>II.AUTORIDADES Y PERSONAL</category>
<description><![CDATA[SERVICIO EXTREMEÑO DE SALUD. Concursos.- Resolución de 30 de octubre...]]></description></item></channel></rss>""".encode("iso-8859-1")

    def test_parse_and_jobs(self):
        entries = doe.parse_feed(self.RSS)
        self.assertEqual(entries[0].department, "SERVICIO EXTREMEÑO DE SALUD")
        self.assertTrue(entries[0].url.startswith("https://doe.juntaex.es/"))
        jobs = jobs_from_entries(entries, slug="doe", gazette="DOE", region="Extremadura", now=NOW)
        self.assertEqual(len(jobs), 1)
        self.assertTrue(jobs[0].title.startswith("Concurso de traslados Facultativo Especialista de Área en Pediatría — SES"))
        self.assertEqual(jobs[0].location_district, "Extremadura")


class BocCanarias(unittest.TestCase):
    RSS = """<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>R</title>
<item><title>Servicio Canario de la Salud. Dirección Gerencia del Hospital Universitario de Canarias.- Resolución de 20 de octubre de 2026, por la que se convoca proceso selectivo para la constitución de bolsa de empleo en la categoría de Enfermero/a.</title>
<link>https://www.gobiernodecanarias.org/boc/2026/220/005.html</link><description>&lt;h5&gt;II&lt;/h5&gt;</description><pubDate>Wed, 04 Nov 2026 00:00:00 +0100</pubDate></item></channel></rss>""".encode()

    def test_parse_and_jobs(self):
        entries = boc_canarias.parse_feed(self.RSS)
        self.assertEqual(entries[0].ident, "boc-2026-220-005")
        self.assertTrue(entries[0].department.startswith("Servicio Canario de la Salud"))
        jobs = jobs_from_entries(entries, slug="boc-canarias", gazette="BOC", region="Canarias", now=NOW)
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0].title, "Bolsa de empleo Enfermero/a — SCS Canarias")
        self.assertEqual(jobs[0].contract_type, "Temporal")


class Bocyl(unittest.TestCase):
    RSS = """<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>B</title><item><title>Boletín</title><link>https://bocyl.jcyl.es/boletin.do</link>
<description>&lt;ul&gt;&lt;li&gt;&lt;p&gt;&lt;a href="https://bocyl.jcyl.es/boletines/2026/11/04/pdf/BOCYL-D-04112026-213-7.pdf"&gt;&lt;xml-fragment&gt;I. COMUNIDAD&lt;/xml-fragment&gt; - &lt;xml-fragment&gt;CONSEJERÍA DE SANIDAD&lt;/xml-fragment&gt;&lt;/a&gt;&lt;/p&gt;&lt;p style='x'&gt;RESOLUCIÓN de 20 de octubre de 2026, de la Gerencia Regional de Salud, por la que se convoca proceso selectivo para el ingreso en la categoría de Técnico/a Superior Sanitario en Laboratorio Clínico.&lt;/p&gt;&lt;/li&gt;&lt;li&gt;&lt;p&gt;&lt;a href="https://bocyl.jcyl.es/boletines/2026/11/04/pdf/BOCYL-D-04112026-213-8.pdf"&gt;&lt;xml-fragment&gt;I. COMUNIDAD&lt;/xml-fragment&gt; - &lt;xml-fragment&gt;CONSEJERÍA DE CULTURA&lt;/xml-fragment&gt;&lt;/a&gt;&lt;/p&gt;&lt;p style='x'&gt;ORDEN CYT/1/2026, por la que se convoca premio.&lt;/p&gt;&lt;/li&gt;&lt;/ul&gt;</description>
<pubDate>Wed, 04 Nov 2026 09:55:56 GMT</pubDate></item></channel></rss>""".encode()

    def test_parse_and_jobs(self):
        entries = bocyl.parse_feed(self.RSS)
        self.assertEqual([e.ident for e in entries], ["bocyl-04112026-213-7", "bocyl-04112026-213-8"])
        self.assertEqual(entries[0].department, "CONSEJERÍA DE SANIDAD")
        jobs = jobs_from_entries(entries, slug="bocyl", gazette="BOCYL", region="Castilla y León", now=NOW)
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0].location_district, "Castilla y León")
        self.assertTrue(jobs[0].title.startswith("Oposición Técnico/a Superior Sanitario en Laboratorio Clínico — SACYL"))


class Boja(unittest.TestCase):
    PAGE = """<h1> Boletín Oficial de la Junta de Andalucía - Histórico del BOJA <span class="nota"> Boletín número 212 de
   03/11/2026</span></h1><h2>2. Autoridades y personal</h2><h3>2.2. Oposiciones, concursos y otras convocatorias</h3>
<p class="h5 text-uppercase font-weight-bold">Consejería de Presidencia, Sanidad y Emergencias</p>
<div class="item punteado_izquierda"><p>Resolución de 28 de octubre de 2026, de la Dirección General de Personal del Servicio Andaluz de Salud, por la que se convoca, mediante el sistema de concurso de méritos, la cobertura de dos puestos de cargo intermedio de Jefe/a de Sección Facultativo de Cardiología en el Hospital Universitario Virgen del Rocío de Sevilla.</p>
<ul class="sumario_pdf"><li><a href="BOJA26-212-1.pdf" class="item_pdf_grupo">Descargar PDF</a></li></ul>
<ul class="sumario_pdf"><li><a href="/boja/2026/212/11" class="item_html" title="x">Otros formatos</a></li></ul><div class="clear"> </div></div>
<div class="item punteado_izquierda"><p>Resolución de 28 de octubre de 2026, de la Dirección General de Personal del Servicio Andaluz de Salud, por la que se aprueban las listas definitivas de personas aspirantes.</p>
<ul class="sumario_pdf"><li><a href="/boja/2026/212/12" class="item_html" title="x">Otros formatos</a></li></ul><div class="clear"> </div></div>"""

    def test_section_and_jobs(self):
        entries = boja.parse_section(self.PAGE)
        self.assertEqual(len(entries), 2)
        self.assertEqual(entries[0].published, date(2026, 11, 3))
        self.assertEqual(entries[0].ident, "boja-2026-212-11")
        jobs = jobs_from_entries(entries, slug="boja", gazette="BOJA", region="Andalucía", now=NOW)
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0].title, "Concurso Jefe/a de Sección Facultativo de Cardiología — SAS (Hospital Universitario Virgen del Rocío de Sevilla, 2 plazas)")
        self.assertEqual(jobs[0].profession, "Medicina")

    def test_latest_and_section_link(self):
        feed = "<title>Boletín Extraordinario número 220801 de 04 de noviembre de 2026</title><title>Boletín número 213 de 04 de noviembre de 2026</title>"
        self.assertEqual(boja.latest_bulletin(feed), (2026, 213))
        self.assertEqual(boja.section_link('<li><a href="s53">Oposiciones, concursos y otras convocatorias</a></li>'), "s53")


class Bocm(unittest.TestCase):
    PAGE = """<h4>CONSEJERÍA DE SANIDAD</h4><div class="views-row"><div class="field-content sub-organismo">SERVICIO MADRILEÑO DE SALUD</div>
<article id="node-1" class="node node-orden" about="/bocm-20261104-13" typeof="x"><div class="field field-name-field-short-description field-type-text-long">
<div class="field-items"><div class="field-item even"><p>Oposiciones<br />– Resolución de 15 de octubre de 2026, de la Dirección General de Recursos Humanos del Servicio Madrileño de Salud, por la que se convoca proceso selectivo para ingreso en la categoría de Enfermero/a Especialista en Salud Mental.</p>
</div></div></div></article></div>
<div class="views-row"><div class="field-content sub-organismo">HOSPITAL GENERAL UNIVERSITARIO GREGORIO MARAÑÓN</div>
<article id="node-2" class="node node-orden" about="/bocm-20261104-14" typeof="x"><div class="field field-name-field-short-description field-type-text-long">
<div class="field-items"><div class="field-item even"><p>Nombramientos<br />– Resolución por la que se nombra personal.</p></div></div></div></article></div>"""

    def test_parse_and_jobs(self):
        entries = bocm.parse_department_page(self.PAGE, date(2026, 11, 4))
        self.assertEqual([e.ident for e in entries], ["bocm-20261104-13", "bocm-20261104-14"])
        self.assertEqual(entries[0].url, "https://www.bocm.es/bocm-20261104-13")
        jobs = jobs_from_entries(entries, slug="bocm", gazette="BOCM", region="Madrid", now=NOW)
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0].location_district, "Madrid")
        self.assertTrue(jobs[0].title.startswith("Oposición Enfermero/a Especialista en Salud Mental — SERMAS"))

    def test_refs_and_link(self):
        feed = "<item><link>https://www.bocm.es/boletin/bocm-20261104-265</link></item><item><link>https://www.bocm.es/boletin/bocm-20261103-264</link></item>"
        self.assertEqual(bocm.bulletin_refs(feed)[0], ("https://www.bocm.es/boletin/bocm-20261104-265", date(2026, 11, 4), "265"))
        html = '<a href="/boletin-completo/bocm-20261104/265/i.-comunidad-de-madrid/b%29-autoridades-y-personal/consejer%C3%ADa-de-sanidad">X</a>'
        self.assertTrue(bocm.sanidad_link(html).endswith("consejer%C3%ADa-de-sanidad"))


class Docm(unittest.TestCase):
    PAGE = """<div class = "organismo"><h4 class = "tituloOrganismo"> Servicio de Salud de Castilla-La Mancha (Sescam) <br/></h4></div>
<div class = "disp_1793020052353340061"><p class = "sumario"><a href="./descargarArchivo.do?ruta=2026/11/04/pdf/2026_7834.pdf&amp;tipo=rutaDocm" class = "new-window">Oposiciones. Resoluci&#243;n de 26/10/2026</a>, de la Direcci&#243;n General de Recursos Humanos, por la que se convoca proceso selectivo para el ingreso, por el sistema de acceso libre, en la categor&#237;a de Enfermero/a del Servicio de Salud de Castilla-La Mancha. [NID 2026/7834] </p>
<p class = "paginaDisposicion"> 39011 </p>[<a href="./detalleDocumento.do?idDisposicion=1793020052353340061" title="Ver">Ver detalle</a>] </div>"""

    def test_parse_and_jobs(self):
        entries = docm.parse_sumario(self.PAGE)
        self.assertEqual(len(entries), 1)
        e = entries[0]
        self.assertEqual((e.ident, e.section, e.published), ("docm-2026-7834", "Oposiciones", date(2026, 11, 4)))
        self.assertTrue(e.title.startswith("Resolución de 26/10/2026"))
        jobs = jobs_from_entries(entries, slug="docm", gazette="DOCM", region="Castilla-La Mancha", now=NOW)
        self.assertEqual(jobs[0].title, "Oposición Enfermero/a — SESCAM")
        self.assertEqual(jobs[0].location_district, "Castilla-La Mancha")


class Boib(unittest.TestCase):
    PAGE = """<h3 class="organisme">ADMINISTRACIÓN DE LA COMUNIDAD AUTÓNOMA<strong>SERVICIO DE SALUD DE LAS ILLES BALEARS</strong></h3>
<ul class="resolucions"><li><p>Resolución de la directora de Recursos Humanos del Servicio de Salud de las Illes Balears por la que se convoca la provisión, por el procedimiento de concurso, del puesto de trabajo de jefe/a de sección de Medicina Interna del Hospital Universitari Son Espases</p>
<p class="registre">Número de registro 10981 - Páginas&nbsp;62332-62340</p><ul class="documents"><li><a class="pdf" href='/eboibfront/pdf/es/2026/140/1231841'>PDF</a></li>
<li><a rel="bookmark" href="https://www.caib.es/eboibfront/es/2026/12354/721650/resolucion-de-la-directora" class="html">HTML</a></li></ul></li></ul>"""

    def test_parse_and_jobs(self):
        entries = boib.parse_section(self.PAGE, date(2026, 11, 3))
        self.assertEqual(entries[0].ident, "boib-2026-721650")
        jobs = jobs_from_entries(entries, slug="boib", gazette="BOIB", region="Islas Baleares", now=NOW)
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0].location_district, "Islas Baleares")
        self.assertTrue(jobs[0].title.startswith("Concurso Jefe/a de sección de Medicina Interna — IB-Salut"))

    def test_index_and_bulletins(self):
        self.assertEqual(boib.section_ii_link('<a href="/eboibfront/es/2026/12354/seccion-ii-autoridades-y-personal/473">x</a>'),
                         "/eboibfront/es/2026/12354/seccion-ii-autoridades-y-personal/473")
        feed = b'<rss><channel><item><link>https://www.caib.es/eboibfront/ca/2026/12354</link><pubDate>Tue, 03 Nov 2026 07:30:00 GMT</pubDate></item></channel></rss>'
        self.assertEqual(boib.bulletins(feed), [("2026", "12354", date(2026, 11, 3))])


if __name__ == "__main__":
    unittest.main()
