import {
  formatBRL2,
  type OfficialRow,
  type OfficialTable,
} from "@/lib/salary-tables";

function SourceLink({ row }: { row: OfficialRow }) {
  return (
    <a href={row.source.url} className="underline" rel="noopener" target="_blank">
      {row.source.label}
    </a>
  );
}

/** Bloco "Tabelas e pisos oficiais": uma tabela por fonte, com URL e ano por linha. */
export function SalaryOfficialTables({ tables, heading = "Tabelas e pisos oficiais" }: { tables: OfficialTable[]; heading?: string }) {
  if (tables.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-extrabold">{heading}</h2>
      {tables.map((table) => (
        <div key={table.title} className="content-card overflow-x-auto p-5">
          <h3 className="font-extrabold">{table.title}</h3>
          <table className="mt-4 w-full min-w-[34rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="pb-2 font-extrabold">Cargo</th>
                <th className="pb-2 font-extrabold">Jornada</th>
                <th className="pb-2 text-right font-extrabold">Valor mensal</th>
                <th className="pb-2 pl-4 font-extrabold">Fonte</th>
                <th className="pb-2 pl-3 font-extrabold">Ano</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.name + row.workload} className="border-t border-border align-top">
                  <td className="py-2.5 pr-3">{row.name}</td>
                  <td className="py-2.5 text-muted">{row.workload}</td>
                  <td className="py-2.5 text-right font-semibold">{formatBRL2(row.value)}</td>
                  <td className="py-2.5 pl-4 text-xs text-muted">
                    <SourceLink row={row} />
                  </td>
                  <td className="py-2.5 pl-3 text-muted">{row.year}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {table.note && <p className="mt-3 text-xs leading-5 text-muted">{table.note}</p>}
        </div>
      ))}
    </section>
  );
}
