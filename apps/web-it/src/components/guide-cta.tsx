import Link from "next/link";
import { getArticle, listNewsCategories, newsCategoryPath, newsPath } from "@/lib/news";

const GUIDES = {
  bando: {
    slug: "come-leggere-bando-concorso",
    label: "Come leggere un bando di concorso",
  },
  curriculum: {
    slug: "curriculum-sanita",
    label: "Curriculum per infermieri e professioni sanitarie",
  },
  lettera: {
    slug: "lettera-presentazione-sanita",
    label: "Lettera di presentazione per ospedali e cliniche",
  },
  avvisi: {
    slug: "avvisi-lavoro-sanita",
    label: "Come usare gli avvisi di lavoro",
  },
} as const;

type GuideKey = keyof typeof GUIDES;

/** Professioni in cui è abituale indicare iscrizione all'albo/formazione regolamentata. */
const REGULATED = new Set([
  "Infermieristica",
  "Medicina",
  "OSS",
  "Fisioterapia",
  "Tecnici sanitari",
  "Ostetricia",
  "Farmacia",
  "Psicologia",
  "Nutrizione e dietistica",
  "Odontoiatria",
  "Logopedia e riabilitazione",
  "Ottica e audiometria",
  "Veterinaria",
]);

/**
 * CTA breve alle guide per candidarsi. Rimanda solo a guide pubblicate: le bozze
 * non esistono in produzione, quindi se non ce n'è nessuna visibile non viene
 * renderizzato nulla (evita link 404).
 */
export function GuideCta({
  variant = "aside",
  profession,
  sector,
}: {
  variant?: "aside" | "inline";
  profession?: string;
  sector?: string;
}) {
  const order: GuideKey[] =
    sector === "Pubblico"
      ? ["bando", "curriculum", "lettera", "avvisi"]
      : profession && REGULATED.has(profession)
        ? ["curriculum", "lettera", "avvisi", "bando"]
        : ["lettera", "curriculum", "avvisi", "bando"];
  const primary = order.map((key) => GUIDES[key]).find((g) => getArticle(g.slug));
  if (!primary) return null;
  const hasGuidesCategory = listNewsCategories().includes("guide");
  const allHref = hasGuidesCategory ? newsCategoryPath("guide") : "/notizie";

  if (variant === "inline") {
    return (
      <p className="text-sm leading-6 text-muted">
        Prima di candidarti:{" "}
        <Link href={newsPath(primary.slug)} className="font-bold text-primary hover:underline">
          {primary.label}
        </Link>
        {" · "}
        <Link href={allHref} className="font-semibold text-primary hover:underline">
          vedi tutte le guide
        </Link>
      </p>
    );
  }

  return (
    <div className="content-card p-5">
      <h2 className="font-extrabold">Prima di candidarti</h2>
      <p className="mt-1.5 text-sm leading-6 text-muted">
        Curriculum, lettera di presentazione, bandi e avvisi: brevi guide per
        cercare lavoro nella sanità in Italia.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        <li>
          <Link href={newsPath(primary.slug)} className="font-semibold text-primary hover:underline">
            {primary.label}
          </Link>
        </li>
        <li>
          <Link href={allHref} className="font-semibold text-primary hover:underline">
            Vedi tutte le guide
          </Link>
        </li>
      </ul>
    </div>
  );
}

/** Alias per compatibilità con i vecchi import. */
export const GuiasCta = GuideCta;
