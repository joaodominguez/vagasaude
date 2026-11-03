"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatEur, netMonthly, type HouseholdType } from "@/lib/salary-tables";

const HOUSEHOLDS: Array<{ value: HouseholdType; label: string }> = [
  { value: "single", label: "Não casado, sem dependentes" },
  { value: "single_dependents", label: "Não casado, com dependentes" },
  { value: "married_two", label: "Casado, dois titulares" },
  { value: "married_one", label: "Casado, único titular" },
];

/** Simulador de salário líquido (retenção na fonte 2026, continente + 11% SS/CGA). */
export function NetSalarySimulator({ initialGross = 1657.04 }: { initialGross?: number }) {
  const [gross, setGross] = useState(String(initialGross));
  const [household, setHousehold] = useState<HouseholdType>("single");
  const [dependents, setDependents] = useState(0);
  const value = Number(gross.replace(",", "."));
  const result = useMemo(
    () => (Number.isFinite(value) && value > 0 ? netMonthly(value, household, dependents) : null),
    [value, household, dependents],
  );

  return (
    <div className="content-card p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          Salário bruto mensal (€)
          <input
            inputMode="decimal"
            value={gross}
            onChange={(event) => setGross(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base"
          />
        </label>
        <label className="text-sm font-semibold">
          Situação familiar
          <div className="relative mt-1.5">
<select
            value={household}
            onChange={(event) => setHousehold(event.target.value as HouseholdType)}
            className="w-full cursor-pointer appearance-none rounded-xl border border-border bg-background py-2.5 pl-3 pr-10 text-base"
          >
            {HOUSEHOLDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
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
          Dependentes
          <div className="relative mt-1.5">
<select
            value={dependents}
            disabled={household === "single"}
            onChange={(event) => setDependents(Number(event.target.value))}
            className="w-full cursor-pointer appearance-none rounded-xl border border-border bg-background py-2.5 pl-3 pr-10 text-base disabled:opacity-50"
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
      </div>

      {result && (
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">Bruto</dt>
            <dd className="text-lg font-bold">{formatEur(result.gross)}</dd>
          </div>
          <div>
            <dt className="text-muted">Segurança Social / CGA (11%)</dt>
            <dd className="text-lg font-bold">− {formatEur(result.socialSecurity)}</dd>
          </div>
          <div>
            <dt className="text-muted">Retenção de IRS</dt>
            <dd className="text-lg font-bold">− {formatEur(result.irs)}</dd>
          </div>
          <div>
            <dt className="text-muted">Líquido estimado</dt>
            <dd className="text-2xl font-extrabold text-primary">{formatEur(result.net)}</dd>
          </div>
        </dl>
      )}
      <p className="mt-4 text-xs leading-5 text-muted">
        Estimativa mensal com as tabelas de retenção na fonte de 2026 (Despacho n.º 233-A/2026,
        continente) e 11% de descontos. A retenção não é o imposto final (acerta-se no IRS anual)
        e não inclui subsídio de refeição, ADSE, suplementos nem horas extra.
      </p>
    </div>
  );
}
