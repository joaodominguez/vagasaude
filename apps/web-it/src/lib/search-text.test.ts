/**
 * Testes da pesquisa tolerante (acentos, género, plural, ordem, palavras vazias). Correr (na pasta da app):
 *   ./node_modules/.bin/tsc src/lib/search-text.ts src/lib/search-text.test.ts \
 *     --outDir /tmp/st-test --module commonjs --target es2020 --skipLibCheck --esModuleInterop \
 *     && node --test /tmp/st-test/
 */
import test from "node:test";
import assert from "node:assert/strict";
import { lightText, parseQuery, stemmedHasAll, stemmedText } from "./search-text";

const LANG = "it";
function hit(text: string, query: string) {
  return stemmedHasAll(stemmedText(text, LANG), parseQuery(query, LANG));
}

test("encontra", () => {
  assert.ok(hit("Infermiere", "infermieri"), "infermieri em Infermiere");
  assert.ok(hit("Infermieri", "infermiere"), "infermiere em Infermieri");
  assert.ok(hit("Infermiera", "infermiere"), "infermiere em Infermiera");
  assert.ok(hit("Dirigente Medico", "medici"), "medici em Dirigente Medico");
  assert.ok(hit("Medico Chirurgo", "MEDICO"), "MEDICO em Medico Chirurgo");
  assert.ok(hit("Operatore Socio Sanitario", "operatori socio sanitari"), "operatori socio sanitari em Operatore Socio Sanitario");
  assert.ok(hit("Dottoressa", "dottore"), "dottore em Dottoressa");
  assert.ok(hit("Educatrice", "educatore"), "educatore em Educatrice");
  assert.ok(hit("Educatori", "educatrice"), "educatrice em Educatori");
  assert.ok(hit("Tecnico di Laboratorio", "laboratorio tecnici"), "laboratorio tecnici em Tecnico di Laboratorio");
  assert.ok(hit("Farmacista", "farmacisti"), "farmacisti em Farmacista");
  assert.ok(hit("Collaboratore Professionale Sanitario", "sanitaria"), "sanitaria em Collaboratore Professionale Sanitario");
});

test("não encontra", () => {
  assert.ok(!hit("Medicina Generale", "medico"), "medico não em Medicina Generale");
  assert.ok(!hit("Infermiere", "medico"), "medico não em Infermiere");
  assert.ok(!hit("Infermiere", "ostetrica"), "ostetrica não em Infermiere");
});

test("descrição: só plural, sem género (evita 'assistência médica' trazer tudo)", () => {
  const job = (desc: string) => stemmedText("Auxiliar", LANG) + lightText(desc, LANG);
  const q = parseQuery("médico", LANG);
  assert.ok(!stemmedHasAll(job("Visita medica aziendale"), q));
  assert.ok(stemmedHasAll(job("Cercasi medico"), q));
});
