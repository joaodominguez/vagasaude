import type { Job } from "@/lib/jobs";

/**
 * Recuperação BR (2026-11-14): só as vagas de saúde vão ao Google.
 *
 * Diagnóstico: o Google rastreava só ~13% das vagas publicadas e ignorava 98% das notificações da
 * Indexing API; 26% do catálogo eram funções não clínicas (call-center, jovem aprendiz, manutenção,
 * cozinha…) e havia ~160 "banco de talentos / cadastro reserva" (o Google desaconselha-os em
 * JobPosting). Estas páginas continuam acessíveis aos visitantes, mas ficam com noindex, sem
 * JobPosting e fora do sitemap (logo, fora da Indexing API), para o rastreio ir para as vagas de saúde.
 *
 * Administrativo (recepção hospitalar, contas médicas…) continua indexável: são vagas reais em
 * unidades de saúde, tal como no PT.
 */
const TALENT_POOL_RE =
  /banco de talentos|cadastro (de )?reserva|banco de curr[ií]culos|talent pool|candidatura espont[aâ]nea/i;

// Nunca são vagas clínicas, mesmo com palavra de saúde no título ("Jovem Aprendiz – Farmácia").
const ALWAYS_EXCLUDE_RE = /jovem aprendiz|\baprendiz\b|estagi[aá]ri|est[aá]gio\b|cozinh|copeir/i;

const NON_CLINICAL_RE =
  /cozinh|copeir|ascensorist|porteir|vigilant|\bvigia\b|eletricist|encanador|pedreir|\bpintor|jardineir|refrigera[cç]|manuten[cç][aã]o predial|oficial de manuten|ajudante de manuten|l[ií]der de manuten|controlador(a)? de acesso|jovem aprendiz|\baprendiz\b|estagi[aá]ri|call[- ]?center|operador(a)? de atendimento|agente de relacionamento|telemarketing|analista de (projetos|reten[cç][aã]o|controladoria|recursos humanos|marketing|sistemas|ti\b)|assistente de controladoria/i;

const HEALTH_HINT_RE =
  /enferm|m[eé]dic|fisioter|farm[aá]c|sa[uú]de|cl[ií]nic|laborat|radiolog|nutri|psic[oó]l|fono|terapeut|biom[eé]dic|odont|socorr|instrumentad|hemodi[aá]l|dentist|cuidador|paciente|assistencial/i;

/**
 * Recuperação BR (2026-11-18): vagas com mais de 90 dias saem do Google (continuam no site).
 *
 * Diagnóstico: 39% das vagas BR publicadas tinham mais de 60 dias e 15% mais de 6 meses (vagas
 * "sempre abertas" da Hapvida, hospitais Pandapé, Rede D'Or), contra 19%/6% no PT. O Google for Jobs
 * dá pouco peso a anúncios antigos e o rastreio BR caiu ~80% (780 → 160 vagas/dia): concentrar o
 * pouco rastreio nas vagas recentes. Data inválida ou ausente → não exclui.
 */
export const MAX_INDEXABLE_AGE_DAYS = 90;

function isTooOld(publishedAt: string | null | undefined, now: number): boolean {
  if (!publishedAt) return false;
  const time = Date.parse(publishedAt);
  if (Number.isNaN(time)) return false;
  return now - time > MAX_INDEXABLE_AGE_DAYS * 86_400_000;
}

export function isIndexableJob(
  job: Pick<Job, "title" | "profession"> & { publishedAt?: string | null },
  now: number = Date.now(),
): boolean {
  if (isTooOld(job.publishedAt, now)) return false;
  const title = job.title || "";
  if (TALENT_POOL_RE.test(title) || ALWAYS_EXCLUDE_RE.test(title)) return false;
  if (NON_CLINICAL_RE.test(title) && !HEALTH_HINT_RE.test(title)) return false;
  if (job.profession === "Outros" && !HEALTH_HINT_RE.test(title)) return false;
  return true;
}
