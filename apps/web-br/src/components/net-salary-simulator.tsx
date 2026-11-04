"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatBRL2, netSalary } from "@/lib/salary-tables";

function parseMoney(text: string) {
  const cleaned = text.trim().replace(/[R$\s]/g, "");
  if (!cleaned) return 0;
  // "1.234,56" -> 1234.56 ; "1234.56" -> 1234.56
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  return Number(normalized);
}

/** Simulador de salário líquido CLT 2026 (INSS + IRRF com a redução da Lei 15.270/2025). */
export function NetSalarySimulator({ initialGross = 3325 }: { initialGross?: number }) {
  const [gross, setGross] = useState(String(initialGross).replace(".", ","));
  const [dependents, setDependents] = useState(0);
  const [other, setOther] = useState("");
  const value = parseMoney(gross);
  const otherValue = parseMoney(other);
  const result = useMemo(
    () =>
      Number.isFinite(value) && value > 0
        ? netSalary(value, dependents, Number.isFinite(otherValue) && otherValue > 0 ? otherValue : 0)
        : null,
    [value, dependents, otherValue],
  );

  return (
    <div className="content-card p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          Salário bruto mensal (R$)
          <input
            inputMode="decimal"
            value={gross}
            onChange={(event) => setGross(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base"
          />
        </label>
        <label className="text-sm font-semibold">
          Dependentes
          <div className="relative mt-1.5">
            <select
              value={dependents}
              onChange={(event) => setDependents(Number(event.target.value))}
              className="w-full cursor-pointer appearance-none rounded-xl border border-border bg-background py-2.5 pl-3 pr-10 text-base"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <ChevronDown
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>
        </label>
        <label className="text-sm font-semibold">
          Outros descontos (opcional, R$)
          <input
            inputMode="decimal"
            value={other}
            placeholder="plano de saúde, VT…"
            onChange={(event) => setOther(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base"
          />
        </label>
      </div>

      {result && (
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-5">
          <div>
            <dt className="text-muted">Bruto</dt>
            <dd className="text-lg font-bold">{formatBRL2(result.gross)}</dd>
          </div>
          <div>
            <dt className="text-muted">INSS</dt>
            <dd className="text-lg font-bold">− {formatBRL2(result.inss)}</dd>
          </div>
          <div>
            <dt className="text-muted">IRRF</dt>
            <dd className="text-lg font-bold">− {formatBRL2(result.irrf)}</dd>
          </div>
          <div>
            <dt className="text-muted">Alíquota efetiva</dt>
            <dd className="text-lg font-bold">
              {(result.effectiveRate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </dd>
          </div>
          <div>
            <dt className="text-muted">Líquido estimado</dt>
            <dd className="text-2xl font-extrabold text-primary">{formatBRL2(result.net)}</dd>
          </div>
        </dl>
      )}
      {result && (
        <p className="mt-3 text-xs leading-5 text-muted">
          IRRF calculado com {result.deductionKind === "simplificado" ? "o desconto simplificado (R$ 607,20)" : "as deduções legais (INSS e dependentes)"}
          {result.reduction > 0 ? `, com redução da Lei 15.270/2025 de ${formatBRL2(result.reduction)}` : ""}.
          Base de cálculo: {formatBRL2(result.base)}.
        </p>
      )}
      <p className="mt-4 text-xs leading-5 text-muted">
        Estimativa para empregado CLT em 2026 (INSS: Portaria Interministerial MPS/MF nº 13/2026;
        IRRF: tabela da Receita Federal e redução da Lei 15.270/2025, que zera o imposto até R$ 5.000
        e reduz gradualmente até R$ 7.350). Não inclui adicionais, horas extras, pensão alimentícia ou
        previdência privada. O 13º salário é tributado separadamente, e nas férias o terço
        constitucional entra na base; use o valor como referência, não como holerite.
      </p>
    </div>
  );
}
