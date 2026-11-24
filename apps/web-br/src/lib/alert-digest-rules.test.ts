/**
 * Testes das regras do resumo de alertas. Correr (na pasta da app):
 *   ./node_modules/.bin/tsc src/lib/alert-digest-rules.ts src/lib/alert-digest-rules.test.ts \
 *     --outDir /tmp/ad-test --module commonjs --target es2020 --skipLibCheck --esModuleInterop \
 *     && node --test /tmp/ad-test/
 */
import test from "node:test";
import assert from "node:assert/strict";
import { effectiveSince, localDay, weeklySentEmails } from "./alert-digest-rules";

const LISBON = "Europe/Lisbon";
const SAO_PAULO = "America/Sao_Paulo";
const alerts = [
  { id: "a1", email: "Ana@exemplo.pt" },
  { id: "a2", email: "rui@exemplo.pt" },
  { id: "a3", email: "ana@exemplo.pt" },
];
const state = {
  pt: {
    a1: { date: "2026-11-22", sentAt: "2026-11-22T09:00:00+00:00", resendId: "x" },
    a2: { date: "2026-11-15", sentAt: "2026-11-15T09:00:00+00:00", resendId: "y" },
  },
  es: { a2: { date: "2026-11-22", sentAt: "2026-11-22T19:42:33+00:00" } },
};

test("salta só quem recebeu o resumo de domingo hoje (por endereço, sem distinguir maiúsculas)", () => {
  assert.deepEqual([...weeklySentEmails(state, "pt", alerts, "2026-11-22", LISBON)], ["ana@exemplo.pt"]);
  assert.equal(weeklySentEmails(state, "pt", alerts, "2026-11-23", LISBON).size, 0);
});

test("usa a chave do mercado: es lê es, não pt", () => {
  assert.deepEqual([...weeklySentEmails(state, "es", alerts, "2026-11-22", LISBON)], ["rui@exemplo.pt"]);
  assert.equal(weeklySentEmails(state, "it", alerts, "2026-11-22", LISBON).size, 0);
});

test("ficheiro inexistente/inválido: ninguém saltado", () => {
  for (const raw of [undefined, null, {}, [], "x", 3, { pt: null }, { pt: "x" }, { pt: { a1: null } }, { es: state.es }]) {
    assert.equal(weeklySentEmails(raw, "pt", alerts, "2026-11-22", LISBON).size, 0);
  }
});

test("sem sentAt válido: recorre a date", () => {
  const raw = { pt: { a1: { date: "2026-11-22" }, a2: { date: "2026-11-22", sentAt: "lixo" } } };
  assert.deepEqual([...weeklySentEmails(raw, "pt", alerts, "2026-11-22", LISBON)].sort(), ["ana@exemplo.pt", "rui@exemplo.pt"]);
});

test("BR: resumo de domingo às 22:10 em Brasília (01:10Z de segunda, date = segunda em Lisboa)", () => {
  const raw = { br: { a1: { date: "2026-11-23", sentAt: "2026-11-23T01:10:06+00:00" } } };
  assert.equal(localDay("2026-11-23T01:10:06+00:00", SAO_PAULO), "2026-11-22");
  assert.equal(localDay("2026-11-23T01:10:06+00:00", LISBON), "2026-11-23");
  // o digest do fim do dia do BR corre em Brasília: clock.day = 2026-11-22 -> salta
  assert.deepEqual([...weeklySentEmails(raw, "br", alerts, "2026-11-22", SAO_PAULO)], ["ana@exemplo.pt"]);
  // e na segunda de manhã em Brasília (23) já não salta
  assert.equal(weeklySentEmails(raw, "br", alerts, "2026-11-23", SAO_PAULO).size, 0);
  // com a regra antiga (campo date) falharia: date é segunda
  assert.equal(raw.br.a1.date, "2026-11-23");
});

test("BR: resumo de domingo de manhã (10:00 Brasília = 13:00Z) conta no domingo em Brasília", () => {
  const raw = { br: { a1: { date: "2026-11-22", sentAt: "2026-11-22T13:00:00+00:00" } } };
  assert.equal(weeklySentEmails(raw, "br", alerts, "2026-11-22", SAO_PAULO).size, 1);
});

test("effectiveSince: carryOver recua a janela, com limite do máximo de recuo", () => {
  const since = Date.parse("2026-11-22T20:00:00Z");
  const floor = Date.parse("2026-11-19T20:00:00Z");
  const carry = { "ana@exemplo.pt": "2026-11-22T08:00:00Z", "velho@exemplo.pt": "2026-11-01T00:00:00Z", "mau@exemplo.pt": "x" };
  assert.equal(effectiveSince(since, carry, "ana@exemplo.pt", floor), Date.parse("2026-11-22T08:00:00Z"));
  assert.equal(effectiveSince(since, carry, "velho@exemplo.pt", floor), floor);
  assert.equal(effectiveSince(since, carry, "mau@exemplo.pt", floor), since);
  assert.equal(effectiveSince(since, undefined, "ana@exemplo.pt", floor), since);
});
