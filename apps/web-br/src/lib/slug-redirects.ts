/**
 * URLs de vagas que o Google tinha indexados (com cliques/impressões no GSC) e que passaram a 404
 * quando o jobs.json foi recriado em 2026-10-27: a mesma vaga (mesmo id da fonte) existe com outro
 * slug. 301 para o slug atual, para o Google transferir a posição em vez de recomeçar do zero.
 * Só entram pares verificados (mesmo id da fonte; vaga destino publicada) — 2026-11-09.
 * Só atua em slugs que dariam 404; nenhuma página existente muda.
 */
export const LEGACY_SLUG_REDIRECTS: Record<string, string> = {
  "auxiliar-de-coleta-laboratorio-hospital-hospital-ifor-rede-d-or-12478885": "auxiliar-de-coleta-laboratorio-hospital-hospital-sao-bernardo-rede-d-or-12478885",
  "auxiliar-de-rouparia-sabara-hospital-infantil-sabara-12668629": "auxiliar-de-rouparia-expansao-sabara-2027-sabara-hospital-infantil-sabara-12668629",
  "enfermeira-o-uni-maternidade-perinatal-barra-d-or-rede-d-or-11766253": "enfermeira-o-uni-maternidade-perinatal-rede-d-or-11766253",
  "enfermeiro-caps-regiao-butanta-30-horas-periodo-tarde-rast-butanta-12747692": "enfermeiro-caps-regiao-butanta-rast-butanta-12747692",
  "enfermeiro-hospital-dia-regiao-do-butanta-6x1-periodo-tarde-rast-butanta-12747481": "enfermeiro-hospital-dia-regiao-do-butanta-6x1-rast-butanta-12747481",
  "enfermeiro-ubs-estrategia-de-saude-da-familia-regiao-do-butanta-rast-butanta-12747760": "enfermeiro-atencao-primaria-a-saude-regiao-do-butanta-rast-butanta-12747760",
  "gerente-administrativo-jr-honorarios-medicos-corporativo-sp-rede-d-or-12740441": "gerente-excelencia-estrategica-jr-honorarios-medicos-corporativo-sp-rede-d-or-12740441",
  "pessoa-tecnica-de-enfermagem-radioterapia-hospital-alemao-oswaldo-cruz-geral-12757264": "pessoa-tecnica-de-radioterapia-hospital-alemao-oswaldo-cruz-geral-12757264",
  "tecnico-a-de-enfermagem-centro-cirurgico-rede-americas-10734612": "tecnico-a-de-enfermagem-centro-cirurgico-rede-americas-vagas-10734612",
  "tecnico-de-enfermagem-caps-ij-butanta-das-13-00-as-19-00-vaga-temporaria-rast-butanta-12746250": "tecnico-de-enfermagem-caps-ij-butanta-rast-butanta-12746250",
  "tecnico-de-enfermagem-emergencia-pronto-socorro-rede-americas-10734436": "tecnico-de-enfermagem-emergencia-pronto-socorro-rede-americas-vagas-10734436",
  "tecnico-de-enfermagem-ubs-esf-regiao-do-butanta-rast-butanta-12746465": "tecnico-de-enfermagem-atencao-primaria-regiao-do-butanta-rast-butanta-12746465",
};
