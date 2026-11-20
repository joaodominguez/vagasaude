"use client";

import { useMemo, useState } from "react";

type Mode = "tre" | "due";

/** Ripartizioni di ESEMPIO: la norma (art. 8 DPR 220/2001) fissa solo il totale; la ripartizione fra le categorie la decide il bando. */
const PRESETS: Record<Mode, { titoli: number; prove: number; max: [number, number, number, number]; exams: Array<[string, number]> }> = {
  tre: { titoli: 30, prove: 70, max: [15, 5, 4, 6], exams: [["Prova scritta", 30], ["Prova pratica", 20], ["Prova orale", 20]] },
  due: { titoli: 40, prove: 60, max: [20, 7, 5, 8], exams: [["Prova pratica", 30], ["Prova orale", 30]] },
};

const num = (value: string) => {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const fmt = (n: number) => n.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const cap = (value: number, max: number) => Math.max(0, Math.min(value, max));

type Field = { value: string; set: (v: string) => void };
function useField(initial = ""): Field {
  const [value, set] = useState(initial);
  return { value, set };
}

function NumberInput({ id, label, hint, field, suffix, step = "1" }: { id: string; label: string; hint?: string; field: Field; suffix?: string; step?: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          value={field.value}
          onChange={(e) => field.set(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium"
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        {suffix && <span className="shrink-0 text-sm text-muted">{suffix}</span>}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs leading-5 text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function ScoreCalculator() {
  const [mode, setMode] = useState<Mode>("tre");
  const preset = PRESETS[mode];
  const [bando, setBando] = useState("");

  // Massimi per categoria (modificabili)
  const maxCar = useField(String(PRESETS.tre.max[0]));
  const maxAcc = useField(String(PRESETS.tre.max[1]));
  const maxPub = useField(String(PRESETS.tre.max[2]));
  const maxCur = useField(String(PRESETS.tre.max[3]));

  // Carriera
  const ppa = useField("1.2");
  const mSsn = useField("");
  const mInf = useField("");
  const fInf = useField("50");
  const mPriv = useField("");
  const fPriv = useField("25");
  const mEst = useField("");

  // Accademici e di studio
  const [titles, setTitles] = useState<Array<{ id: string; label: string; on: boolean; pts: string }>>([
    { id: "lm", label: "Laurea magistrale o specialistica attinente", on: false, pts: "1.5" },
    { id: "m1", label: "Master universitario di 1° livello", on: false, pts: "1" },
    { id: "m2", label: "Master universitario di 2° livello", on: false, pts: "1.5" },
    { id: "dott", label: "Dottorato di ricerca / specializzazione", on: false, pts: "2" },
    { id: "alt", label: "Altra laurea o diploma attinente", on: false, pts: "1" },
  ]);

  // Pubblicazioni e curriculum
  const nPub = useField("");
  const pPub = useField("0.25");
  const cur = useField("");

  // Prove (facoltativo)
  const exam = [useField(""), useField(""), useField("")];

  const [copied, setCopied] = useState(false);

  const r = useMemo(() => {
    const mx = [num(maxCar.value), num(maxAcc.value), num(maxPub.value), num(maxCur.value)];
    const eq = num(mSsn.value) + num(mEst.value) + (num(mInf.value) * num(fInf.value)) / 100 + (num(mPriv.value) * num(fPriv.value)) / 100;
    const carRaw = (eq / 12) * num(ppa.value);
    const accRaw = titles.filter((t) => t.on).reduce((s, t) => s + num(t.pts), 0);
    const pubRaw = num(nPub.value) * num(pPub.value);
    const curRaw = num(cur.value);
    const rows = [
      { name: "Titoli di carriera", raw: carRaw, max: mx[0] },
      { name: "Titoli accademici e di studio", raw: accRaw, max: mx[1] },
      { name: "Pubblicazioni e titoli scientifici", raw: pubRaw, max: mx[2] },
      { name: "Curriculum formativo e professionale", raw: curRaw, max: mx[3] },
    ].map((row) => ({ ...row, pts: cap(row.raw, row.max) }));
    const sumMax = mx.reduce((a, b) => a + b, 0);
    const titoli = Math.min(rows.reduce((s, row) => s + row.pts, 0), preset.titoli);
    const prove = preset.exams.map(([, m], i) => cap(num(exam[i].value), m));
    const proveFilled = preset.exams.some((_, i) => exam[i].value !== "");
    const proveTot = prove.reduce((a, b) => a + b, 0);
    return { rows, sumMax, titoli, equivMonths: eq, proveFilled, proveTot, total: titoli + proveTot };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxCar.value, maxAcc.value, maxPub.value, maxCur.value, ppa.value, mSsn.value, mInf.value, fInf.value, mPriv.value, fPriv.value, mEst.value, titles, nPub.value, pPub.value, cur.value, mode, exam[0].value, exam[1].value, exam[2].value]);

  function switchMode(next: Mode) {
    setMode(next);
    const m = PRESETS[next].max;
    maxCar.set(String(m[0]));
    maxAcc.set(String(m[1]));
    maxPub.set(String(m[2]));
    maxCur.set(String(m[3]));
    exam.forEach((f) => f.set(""));
  }

  const summary = () =>
    [
      `Stima punteggio titoli${bando ? ` (bando: ${bando})` : ""}: ${fmt(r.titoli)} / ${preset.titoli}`,
      ...r.rows.map((row) => `- ${row.name}: ${fmt(row.pts)} / ${fmt(row.max)}`),
      "Stima indicativa (DPR 220/2001, art. 8 e 11): i coefficienti reali sono quelli del bando. Calcolata su offertesanita.it/strumenti/calcolo-punteggio-concorso",
    ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard non disponibile */
    }
  }

  const card = "rounded-2xl border border-border bg-surface p-5";
  const legend = "px-1 text-base font-extrabold";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="min-w-0 space-y-6">
        <div className="rounded-2xl border p-4 text-sm leading-6" role="note" style={{ borderColor: "var(--amber-border)", background: "var(--amber-soft)", color: "var(--foreground)" }}>
          <strong>Stima indicativa.</strong> I punti per anno di servizio, i massimi di ogni categoria e i punteggi dei titoli accademici
          cambiano da bando a bando: i valori già inseriti sono solo esempi. Sostituiscili con quelli del bando a cui partecipi.
        </div>

        <fieldset className={card}>
          <legend className={legend}>1. Tipo di concorso</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {([
              ["tre", "Tre prove: scritta, pratica e orale", "30 punti ai titoli, 70 alle prove"],
              ["due", "Due prove: pratica e orale", "40 punti ai titoli, 60 alle prove"],
            ] as Array<[Mode, string, string]>).map(([value, label, sub]) => (
              <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${mode === value ? "border-primary bg-primary-soft" : "border-border"}`}>
                <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => switchMode(value)} className="mt-1" />
                <span>
                  <span className="block text-sm font-bold">{label}</span>
                  <span className="block text-xs text-muted">{sub} (art. 8, commi 3 e 4)</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4">
            <label htmlFor="bando" className="block text-sm font-bold">
              Bando di riferimento (facoltativo)
            </label>
            <input
              id="bando"
              type="text"
              value={bando}
              onChange={(e) => setBando(e.target.value)}
              placeholder="es. Concorso collaboratore professionale sanitario infermiere, ASL…"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
          </div>
        </fieldset>

        <fieldset className={card}>
          <legend className={legend}>2. Massimi per categoria di titoli</legend>
          <p className="mt-1 text-sm leading-6 text-muted">
            La ripartizione dei {preset.titoli} punti fra le quattro categorie è stabilita dal bando (art. 8, comma 3): copia i massimi dal tuo bando.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <NumberInput id="max-car" label="Titoli di carriera (max)" field={maxCar} step="0.5" />
            <NumberInput id="max-acc" label="Titoli accademici e di studio (max)" field={maxAcc} step="0.5" />
            <NumberInput id="max-pub" label="Pubblicazioni e titoli scientifici (max)" field={maxPub} step="0.5" />
            <NumberInput id="max-cur" label="Curriculum formativo e professionale (max)" field={maxCur} step="0.5" />
          </div>
          {Math.abs(r.sumMax - preset.titoli) > 0.001 && (
            <p className="mt-3 text-sm font-semibold" style={{ color: "var(--danger)" }} role="alert">
              I massimi sommano {fmt(r.sumMax)} punti, ma il totale dei titoli è {preset.titoli}: il risultato non supererà comunque {preset.titoli}.
            </p>
          )}
        </fieldset>

        <fieldset className={card}>
          <legend className={legend}>3. Titoli di carriera: mesi di servizio</legend>
          <p className="mt-1 text-sm leading-6 text-muted">
            Le frazioni di anno si valutano a mese; i servizi contemporanei contano una volta sola, quello più favorevole (art. 11, comma 1, lett. a).
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <NumberInput id="ppa" label="Punti per anno di servizio nel profilo" field={ppa} step="0.01" hint="Valore del bando (qui un esempio)." />
            <NumberInput id="m-ssn" label="Mesi di servizio nel profilo a concorso" field={mSsn} suffix="mesi" hint="SSN e altre PA, anche a tempo determinato (art. 11 e art. 20, comma 1)." />
            <NumberInput id="m-inf" label="Mesi in categoria inferiore" field={mInf} suffix="mesi" hint="Esempio: OSS per un concorso da infermiere." />
            <NumberInput id="f-inf" label="Quota riconosciuta per la categoria inferiore" field={fInf} suffix="%" hint="Al massimo il 50% (art. 11, comma 1, lett. a, n. 1)." />
            <NumberInput id="m-priv" label="Mesi in strutture private accreditate o convenzionate" field={mPriv} suffix="mesi" hint="Valutati per il 25% della durata (art. 21, comma 3)." />
            <NumberInput id="f-priv" label="Quota riconosciuta per il privato accreditato" field={fPriv} suffix="%" hint="25% nel testo del DPR; modificala se il bando dispone diversamente." />
            <NumberInput id="m-est" label="Mesi di servizio all'estero riconosciuto" field={mEst} suffix="mesi" hint="Come servizio di ruolo se riconosciuto (art. 22)." />
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">
            Tempo parziale: inserisci i mesi proporzionati all&apos;orario (art. 11, comma 1, lett. a, n. 4). Mesi equivalenti calcolati: <strong>{fmt(r.equivMonths)}</strong>.
          </p>
        </fieldset>

        <fieldset className={card}>
          <legend className={legend}>4. Titoli accademici e di studio</legend>
          <p className="mt-1 text-sm leading-6 text-muted">
            Li valuta la commissione, con motivazione, in base all&apos;attinenza al profilo (art. 11, comma 1, lett. b). Spunta quelli che possiedi e modifica i punti secondo il bando.
          </p>
          <ul className="mt-3 space-y-3">
            {titles.map((t, i) => (
              <li key={t.id} className="grid grid-cols-[1fr_6.5rem] items-center gap-3">
                <label className="flex items-start gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={t.on}
                    onChange={(e) => setTitles((all) => all.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))}
                    className="mt-1"
                  />
                  {t.label}
                </label>
                <div>
                  <label htmlFor={`pts-${t.id}`} className="sr-only">
                    Punti per {t.label}
                  </label>
                  <input
                    id={`pts-${t.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={t.pts}
                    onChange={(e) => setTitles((all) => all.map((x, j) => (j === i ? { ...x, pts: e.target.value } : x)))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className={card}>
          <legend className={legend}>5. Pubblicazioni e curriculum</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <NumberInput id="n-pub" label="Pubblicazioni e titoli scientifici valutabili" field={nPub} hint="Numero di lavori pertinenti (art. 11, comma 1, lett. c)." />
            <NumberInput id="p-pub" label="Punti per pubblicazione" field={pPub} step="0.05" hint="Valore del bando (qui un esempio)." />
            <NumberInput id="cur" label="Curriculum: punteggio stimato" field={cur} step="0.1" hint="Lo assegna la commissione in modo globale e motivato (art. 11): corsi con esame finale, incarichi di docenza, attività non già valutate." />
          </div>
        </fieldset>

        <fieldset className={card}>
          <legend className={legend}>6. Prove d&apos;esame (facoltativo)</legend>
          <p className="mt-1 text-sm leading-6 text-muted">Inserisci i voti ottenuti (o attesi) per vedere il punteggio complessivo su 100 (art. 8, comma 5).</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {preset.exams.map(([name, m], i) => (
              <NumberInput key={name} id={`exam-${i}`} label={`${name} (max ${m})`} field={exam[i]} step="0.01" />
            ))}
          </div>
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-24" aria-labelledby="risultato">
        <div className={card}>
          <h2 id="risultato" className="text-lg font-extrabold">
            Stima del punteggio
          </h2>
          <div role="status" aria-live="polite">
            <p className="mt-3 text-4xl font-extrabold tracking-[-0.04em] text-primary">
              {fmt(r.titoli)} <span className="text-lg font-bold text-muted">/ {preset.titoli}</span>
            </p>
            <p className="text-sm text-muted">punti stimati per i titoli</p>
            <table className="mt-4 w-full text-sm">
              <tbody>
                {r.rows.map((row) => (
                  <tr key={row.name} className="border-t border-border">
                    <th scope="row" className="py-2 pr-2 text-left font-medium">
                      {row.name}
                    </th>
                    <td className="py-2 text-right font-bold tabular-nums">
                      {fmt(row.pts)} <span className="font-normal text-muted">/ {fmt(row.max)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {r.proveFilled && (
              <p className="mt-4 border-t border-border pt-3 text-sm">
                Prove: <strong>{fmt(r.proveTot)}</strong> / {preset.prove}. Totale stimato:{" "}
                <strong className="text-primary">
                  {fmt(r.total)} / 100
                </strong>
              </p>
            )}
          </div>
          <button type="button" onClick={copy} className="mt-4 w-full rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:border-primary hover:text-primary">
            {copied ? "Copiato" : "Copia il riepilogo"}
          </button>
          <p className="mt-3 text-xs leading-5 text-muted">
            Strumento informativo: non sostituisce il bando né il giudizio della commissione. Non conserviamo i dati inseriti.
          </p>
        </div>
      </aside>
    </div>
  );
}
