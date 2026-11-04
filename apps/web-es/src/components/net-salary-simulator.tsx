"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  formatEur,
  netSalary,
  type ContractType,
  type HouseholdType,
} from "@/lib/salary-tables";

const HOUSEHOLDS: Array<{ value: HouseholdType; label: string }> = [
  { value: "single", label: "Soltero/a, sin hijos" },
  { value: "single_parent", label: "Soltero/a o separado/a con hijos a cargo" },
  { value: "married_one", label: "Casado/a, cónyuge sin rentas (> 1.500 €)" },
  { value: "married_two", label: "Casado/a u otras situaciones" },
];

const CONTRACTS: Array<{ value: ContractType; label: string }> = [
  { value: "indefinido", label: "Indefinido / fijo" },
  { value: "temporal", label: "Temporal / interino" },
];

const SELECT_CLASS =
  "w-full cursor-pointer appearance-none rounded-xl border border-border bg-background py-2.5 pl-3 pr-10 text-base disabled:opacity-50";

function Select({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string | number;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mt-1.5">
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={SELECT_CLASS}
      >
        {children}
      </select>
      <ChevronDown
        size={18}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  );
}

/** Simulador de sueldo neto (Seguridad Social 2026 + retención de IRPF según AEAT 2026). Estimación. */
export function NetSalarySimulator({ initialAnnual = 30000 }: { initialAnnual?: number }) {
  const [gross, setGross] = useState(String(Math.round(initialAnnual)));
  const [payments, setPayments] = useState<12 | 14>(14);
  const [household, setHousehold] = useState<HouseholdType>("single");
  const [contract, setContract] = useState<ContractType>("indefinido");
  const [children, setChildren] = useState(0);
  const [under3, setUnder3] = useState(0);
  const value = Number(gross.replace(/\./g, "").replace(",", "."));
  const result = useMemo(
    () =>
      Number.isFinite(value) && value > 0
        ? netSalary({
            annualGross: value,
            payments,
            household,
            children,
            childrenUnder3: Math.min(under3, children),
            contract,
          })
        : null,
    [value, payments, household, children, under3, contract],
  );

  return (
    <div className="content-card p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          Sueldo bruto anual (€)
          <input
            inputMode="decimal"
            value={gross}
            onChange={(event) => setGross(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base"
          />
        </label>
        <label className="text-sm font-semibold">
          Número de pagas
          <Select value={payments} onChange={(v) => setPayments(Number(v) === 12 ? 12 : 14)}>
            <option value={14}>14 pagas (12 + 2 extras)</option>
            <option value={12}>12 pagas (extras prorrateadas)</option>
          </Select>
        </label>
        <label className="text-sm font-semibold">
          Tipo de contrato
          <Select value={contract} onChange={(v) => setContract(v as ContractType)}>
            {CONTRACTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm font-semibold sm:col-span-3">
          Situación familiar
          <Select value={household} onChange={(v) => setHousehold(v as HouseholdType)}>
            {HOUSEHOLDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm font-semibold">
          Hijos menores de 25 años
          <Select
            value={children}
            onChange={(v) => {
              const n = Number(v);
              setChildren(n);
              setUnder3((current) => Math.min(current, n));
            }}
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm font-semibold">
          De ellos, menores de 3 años
          <Select value={under3} disabled={children === 0} onChange={(v) => setUnder3(Number(v))}>
            {Array.from({ length: children + 1 }, (_, n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {result && (
        <>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted">Bruto anual</dt>
              <dd className="text-lg font-bold">{formatEur(result.annualGross)}</dd>
            </div>
            <div>
              <dt className="text-muted">Seguridad Social (anual)</dt>
              <dd className="text-lg font-bold">− {formatEur(result.socialSecurity)}</dd>
            </div>
            <div>
              <dt className="text-muted">
                IRPF ({(result.irpfRate * 100).toLocaleString("es-ES", { maximumFractionDigits: 2 })} %)
              </dt>
              <dd className="text-lg font-bold">− {formatEur(result.irpf)}</dd>
            </div>
            <div>
              <dt className="text-muted">Neto anual</dt>
              <dd className="text-lg font-bold">{formatEur(result.annualNet)}</dd>
            </div>
          </dl>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted">Neto mensual equivalente (anual ÷ 12)</dt>
              <dd className="text-2xl font-extrabold text-primary">
                {formatEur(result.netMonthlyEquivalent)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">
                {payments === 14 ? "Neto de cada paga ordinaria" : "Neto de cada mensualidad"}
              </dt>
              <dd className="text-lg font-bold">{formatEur(result.netOrdinaryPayment)}</dd>
            </div>
            {result.netExtraPayment !== null && (
              <div>
                <dt className="text-muted">Neto de cada paga extra</dt>
                <dd className="text-lg font-bold">{formatEur(result.netExtraPayment)}</dd>
              </div>
            )}
          </dl>
        </>
      )}
      <p className="mt-4 text-xs leading-5 text-muted">
        Estimación (no es una nómina). Seguridad Social 2026 a cargo del trabajador: contingencias
        comunes 4,70 %, MEI 0,15 %, formación profesional 0,10 % y desempleo 1,55 % (indefinido) o
        1,60 % (temporal), con tope de base de 5.101,20 €/mes (Orden PJC/297/2026). IRPF: retención
        con el procedimiento general de la AEAT 2026 (escala estatal + autonómica del art. 101 LIRPF,
        gasto deducible de 2.000 €, reducción por rendimientos del trabajo y mínimos personal y
        familiar). No incluye País Vasco ni Navarra (régimen foral), pluriempleo, pensiones
        compensatorias, discapacidad, ascendientes, trienios ni complementos variables. La retención
        no es el impuesto final: se regulariza en la declaración de la renta.
      </p>
    </div>
  );
}
