/**
 * Testes da pesquisa tolerante (acentos, género, plural, ordem, palavras vazias). Correr (na pasta da app):
 *   ./node_modules/.bin/tsc src/lib/search-text.ts src/lib/search-text.test.ts \
 *     --outDir /tmp/st-test --module commonjs --target es2020 --skipLibCheck --esModuleInterop \
 *     && node --test /tmp/st-test/
 */
import test from "node:test";
import assert from "node:assert/strict";
import { parseQuery, stemmedHasAll, stemmedText } from "./search-text";

const LANG = "pt";
function hit(text: string, query: string) {
  return stemmedHasAll(stemmedText(text, LANG), parseQuery(query, LANG));
}

test("encontra", () => {
  assert.ok(hit("Médico de Família", "medico"), "medico em Médico de Família");
  assert.ok(hit("Médico de Família", "MÉDICO"), "MÉDICO em Médico de Família");
  assert.ok(hit("Médica Dentista", "médico"), "médico em Médica Dentista");
  assert.ok(hit("Médicos", "medico"), "medico em Médicos");
  assert.ok(hit("Auxiliar de Saúde", "auxiliar de saude"), "auxiliar de saude em Auxiliar de Saúde");
  assert.ok(hit("Auxiliar de Saúde", "saude auxiliar"), "saude auxiliar em Auxiliar de Saúde");
  assert.ok(hit("Auxiliar de Saúde", "auxiliar saúde"), "auxiliar saúde em Auxiliar de Saúde");
  assert.ok(hit("Farmacêutico Hospitalar", "farmaceutico"), "farmaceutico em Farmacêutico Hospitalar");
  assert.ok(hit("Farmacêuticas", "farmacêutico"), "farmacêutico em Farmacêuticas");
  assert.ok(hit("Enfermeiro", "enfermeira"), "enfermeira em Enfermeiro");
  assert.ok(hit("Enfermeiras", "enfermeiros"), "enfermeiros em Enfermeiras");
  assert.ok(hit("Enfermeiro de Reabilitação", "reabilitacao enfermeiro"), "reabilitacao enfermeiro em Enfermeiro de Reabilitação");
  assert.ok(hit("Administração Hospitalar", "administracoes"), "administracoes em Administração Hospitalar");
  assert.ok(hit("Fisioterapeuta", "fisioterapeutas"), "fisioterapeutas em Fisioterapeuta");
  assert.ok(hit("Técnico de Radiologia", "tecnica de radiologia"), "tecnica de radiologia em Técnico de Radiologia");
  assert.ok(hit("Dentista", "dentistas"), "dentistas em Dentista");
  assert.ok(hit("Diretora Clínica", "diretor clinico"), "diretor clinico em Diretora Clínica");
  assert.ok(hit("Enfermagem", "enferm"), "enferm em Enfermagem");
});

test("não encontra", () => {
  assert.ok(!hit("Medicina Geral", "medico"), "medico não em Medicina Geral");
  assert.ok(!hit("Enfermeiro", "medico"), "medico não em Enfermeiro");
  assert.ok(!hit("Auxiliar de Saúde", "auxiliar de limpeza"), "auxiliar de limpeza não em Auxiliar de Saúde");
  assert.ok(!hit("Enfermeiro", "enfermagem"), "enfermagem não em Enfermeiro");
});

test("pesquisa só com palavras vazias usa-as", () => {
  assert.ok(hit("Médico de família", "de"));
});
