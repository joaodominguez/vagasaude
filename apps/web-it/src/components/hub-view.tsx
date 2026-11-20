import Link from "next/link";
import { CardList, ConcorsiLanding } from "@/components/concorsi-landing";
import { categoryPath, isCategoryEligible } from "@/lib/categories";
import {
  concorsiDistricts,
  concorsiPath,
  currentYear,
  filterConcorsi,
  listEligibleConcorsi,
  type ConcorsoItem,
} from "@/lib/concorsi";
import {
  EXPIRING_LONG_DAYS,
  EXPIRING_PATH,
  EXPIRING_SHORT_DAYS,
  TYPE_PAGES,
  expiringItems,
  expiringProfessionPath,
  expiringProfessions,
  firstDeadlineText,
  itemListJsonLd,
  plural,
  todayLabel,
  topEmployersText,
  typeBreakdownText,
  typePagePath,
  type HubConfig,
} from "@/lib/concorsi-hubs";
import { inRegione } from "@/lib/it-locative";
import type { Job } from "@/lib/jobs";
import { isPublicJob } from "@/lib/job-type";
import { newsPath } from "@/lib/news";
import { careerFromSlug } from "@/lib/salary-tables";

const PER_REGION = 5;

/** Hub perenne «Concorsi infermieri 2026» / «Concorsi OSS 2026»: contenuto generato dai dati reali. */
export function HubView({ hub, all, jobs }: { hub: HubConfig; all: ConcorsoItem[]; jobs: Job[] }) {
  const items = filterConcorsi(all, hub.profession, null);
  const year = currentYear();
  const plain = hub.plural;
  const soon14 = expiringItems(items, EXPIRING_LONG_DAYS);
  const soon7 = expiringItems(items, EXPIRING_SHORT_DAYS);
  const districts = concorsiDistricts(items);
  const eligible = new Set(listEligibleConcorsi(all).map((ref) => ref.path));
  const privateCount = jobs.filter((job) => job.profession === hub.profession && !isPublicJob(job)).length;
  const offersPath = categoryPath(hub.profession, null);
  const offersLink = isCategoryEligible(jobs, hub.profession, null) ? offersPath : "/offerte";
  const career = careerFromSlug(hub.careerSlug);
  const expiringHasPage = expiringProfessions(all).some(([name]) => name === hub.profession);
  const employers = topEmployersText(items, 3);
  const h1 = `${hub.h1Lead} ${year}: bandi aperti e scadenze`;

  const intro: string[] = [];
  if (items.length > 0) {
    const top = districts.slice(0, 3);
    intro.push(
      `Al ${todayLabel()} su Offerte Sanità sono aperti ${plural(items.length, "bando", "bandi")} per ${hub.plural} in ${plural(districts.length, "regione", "regioni")}: ${typeBreakdownText(items)}. ${top.length ? `${top[0][0]} è la regione con più bandi (${top[0][1]})${top.length > 1 ? `, seguita da ${top.slice(1).map(([n, c]) => `${n} (${c})`).join(" e ")}` : ""}.` : ""}${employers ? ` Gli enti con più bandi aperti sono ${employers}.` : ""}`,
    );
    intro.push(
      soon14.length > 0
        ? `${plural(soon14.length, "bando scade", "bandi scadono")} entro ${EXPIRING_LONG_DAYS} giorni (${soon7.length} entro ${EXPIRING_SHORT_DAYS}). ${firstDeadlineText(items)} Ogni scheda rimanda al bando ufficiale, dove si trovano requisiti, prove e modalità di domanda.${privateCount > 0 ? ` Oltre ai bandi pubblici trovi ${plural(privateCount, "offerta privata o accreditata", "offerte private e accreditate")} per ${hub.plural}.` : ""}`
        : `Nessun bando scade nei prossimi ${EXPIRING_LONG_DAYS} giorni. Ogni scheda rimanda al bando ufficiale, dove si trovano requisiti, prove e modalità di domanda.${privateCount > 0 ? ` Oltre ai bandi pubblici trovi ${plural(privateCount, "offerta privata o accreditata", "offerte private e accreditate")} per ${hub.plural}.` : ""}`,
    );
  } else {
    intro.push(
      `Al momento non ci sono bandi aperti per ${hub.plural}. Questa pagina si aggiorna da sola quando gli enti pubblicano nuovi concorsi e avvisi.`,
    );
  }

  const regionLinks = districts.map(([name, count]) => {
    const href = concorsiPath(hub.profession, name);
    return eligible.has(href)
      ? { label: name, count, href }
      : { label: name, count, href: `#${slug(name)}` };
  });

  const sections = [
    ...(soon14.length > 0
      ? [
          {
            id: "in-scadenza",
            title: `In scadenza nei prossimi ${EXPIRING_LONG_DAYS} giorni (${soon14.length})`,
            note: "Dalla scadenza più vicina. L'elenco completo, con anche i bandi per altre professioni, è nella pagina dei concorsi in scadenza.",
            node: <CardList items={soon14.slice(0, 12)} />,
          },
        ]
      : []),
    ...districts.map(([name, count]) => {
      const inRegion = filterConcorsi(items, hub.profession, name);
      const href = concorsiPath(hub.profession, name);
      return {
        id: slug(name),
        title: `${hub.h1Lead} ${inRegione(name)} (${count})`,
        node: (
          <>
            <CardList items={inRegion.slice(0, PER_REGION)} />
            {count > PER_REGION && (
              <p className="mt-3 text-sm text-muted">
                {eligible.has(href) ? (
                  <Link href={href} className="font-bold text-primary hover:underline">
                    Vedi tutti i {count} bandi {inRegione(name)} →
                  </Link>
                ) : (
                  <>Altri {count - PER_REGION} bandi in questa regione nell&apos;elenco completo dei concorsi.</>
                )}
              </p>
            )}
          </>
        ),
      };
    }),
  ];

  const faq = [
    {
      q: `Quali concorsi per ${hub.plural} sono aperti nel ${year}?`,
      a: `Al momento ${plural(items.length, "bando è aperto", "bandi sono aperti")}${districts.length ? ` in ${plural(districts.length, "regione", "regioni")}` : ""}, tra ${typeBreakdownText(items) || "concorsi, avvisi e graduatorie"}. L'elenco qui sopra è aggiornato più volte al giorno dai siti ufficiali degli enti.`,
    },
    {
      q: `Quali requisiti servono per i concorsi ${hub.profession === "OSS" ? "OSS" : "da infermiere"}?`,
      a: hub.requirement,
    },
    {
      q: "Come si presenta la domanda?",
      a: `${hub.applyNote} Su ${"Offerte Sanità"} non si invia nessuna candidatura: ogni scheda ti porta al bando e al portale dell'ente.`,
    },
    {
      q: "Che differenza c'è tra concorso e avviso a tempo determinato?",
      a: "Il concorso porta all'assunzione a tempo indeterminato dopo prove e titoli; l'avviso a tempo determinato copre esigenze temporanee, con selezione più rapida. Le graduatorie sono gli elenchi di idonei da cui gli enti attingono. I dettagli sono nella guida «Come funzionano i concorsi pubblici nella sanità».",
    },
    {
      q: "Come non perdere le scadenze?",
      a: `Controlla la pagina dei concorsi in scadenza${expiringHasPage ? ` per ${plain}` : ""} oppure crea un avviso gratuito: ti scriviamo quando esce un nuovo bando.`,
    },
    {
      q: `Quanto guadagna ${hub.profession === "OSS" ? "un OSS" : "un infermiere"} nel pubblico?`,
      a: career
        ? `Il riferimento è il CCNL Comparto Sanità 2022-2024. Le tabelle con importi, fonte ARAN e indennità sono nella pagina dedicata agli stipendi.`
        : "Le tabelle retributive sono nella sezione Stipendi.",
    },
  ];

  const related = [
    {
      title: "Guide per candidarsi",
      links: hub.guides.map((g) => ({ label: g.label, href: newsPath(g.slug) })),
    },
    {
      title: "Vedi anche",
      links: [
        ...(career ? [{ label: `Stipendio ${career.label}`, href: `/stipendi/${career.slug}` }] : []),
        { label: `Tutti i concorsi per ${plain}`, href: concorsiPath(hub.profession) },
        { label: privateCount > 0 ? `Offerte di lavoro per ${hub.plural} (anche private)` : `Offerte per ${hub.plural}`, href: offersLink },
        { label: "Concorsi in scadenza", href: EXPIRING_PATH },
        { label: "Calendario concorsi", href: "/concorsi/calendario" },
        { label: "Calcolo punteggio titoli", href: "/strumenti/calcolo-punteggio-concorso" },
        ...(expiringHasPage ? [{ label: `In scadenza: ${plain}`, href: expiringProfessionPath(hub.profession) }] : []),
        { label: hub.otherHub === "/concorsi-oss-2026" ? `Concorsi OSS ${year}` : `Concorsi infermieri ${year}`, href: hub.otherHub },
        ...TYPE_PAGES.slice(1, 3).map((p) => ({ label: p.h1, href: typePagePath(p.slug) })),
      ],
    },
  ];

  return (
    <ConcorsiLanding
      crumbs={[{ label: "Home", href: "/" }, { label: "Concorsi", href: "/concorsi" }, { label: `${hub.h1Lead} ${year}` }]}
      h1={h1}
      subline={`${items.length} ${items.length === 1 ? "bando aperto" : "bandi aperti"} · ${soon14.length} in scadenza entro ${EXPIRING_LONG_DAYS} giorni`}
      intro={intro}
      chipGroups={[{ title: `Concorsi ${hub.plural} per regione`, links: regionLinks }]}
      sections={sections}
      faq={faq}
      alert={{
        profession: hub.profession,
        text: `Ricevi via email i nuovi concorsi per ${hub.plural}.`,
      }}
      related={related}
      jsonLd={[itemListJsonLd(h1, hub.path, items)]}
    />
  );
}

function slug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

