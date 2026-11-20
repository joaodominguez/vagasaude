import type { Metadata } from "next";
import { CalendarView } from "@/components/calendar-view";
import { ConcorsiLanding } from "@/components/concorsi-landing";
import { buildCalendar, dayLabel, monthLabel, monthName } from "@/lib/calendar";
import { concorsiDistricts, concorsiProfessions, listConcorsi } from "@/lib/concorsi";
import { plural } from "@/lib/concorsi-hubs";
import { getJobs } from "@/lib/jobs-data";
import { SITE_NAME, truncateMeta } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = 600;

export const CALENDAR_PATH = "/concorsi/calendario";

function nowParts() {
  const parts = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" }).split("-").map(Number);
  return { year: parts[0], month: parts[1] - 1 };
}

export async function generateMetadata(): Promise<Metadata> {
  const { year, month } = nowParts();
  const cal = buildCalendar(listConcorsi(await getJobs()));
  const n = cal.entries.filter((e) => e.kind === "scadenza").length;
  const title = `Calendario concorsi sanità ${monthName(month)} ${year}`;
  const description = truncateMeta(
    `Calendario dei concorsi e degli avvisi pubblici della sanità: ${n} scadenze mese per mese, con filtri per regione e professione e link al bando ufficiale. Aggiornato ogni giorno su ${SITE_NAME}.`,
    160,
  );
  return {
    title,
    description,
    alternates: { canonical: CALENDAR_PATH },
    openGraph: { title, description, url: CALENDAR_PATH, type: "website", siteName: SITE_NAME, locale: "it_IT" },
    twitter: { card: "summary_large_image", title, description },
    ...(n === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CalendarPage() {
  const items = listConcorsi(await getJobs());
  const cal = buildCalendar(items);
  const { year, month } = nowParts();
  const deadlines = cal.entries.filter((e) => e.kind === "scadenza");
  const exams = cal.entries.filter((e) => e.kind === "prova");
  const thisMonthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const thisMonth = deadlines.filter((e) => e.day.startsWith(thisMonthKey)).length;
  const next = cal.months[1] ?? null;
  const nextCount = next ? deadlines.filter((e) => e.day.startsWith(next)).length : 0;

  const months = cal.months.map((key) => ({ key, label: monthLabel(key) }));
  const dayLabels: Record<string, string> = {};
  for (const e of cal.entries) dayLabels[e.day] = dayLabel(e.day);

  const intro = [
    `Il calendario dei concorsi nella sanità raccoglie le scadenze dei ${plural(items.length, "bando aperto", "bandi aperti")} tra concorsi pubblici, avvisi a tempo determinato, mobilità e incarichi, ordinati giorno per giorno. ${thisMonth > 0 ? `A ${monthName(month)} ${year} ci sono ${plural(thisMonth, "scadenza", "scadenze")}${next && nextCount > 0 ? `, a ${monthLabel(next)} ${plural(nextCount, "scadenza", "scadenze")}` : ""}.` : ""}`,
    `Le date sono quelle indicate dalla fonte ufficiale di ciascun bando. ${exams.length > 0 ? `Quando il testo del bando riporta in modo esplicito la data di una prova scritta o preselettiva la mostriamo qui (${exams.length} al momento); ` : ""}non deduciamo né stimiamo date di prova: il calendario ufficiale delle prove lo pubblica l'ente, di solito sul proprio sito e sul portale inPA. ${cal.withoutDeadline > 0 ? `${plural(cal.withoutDeadline, "bando", "bandi")} non ${cal.withoutDeadline === 1 ? "indica" : "indicano"} una scadenza e ${cal.withoutDeadline === 1 ? "non compare" : "non compaiono"} nel calendario.` : ""}`,
  ];

  const faq = [
    {
      q: "Come si usa il calendario dei concorsi?",
      a: "Scegli regione e professione con i filtri: l'elenco mostra solo le scadenze che ti riguardano, in ordine di data. Ogni voce rimanda alla scheda del bando, con il link alla fonte ufficiale dove si presenta la domanda.",
    },
    {
      q: "La data indicata è la scadenza per presentare la domanda?",
      a: "Sì: «Scadenza domande» è il termine per inviare la candidatura, come riportato dalla fonte. Le voci «Prova scritta» o «Preselezione» compaiono solo se il bando ne indica la data in modo esplicito.",
    },
    {
      q: "Dove trovo le date delle prove di un concorso?",
      a: "Nel bando, nell'avviso di convocazione o nella sezione «Concorsi» del sito dell'ente. I tempi di preavviso sono fissati dalla normativa sui concorsi e dal bando: verifica sempre il testo ufficiale.",
    },
    {
      q: "Cosa succede se una scadenza viene prorogata?",
      a: "Quando la fonte aggiorna la data, la scheda e il calendario si aggiornano alla successiva rilevazione. Per i bandi in chiusura controlla comunque il sito dell'ente.",
    },
    {
      q: "Dove vedo i bandi che scadono prima?",
      a: "Nella pagina dei concorsi in scadenza trovi i bandi che chiudono entro 7 e 14 giorni, per professione.",
    },
  ];

  return (
    <ConcorsiLanding
      crumbs={[{ label: "Home", href: "/" }, { label: "Concorsi", href: "/concorsi" }, { label: "Calendario" }]}
      h1={`Calendario concorsi sanità ${monthName(month)} ${year}`}
      subline={`${plural(deadlines.length, "scadenza", "scadenze")} in ${months.length} ${months.length === 1 ? "mese" : "mesi"}${exams.length ? ` · ${plural(exams.length, "data di prova", "date di prova")}` : ""}`}
      intro={intro}
      chipGroups={[]}
      sections={[
        {
          id: "calendario",
          title: "Scadenze mese per mese",
          node: (
            <CalendarView
              entries={cal.entries}
              months={months}
              dayLabels={dayLabels}
              districts={concorsiDistricts(items).map(([d]) => d).sort((a, b) => a.localeCompare(b, "it"))}
              professions={concorsiProfessions(items).map(([p]) => p)}
            />
          ),
        },
      ]}
      faq={faq}
      alert={{ text: "Ricevi via email i nuovi bandi per la tua professione e regione, prima che scadano." }}
      related={[
        {
          title: "Pagine utili",
          links: [
            { label: "Concorsi in scadenza (7 e 14 giorni)", href: "/concorsi/in-scadenza" },
            { label: "Tutti i concorsi aperti", href: "/concorsi" },
            { label: "Concorsi infermieri 2026", href: "/concorsi-infermieri-2026" },
            { label: "Concorsi OSS 2026", href: "/concorsi-oss-2026" },
            { label: "Calcolo punteggio titoli", href: "/strumenti/calcolo-punteggio-concorso" },
          ],
        },
      ]}
    />
  );
}
