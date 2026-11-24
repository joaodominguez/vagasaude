/**
 * Regras puras do resumo de alertas (sem I/O nem aliases «@/», testáveis com node:test).
 *
 * Regra aprovada: no máximo 1 email por dia por endereço. O resumo de domingo
 * (scrapers/tools/weekly_digest.py) grava UM ficheiro para os 4 sites de saúde,
 * /var/www/vagasaude/data/weekly-digest-state.json:
 *   {"pt": {"<alertId>": {"date": "AAAA-MM-DD", "sentAt": "2026-11-22T19:42:31+00:00", "resendId": "..."}}, "br": {...}, "es": {...}, "it": {...}}
 * ATENÇÃO: `date` é o dia em LISBOA (para o BR, o envio de domingo à noite em Brasília, 22:10, fica com
 * date de segunda). Por isso o "enviado hoje" compara `sentAt` convertido para o fuso do digest da app
 * (o mesmo de `clock.day`), e só recorre a `date` se `sentAt` faltar/for inválido.
 * Quem já recebeu o resumo de domingo hoje não recebe o resumo do fim do dia; as vagas ficam para a manhã
 * seguinte (`carryOver` no estado: endereço → data desde a qual as vagas contam nesse resumo).
 */

export type AlertRef = { id: string; email: string };

/** Dia local (AAAA-MM-DD) de um instante ISO no fuso dado; "" se inválido. */
export function localDay(iso: unknown, timeZone: string): string {
  const ms = typeof iso === "string" ? Date.parse(iso) : NaN;
  if (Number.isNaN(ms)) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * Endereços (minúsculas) com resumo de domingo enviado no dia local `day` (fuso `timeZone`) neste mercado
 * (`market` = chave do ficheiro: pt|br|es|it). Ficheiro inexistente/inválido = ninguém saltado.
 */
export function weeklySentEmails(
  raw: unknown,
  market: string,
  alerts: AlertRef[],
  day: string,
  timeZone: string,
): Set<string> {
  const out = new Set<string>();
  const site = (raw as Record<string, unknown> | null | undefined)?.[market];
  if (!site || typeof site !== "object") return out;
  const entries = site as Record<string, { date?: unknown; sentAt?: unknown } | null>;
  for (const alert of alerts) {
    const entry = entries[alert.id];
    if (!entry || typeof entry !== "object") continue;
    const sentDay = localDay(entry.sentAt, timeZone) || (typeof entry.date === "string" ? entry.date : "");
    if (sentDay === day) out.add(alert.email.toLowerCase());
  }
  return out;
}

/** Início da janela de vagas para um endereço: a mais antiga entre a janela normal e o `carryOver`. */
export function effectiveSince(
  sinceMs: number,
  carryOver: Record<string, string> | undefined,
  email: string,
  floorMs: number,
): number {
  const carried = Date.parse(carryOver?.[email] ?? "");
  if (Number.isNaN(carried)) return sinceMs;
  return Math.max(Math.min(sinceMs, carried), floorMs);
}
