import Link from "next/link";
import {
  categoryPath,
  filterJobsForCategory,
  isKnownDistrict,
  isKnownProfession,
  type CategoryRef,
} from "@/lib/categories";
import { concorsiPath, countBy, listConcorsi } from "@/lib/concorsi";
import { expiringItems, hubForProfession, professionPeople, EXPIRING_LONG_DAYS } from "@/lib/concorsi-hubs";
import { displayTitle } from "@/lib/display-title";
import { shortDate } from "@/lib/job-display";
import { inRegione } from "@/lib/it-locative";
import type { Job } from "@/lib/jobs";
import { isPublicJob } from "@/lib/job-type";
import { careerForProfession } from "@/lib/salary-tables";

/** Soglia sotto la quale la combinazione professione × regione non riceve il blocco di testo dedicato. */
export const COMBO_NARRATIVE_MIN = 5;

const ordinal = (n: number) => `${n}ª`;

/**
 * Testo dedicato a una pagina professione × regione, generato dai dati reali:
 * posizione della regione per quella professione, mix pubblico/privato, enti, località,
 * scadenze vicine, FAQ con numeri e link interni (altre regioni, altre professioni, stipendi, concorsi).
 */
export function ComboNarrative({
  category,
  jobs,
  allJobs,
  allCategoryRefs,
}: {
  category: CategoryRef;
  jobs: Job[];
  allJobs: Job[];
  allCategoryRefs: CategoryRef[];
}) {
  const { profession, district } = category;
  if (category.kind !== "combo" || !profession || !district || jobs.length < COMBO_NARRATIVE_MIN) return null;
  const eligible = new Set(allCategoryRefs.map((ref) => ref.path));
  const label = professionPeople(profession);
  const Label = label.charAt(0).toUpperCase() + label.slice(1);
  const where = inRegione(district);

  const ofProfession = filterJobsForCategory(allJobs, profession, null);
  const byRegion = countBy(ofProfession.map((job) => job.district).filter(isKnownDistrict));
  const rank = byRegion.findIndex(([name]) => name === district) + 1;
  const share = ofProfession.length ? Math.round((jobs.length / ofProfession.length) * 100) : 0;
  const inDistrict = filterJobsForCategory(allJobs, null, district);
  const districtShare = inDistrict.length ? Math.round((jobs.length / inDistrict.length) * 100) : 0;

  const pub = jobs.filter(isPublicJob);
  const priv = jobs.length - pub.length;
  const employers = countBy(jobs.map((job) => job.company).filter(Boolean)).slice(0, 4);
  const cities = countBy(jobs.map((job) => job.city).filter((c) => Boolean(c) && c !== district)).slice(0, 3);
  const concorsi = listConcorsi(jobs);
  const soon = expiringItems(concorsi, EXPIRING_LONG_DAYS);
  const concorsiHref = concorsiPath(profession, district);
  const hasConcorsiPage = concorsi.length >= 3;
  const recent = jobs.filter((job) => {
    const t = Date.parse(job.publishedAt);
    return !Number.isNaN(t) && t >= Date.now() - 7 * 86_400_000;
  }).length;
  const career = careerForProfession(profession);
  const hub = hubForProfession(profession);

  const paragraphs: string[] = [];
  paragraphs.push(
    `${where.charAt(0).toUpperCase() + where.slice(1)} sono aperte ${jobs.length} offerte per ${label}${rank > 0 ? `: è la ${ordinal(rank)} regione per numero di offerte di questa professione su Offerte Sanità, con il ${share}% del totale nazionale (${ofProfession.length})` : ""}. Questa professione rappresenta il ${districtShare}% di tutte le offerte ${where} (${inDistrict.length}).`,
  );
  paragraphs.push(
    `${pub.length > 0 ? `${pub.length} ${pub.length === 1 ? "offerta è" : "offerte sono"} del settore pubblico ${concorsi.length !== pub.length ? ` (${concorsi.length} tra concorsi, avvisi, mobilità e graduatorie)` : ""}` : "Nessuna offerta è del settore pubblico"}${priv > 0 ? `${pub.length > 0 ? " e " : ", "}${priv} ${priv === 1 ? "è" : "sono"} di strutture private o accreditate` : ""}. ${employers.length ? `Gli enti con più offerte: ${employers.map(([n, c]) => `${n} (${c})`).join(", ")}.` : ""}${cities.length ? ` Le località più presenti: ${cities.map(([n, c]) => `${n} (${c})`).join(", ")}.` : ""}${recent ? ` ${recent} ${recent === 1 ? "è stata pubblicata" : "sono state pubblicate"} negli ultimi 7 giorni.` : ""}`,
  );
  if (soon.length > 0) {
    const first = soon[0].job;
    paragraphs.push(
      `${soon.length} ${soon.length === 1 ? "bando pubblico scade" : "bandi pubblici scadono"} entro ${EXPIRING_LONG_DAYS} giorni; il primo è «${displayTitle(first.title, first)}» (${first.company}), il ${shortDate(first.expiresAt)}.`,
    );
  }

  const otherRegions = byRegion
    .filter(([name]) => name !== district && eligible.has(categoryPath(profession, name)))
    .slice(0, 6)
    .map(([name, count]) => ({ label: name, count, href: categoryPath(profession, name) }));
  const otherProfessions = countBy(inDistrict.map((job) => job.profession).filter(isKnownProfession))
    .filter(([name]) => name !== profession && eligible.has(categoryPath(name, district)))
    .slice(0, 6)
    .map(([name, count]) => ({ label: name, count, href: categoryPath(name, district) }));

  const faq = [
    {
      q: `Dove si cercano più ${label} ${where}?`,
      a: cities.length
        ? `Le località con più offerte aperte sono ${cities.map(([n, c]) => `${n} (${c})`).join(", ")}. Il numero cambia a ogni aggiornamento delle fonti.`
        : `Le offerte sono distribuite in più località della regione.`,
    },
    {
      q: `Quali strutture assumono ${label} ${where}?`,
      a: employers.length
        ? `Tra le strutture con più offerte: ${employers.map(([n, c]) => `${n} (${c})`).join(", ")}. ${pub.length > 0 && priv > 0 ? `L'elenco mescola enti pubblici (${pub.length} offerte) e strutture private o accreditate (${priv}).` : pub.length > 0 ? "Sono tutte offerte di enti pubblici." : "Sono tutte offerte di strutture private o accreditate."}`
        : "Non ci sono strutture con più offerte in evidenza.",
    },
    {
      q: `Ci sono concorsi pubblici per ${label} ${where}?`,
      a:
        concorsi.length > 0
          ? `Sì: ${concorsi.length} ${concorsi.length === 1 ? "bando aperto" : "bandi aperti"} tra concorsi, avvisi, mobilità e graduatorie${soon.length ? `, ${soon.length} in scadenza entro ${EXPIRING_LONG_DAYS} giorni` : ""}. ${hasConcorsiPage ? "Li trovi nella pagina dedicata ai concorsi." : ""}`
          : "Al momento no: le offerte aperte sono di strutture private o accreditate. Crea un avviso per essere avvisato quando esce un bando.",
    },
  ];

  return (
    <section className="border-t border-border bg-surface">
      <div className="page-container grid gap-8 py-10 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-extrabold">
            Il lavoro per {label} {where}
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-muted">
            {paragraphs.map((text) => (
              <p key={text.slice(0, 30)}>{text}</p>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-primary">
            {hasConcorsiPage && (
              <Link href={concorsiHref} className="hover:underline">
                Concorsi per {label} {where} →
              </Link>
            )}
            {hub && (
              <Link href={hub.path} className="hover:underline">
                {hub.h1Lead} 2026 →
              </Link>
            )}
            {career && (
              <Link href={`/stipendi/${career.slug}`} className="hover:underline">
                Stipendio {career.label} →
              </Link>
            )}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-extrabold">Domande su {label} {where}</h2>
          <div className="mt-4 space-y-5">
            {faq.map((item) => (
              <div key={item.q}>
                <h3 className="font-bold">{item.q}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{item.a}</p>
              </div>
            ))}
          </div>
          {(otherRegions.length > 0 || otherProfessions.length > 0) && (
            <div className="mt-6 space-y-4 text-sm">
              {otherRegions.length > 0 && (
                <p>
                  <span className="font-extrabold">{Label} in altre regioni:</span>{" "}
                  {otherRegions.map((r, i) => (
                    <span key={r.href}>
                      {i > 0 && ", "}
                      <Link href={r.href} className="font-semibold text-primary hover:underline">
                        {r.label}
                      </Link>{" "}
                      ({r.count})
                    </span>
                  ))}
                </p>
              )}
              {otherProfessions.length > 0 && (
                <p>
                  <span className="font-extrabold">Altre professioni {where}:</span>{" "}
                  {otherProfessions.map((r, i) => (
                    <span key={r.href}>
                      {i > 0 && ", "}
                      <Link href={r.href} className="font-semibold text-primary hover:underline">
                        {r.label}
                      </Link>{" "}
                      ({r.count})
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
