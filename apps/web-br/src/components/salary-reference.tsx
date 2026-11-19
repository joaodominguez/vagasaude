import Link from "next/link";
import type { Job } from "@/lib/jobs";
import { toCategorySlug } from "@/lib/categories";
import { formatBRL, formatBRLRange, getSalaryBenchmark } from "@/lib/salary-benchmarks";
import { listSalaryPages, salaryRoleForTitle } from "@/lib/salary-observatory";

// As páginas de salário varrem todas as vagas: guardar o resultado alguns minutos em memória
// para não repetir o cálculo em cada página de vaga renderizada.
const PAGES_TTL_MS = 10 * 60 * 1000;
let pagesMemo: { at: number; value: Promise<Awaited<ReturnType<typeof listSalaryPages>>> } | null = null;

function salaryPages() {
  if (!pagesMemo || Date.now() - pagesMemo.at > PAGES_TTL_MS) {
    pagesMemo = { at: Date.now(), value: listSalaryPages() };
  }
  return pagesMemo.value;
}

/**
 * Caixa âmbar «Referência salarial · não é desta vaga»: mediana dos salários anunciados
 * pelos empregadores para a mesma função (observatório), com ligação à página de salário.
 * Sem página do observatório, usa a média da profissão (salary-benchmarks).
 */
export async function SalaryReference({ job }: { job: Pick<Job, "title" | "profession" | "sector" | "district"> }) {
  const role = salaryRoleForTitle(job.title);
  const pages = role ? await salaryPages() : [];
  const stateSlug = job.district ? toCategorySlug(job.district) : "";
  const page =
    role &&
    (pages.find((p) => p.role.slug === role.slug && p.district && toCategorySlug(p.district) === stateSlug) ??
      pages.find((p) => p.role.slug === role.slug && !p.district));

  if (role && page) {
    const { stats } = page;
    const where = page.district ? ` em ${page.district}` : " no Brasil";
    return (
      <aside className="salary-ref" aria-label="Referência salarial">
        <span className="salary-ref-k">Referência salarial · não é desta vaga</span>
        <p className="salary-ref-v">
          ≈ {formatBRL(Math.round(stats.median))} <small>brutos/mês</small>
        </p>
        <p>
          Mediana de {stats.count} vagas de {role.label}
          {where} com salário anunciado (a maioria entre {formatBRL(Math.round(stats.p25))} e{" "}
          {formatBRL(Math.round(stats.p75))}).
          {role.floor ? ` Piso legal nacional (44 h): ${formatBRL(role.floor.value)}.` : ""}
        </p>
        <Link href={page.path} prefetch={false}>
          Ver a página de salário de {role.label}
        </Link>
      </aside>
    );
  }

  const benchmark = getSalaryBenchmark(job.profession, job.title, job.sector);
  return (
    <aside className="salary-ref" aria-label="Referência salarial">
      <span className="salary-ref-k">Referência salarial · não é desta vaga</span>
      <p className="salary-ref-v">
        ≈ {formatBRL(benchmark.average)} <small>brutos/mês</small>
      </p>
      <p>
        Média de {benchmark.label} no Brasil (tipicamente {formatBRLRange(benchmark.low, benchmark.high)}).
      </p>
      <Link href="/salarios" prefetch={false}>
        Ver salários por profissão
      </Link>
    </aside>
  );
}
