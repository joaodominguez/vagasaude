import { CardList, ConcorsiLanding } from "@/components/concorsi-landing";
import {
  CONCORSI_LIST_CAP,
  concorsiPath,
  currentYear,
  filterConcorsi,
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
  hubForProfession,
  itemListJsonLd,
  professionPeople,
  plural,
  todayLabel,
  topDistrictsText,
  topEmployersText,
  typePagePath,
} from "@/lib/concorsi-hubs";
import { daysUntilDeadline } from "@/lib/job-display";

/** /concorsi/in-scadenza e /concorsi/in-scadenza/<professione>: bandi aperti che scadono entro 7 e 14 giorni. */
export function ExpiringView({ all, profession }: { all: ConcorsoItem[]; profession: string | null }) {
  const scope = filterConcorsi(all, profession, null);
  const within14 = expiringItems(scope, EXPIRING_LONG_DAYS);
  const within7 = expiringItems(scope, EXPIRING_SHORT_DAYS);
  const later = within14.filter((item) => !within7.includes(item));
  const today = within14.filter(({ job }) => daysUntilDeadline(job.expiresAt) === 0);
  const year = currentYear();
  const what = profession ? `per ${professionPeople(profession)}` : "nella sanità";
  const hub = hubForProfession(profession);

  const intro: string[] = [];
  if (within14.length > 0) {
    intro.push(
      `Al ${todayLabel()} ci sono ${plural(within14.length, "bando aperto", "bandi aperti")} ${what} con scadenza entro ${EXPIRING_LONG_DAYS} giorni, ${within7.length} dei quali entro ${EXPIRING_SHORT_DAYS} giorni${today.length > 0 ? ` e ${today.length} oggi` : ""}. ${firstDeadlineText(within14)} Le schede sono in ordine di scadenza, dalla più vicina.`,
    );
    const where = topDistrictsText(within14);
    const who = topEmployersText(within14);
    intro.push(
      `Le regioni con più scadenze ravvicinate sono ${where}. ${who ? `Gli enti con più bandi in chiusura: ${who}.` : ""} La data di scadenza è quella indicata dalla fonte ufficiale: prima di presentare domanda controlla sempre il bando.`,
    );
  } else {
    intro.push(
      `Al momento non ci sono bandi aperti ${what} con scadenza entro ${EXPIRING_LONG_DAYS} giorni. Guarda l'elenco completo dei concorsi aperti o crea un avviso per ricevere i nuovi bandi.`,
    );
  }

  const professionLinks = profession
    ? []
    : expiringProfessions(all).map(([name, count]) => ({
        label: name,
        count,
        href: expiringProfessionPath(name),
      }));

  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Concorsi", href: "/concorsi" },
    ...(profession
      ? [{ label: "In scadenza", href: EXPIRING_PATH }, { label: profession }]
      : [{ label: "In scadenza" }]),
  ];

  const path = profession ? expiringProfessionPath(profession) : EXPIRING_PATH;
  const h1 = profession
    ? `Concorsi ${professionPeople(profession)} in scadenza ${year}`
    : `Concorsi nella sanità in scadenza ${year}`;

  const capNote = (n: number) =>
    n > CONCORSI_LIST_CAP
      ? `Mostriamo i primi ${CONCORSI_LIST_CAP} su ${n}, in ordine di scadenza.`
      : undefined;

  const sections = [
    {
      id: "entro-7-giorni",
      title: `Scadono entro ${EXPIRING_SHORT_DAYS} giorni (${within7.length})`,
      note: capNote(within7.length),
      node: (
        <CardList
          items={within7.slice(0, CONCORSI_LIST_CAP)}
          empty={`Nessun bando ${what} scade entro ${EXPIRING_SHORT_DAYS} giorni.`}
        />
      ),
    },
    {
      id: "entro-14-giorni",
      title: `Scadono tra ${EXPIRING_SHORT_DAYS + 1} e ${EXPIRING_LONG_DAYS} giorni (${later.length})`,
      note: capNote(later.length),
      node: (
        <CardList
          items={later.slice(0, CONCORSI_LIST_CAP)}
          empty={`Nessun altro bando ${what} scade tra ${EXPIRING_SHORT_DAYS + 1} e ${EXPIRING_LONG_DAYS} giorni.`}
        />
      ),
    },
  ];

  const faq = [
    {
      q: `Quanti concorsi ${what} scadono nei prossimi giorni?`,
      a: `${plural(within7.length, "bando scade", "bandi scadono")} entro ${EXPIRING_SHORT_DAYS} giorni e ${plural(within14.length, "bando scade", "bandi scadono")} entro ${EXPIRING_LONG_DAYS} giorni${today.length ? `; ${today.length} ${today.length === 1 ? "scade" : "scadono"} oggi` : ""}. I numeri si aggiornano più volte al giorno.`,
    },
    {
      q: "Si può presentare domanda fino all'ultimo giorno?",
      a: "Di norma sì, ma l'ora limite dipende dal bando: alcuni chiudono la procedura online alle 23:59 del giorno di scadenza, altri a un orario stabilito. Leggi il bando ufficiale e non aspettare l'ultimo momento, perché i portali possono rallentare.",
    },
    {
      q: "Cosa succede dopo la scadenza?",
      a: "Dopo la scadenza la domanda non si può più inviare. Alcuni enti riaprono o prorogano i termini: in quel caso la scheda viene aggiornata con la nuova data indicata dalla fonte.",
    },
    {
      q: "Dove trovo i bandi senza una data di scadenza?",
      a: "Alcuni avvisi, soprattutto di enti privati e agenzie, non hanno una scadenza fissa e quindi non compaiono qui. Li trovi nell'elenco completo dei concorsi e delle offerte.",
    },
  ];

  const related = [
    {
      title: "Altre pagine utili",
      links: [
        { label: profession ? `Tutti i concorsi per ${professionPeople(profession)}` : "Tutti i concorsi aperti", href: concorsiPath(profession) },
        ...(hub ? [{ label: `${hub.h1Lead} ${year}`, href: hub.path }] : []),
        ...(profession ? [{ label: "Concorsi in scadenza: tutte le professioni", href: EXPIRING_PATH }] : []),
        ...TYPE_PAGES.slice(1, 4).map((page) => ({ label: page.h1, href: typePagePath(page.slug) })),
      ],
    },
  ];

  return (
    <ConcorsiLanding
      crumbs={crumbs}
      h1={h1}
      subline={`${plural(within14.length, "bando", "bandi")} entro ${EXPIRING_LONG_DAYS} giorni · ${within7.length} entro ${EXPIRING_SHORT_DAYS}`}
      intro={intro}
      chipGroups={[{ title: "In scadenza per professione", links: professionLinks }]}
      sections={sections}
      faq={faq}
      alert={{
        profession,
        text: `Ricevi via email i nuovi bandi ${what}, prima che scadano.`,
      }}
      related={related}
      jsonLd={[itemListJsonLd(h1, path, within14)]}
    />
  );
}
