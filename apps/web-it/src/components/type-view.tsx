import { ConcorsiLanding } from "@/components/concorsi-landing";
import { ConcorsiList } from "@/components/concorsi-list";
import { JobCard } from "@/components/job-card";
import {
  CONCORSI_LIST_CAP,
  concorsiDistricts,
  concorsiPath,
  concorsiProfessions,
  currentYear,
  listEligibleConcorsi,
  professionLower,
  type ConcorsoItem,
} from "@/lib/concorsi";
import {
  EXPIRING_LONG_DAYS,
  EXPIRING_PATH,
  TYPE_PAGES,
  expiringItems,
  firstDeadlineText,
  hubForProfession,
  itemListJsonLd,
  itemsOfType,
  plural,
  todayLabel,
  topDistrictsText,
  topEmployersText,
  typePagePath,
  type TypePage,
} from "@/lib/concorsi-hubs";
import { displayTitle } from "@/lib/display-title";
import { shortDate } from "@/lib/job-display";
import { JOB_TYPE_LABEL } from "@/lib/job-type";

/** Riga di una graduatoria: solo titolo, ente, data e link al documento ufficiale (mai nomi o punteggi). */
function GraduatoriaRow({ item }: { item: ConcorsoItem }) {
  const { job } = item;
  const date = shortDate(job.publishedAt);
  return (
    <li className="content-card flex flex-wrap items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="break-words font-bold leading-snug">{displayTitle(job.title, job)}</p>
        <p className="mt-0.5 text-sm text-muted">
          {[job.company, job.district, date ? `pubblicata il ${date}` : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      {job.applicationUrl && (
        <a
          href={job.applicationUrl}
          target="_blank"
          rel="noopener nofollow"
          className="button button-secondary shrink-0 text-sm"
        >
          Documento ufficiale
        </a>
      )}
    </li>
  );
}

/** /concorsi/tipo/<tipo>: concorsi, avvisi a tempo determinato, mobilità, incarichi, graduatorie. */
export function TypeView({ all, page }: { all: ConcorsoItem[]; page: TypePage }) {
  const items = itemsOfType(all, page.type);
  const year = currentYear();
  const isGrad = page.type === "graduatoria";
  const soon = expiringItems(items, EXPIRING_LONG_DAYS);
  const path = typePagePath(page.slug);
  const h1 = `${page.h1} ${year}`;
  const eligible = new Set(listEligibleConcorsi(all).map((ref) => ref.path));

  const intro: string[] = [page.blurb];
  if (items.length > 0) {
    const professions = concorsiProfessions(items)
      .slice(0, 3)
      .map(([name, n]) => `${professionLower(name)} (${n})`)
      .join(", ");
    intro.push(
      `Al ${todayLabel()} ci sono ${plural(items.length, isGrad ? "graduatoria" : "avviso aperto", isGrad ? "graduatorie" : "avvisi aperti")} su Offerte Sanità. Le regioni con più ${page.noun} sono ${topDistrictsText(items)}; gli enti più presenti ${topEmployersText(items)}. ${professions ? `Per professione prevalgono ${professions}.` : ""}${!isGrad && soon.length > 0 ? ` ${plural(soon.length, "scade", "scadono")} entro ${EXPIRING_LONG_DAYS} giorni. ${firstDeadlineText(items)}` : ""}`.trim(),
    );
  } else {
    intro.push(`Al momento non ci sono ${page.noun} aperti: crea un avviso per ricevere le nuove pubblicazioni.`);
  }

  const professionLinks = concorsiProfessions(items)
    .filter(([name]) => eligible.has(concorsiPath(name)))
    .map(([name, count]) => ({ label: name, count, href: concorsiPath(name) }));
  const districtCount = concorsiDistricts(items).length;

  const faq = isGrad
    ? [
        {
          q: "Pubblicate i nomi e i punteggi dei candidati?",
          a: "No. Per rispetto della privacy riportiamo solo titolo, ente e data dell'avviso e rimandiamo al documento ufficiale sul sito dell'ente, che è l'unica fonte valida per consultare nominativi e punteggi.",
        },
        {
          q: "Come si legge una graduatoria?",
          a: "Di solito è un elenco in ordine di punteggio, con il totale di titoli e prove. Il documento ufficiale indica se è provvisoria o definitiva, la validità e i termini per eventuali osservazioni o ricorsi.",
        },
        {
          q: "Cosa significa essere idonei?",
          a: "Idoneo è chi ha superato le prove ma non rientra tra i vincitori. In molti casi l'ente può attingere all'elenco degli idonei per assunzioni successive, finché la graduatoria è valida.",
        },
        {
          q: "Dove trovo la graduatoria del mio concorso?",
          a: "Sul sito dell'ente che ha bandito il concorso, nella sezione Bandi di concorso o Amministrazione trasparente. Se è tra quelle che raccogliamo, la trovi in questa pagina con il collegamento diretto.",
        },
      ]
    : [
        {
          q: `Quanti ${page.noun} sono aperti?`,
          a: `Al momento ${plural(items.length, "avviso è aperto", "avvisi sono aperti")} in ${districtCount} ${districtCount === 1 ? "regione" : "regioni"}. L'elenco viene aggiornato più volte al giorno dalle fonti ufficiali degli enti.`,
        },
        {
          q: "Come mi candido?",
          a: "Apri la scheda e usa il link al bando ufficiale: la domanda si presenta sul sito o sul portale dell'ente che bandisce (spesso inPA o una piattaforma dedicata), entro la scadenza indicata.",
        },
        {
          q: "Cosa cambia rispetto agli altri tipi di avviso?",
          a: `${page.blurb} Per le differenze tra concorso, graduatoria, mobilità e avviso a tempo determinato leggi la guida «Come funzionano i concorsi pubblici nella sanità».`,
        },
        {
          q: "Posso filtrare per professione e regione?",
          a: "Sì: usa i filtri sopra l'elenco oppure le pagine dedicate a ogni professione, dove trovi anche le scadenze più vicine.",
        },
      ];

  const sections = [
    {
      id: "elenco",
      title: isGrad ? `Graduatorie (${items.length})` : `Avvisi aperti (${items.length})`,
      note: isGrad ? "Solo titolo, ente, data e collegamento al documento ufficiale." : undefined,
      node: isGrad ? (
        items.length > 0 ? (
          <ul className="space-y-3">
            {items.slice(0, CONCORSI_LIST_CAP).map((item) => (
              <GraduatoriaRow key={item.job.slug} item={item} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nessuna graduatoria al momento.</p>
        )
      ) : (
        <ConcorsiList
          showProfessionFilter
          items={items.slice(0, CONCORSI_LIST_CAP).map(({ job, type }) => ({
            key: job.slug,
            profession: job.profession,
            district: job.district,
            type,
            typeLabel: JOB_TYPE_LABEL[type],
            node: <JobCard job={job} />,
          }))}
        />
      ),
    },
  ];

  const hubLinks = [...new Set(items.map(({ job }) => job.profession))]
    .map((p) => hubForProfession(p))
    .filter((h): h is NonNullable<typeof h> => Boolean(h))
    .map((h) => ({ label: `${h.h1Lead} ${year}`, href: h.path }));

  return (
    <ConcorsiLanding
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Concorsi", href: "/concorsi" },
        { label: page.h1 },
      ]}
      h1={h1}
      subline={`${items.length} ${items.length === 1 ? "avviso aperto" : "avvisi aperti"}`}
      intro={intro}
      chipGroups={[{ title: "Per professione", links: professionLinks }]}
      sections={sections}
      faq={faq}
      alert={{ text: `Ricevi via email i nuovi ${page.noun} e gli altri bandi pubblici.` }}
      related={[
        {
          title: "Altri tipi di bando",
          links: TYPE_PAGES.filter((p) => p.slug !== page.slug).map((p) => ({
            label: p.h1,
            href: typePagePath(p.slug),
          })),
        },
        {
          title: "Vedi anche",
          links: [
            { label: "Concorsi in scadenza", href: EXPIRING_PATH },
            ...hubLinks,
            { label: "Stipendi nella sanità", href: "/stipendi" },
          ],
        },
      ]}
      jsonLd={isGrad ? [] : [itemListJsonLd(h1, path, items)]}
    />
  );
}

