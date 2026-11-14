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

export function isIndexableJob(job: Pick<Job, "title" | "profession">): boolean {
  const title = job.title || "";
  if (TALENT_POOL_RE.test(title) || ALWAYS_EXCLUDE_RE.test(title)) return false;
  if (NON_CLINICAL_RE.test(title) && !HEALTH_HINT_RE.test(title)) return false;
  if (job.profession === "Outros" && !HEALTH_HINT_RE.test(title)) return false;
  return true;
}
