/**
 * Testes da pesquisa tolerante (acentos, género, plural, ordem, palavras vazias). Correr (na pasta da app):
 *   ./node_modules/.bin/tsc src/lib/search-text.ts src/lib/search-text.test.ts \
 *     --outDir /tmp/st-test --module commonjs --target es2020 --skipLibCheck --esModuleInterop \
 *     && node --test /tmp/st-test/
 */
import test from "node:test";
import assert from "node:assert/strict";
import { lightText, parseQuery, stemmedHasAll, stemmedText } from "./search-text";

const LANG = "es";
function hit(text: string, query: string) {
  return stemmedHasAll(stemmedText(text, LANG), parseQuery(query, LANG));
}

test("encontra", () => {
  assert.ok(hit("Fisioterapeuta", "fisioterapeutas"), "fisioterapeutas em Fisioterapeuta");
  assert.ok(hit("Fisioterapeutas", "fisioterapeuta"), "fisioterapeuta em Fisioterapeutas");
  assert.ok(hit("Médico de Familia", "medico de familia"), "medico de familia em Médico de Familia");
  assert.ok(hit("Médicos", "MÉDICA"), "MÉDICA em Médicos");
  assert.ok(hit("Enfermero/a", "enfermeras"), "enfermeras em Enfermero/a");
  assert.ok(hit("Enfermeras", "enfermero"), "enfermero em Enfermeras");
  assert.ok(hit("Técnico en Cuidados Auxiliares", "tecnicos auxiliar cuidados"), "tecnicos auxiliar cuidados em Técnico en Cuidados Auxiliares");
  assert.ok(hit("Auxiliares de enfermería", "auxiliar enfermeria"), "auxiliar enfermeria em Auxiliares de enfermería");
  assert.ok(hit("Celador", "celadores"), "celadores em Celador");
  assert.ok(hit("Celadora", "celadores"), "celadores em Celadora");
  assert.ok(hit("Técnico de Laboratorio", "laboratorio tecnico"), "laboratorio tecnico em Técnico de Laboratorio");
});

test("não encontra", () => {
  assert.ok(!hit("Auxiliar de enfermería", "enfermero"), "enfermero no en enfermería");
  assert.ok(!hit("Medicina Familiar", "médico"), "médico não em Medicina Familiar");
  assert.ok(!hit("Enfermero", "médico"), "médico não em Enfermero");
  assert.ok(!hit("Enfermero", "auxiliar"), "auxiliar não em Enfermero");
});

test("pesquisa só com palavras vazias usa-as", () => {
  assert.ok(hit("Médico de família", "de"));
});

test("descrição: só plural, sem género (evita 'assistência médica' trazer tudo)", () => {
  const job = (desc: string) => stemmedText("Auxiliar", LANG) + lightText(desc, LANG);
  const q = parseQuery("médico", LANG);
  assert.ok(!stemmedHasAll(job("Ofrecemos seguro médica privado"), q));
  assert.ok(stemmedHasAll(job("Buscamos médicos"), q));
});
