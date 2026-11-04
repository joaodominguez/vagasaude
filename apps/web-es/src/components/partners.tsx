import type { CSSProperties } from "react";
import { JOB_SOURCES, type JobSourceMeta } from "@/lib/sources";
import styles from "./partners.module.css";

/** Con pocas fuentes basta una fila; a partir de aquí, dos en sentidos opuestos. */
const TWO_ROWS_FROM = 24;
/** Segundos por logo: velocidad constante independientemente del tamaño de la lista. */
const SECONDS_PER_LOGO = 3;

function LogoCard({ source, hidden }: { source: JobSourceMeta; hidden?: boolean }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.card}
      title={source.name}
      tabIndex={hidden ? -1 : undefined}
    >
      {source.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source.logo}
          alt={hidden ? "" : source.shortName}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className={styles.name}>{source.shortName}</span>
      )}
    </a>
  );
}

function MarqueeRow({ items, reverse }: { items: JobSourceMeta[]; reverse?: boolean }) {
  const style = { "--duration": `${Math.max(30, items.length * SECONDS_PER_LOGO)}s` } as CSSProperties;
  return (
    <div className={styles.row}>
      <ul className={`${styles.track} ${reverse ? styles.reverse : ""}`} style={style}>
        {items.map((source) => (
          <li key={source.id}>
            <LogoCard source={source} />
          </li>
        ))}
        {/* Copia para el bucle continuo: invisible para lectores de pantalla. */}
        {items.map((source) => (
          <li key={`${source.id}-dup`} className={styles.duplicate} aria-hidden="true">
            <LogoCard source={source} hidden />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Partners() {
  // Sin fuentes activas todavía: no mostrar una sección vacía.
  if (JOB_SOURCES.length === 0) return null;

  const twoRows = JOB_SOURCES.length >= TWO_ROWS_FROM;
  const rowA = twoRows ? JOB_SOURCES.filter((_, i) => i % 2 === 0) : JOB_SOURCES;
  const rowB = twoRows ? JOB_SOURCES.filter((_, i) => i % 2 === 1) : [];

  return (
    <section className="border-t border-border" aria-labelledby="partners-title">
      <div className="page-container py-14 sm:py-18">
        <div className="max-w-2xl">
          <span className="section-kicker">Colaboradores</span>
          <h2 id="partners-title" className="section-title">
            De dónde vienen las ofertas
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
            Agregamos los anuncios oficiales de {JOB_SOURCES.length} entidades. La
            inscripción se hace siempre en la web de origen.
          </p>
        </div>

        <div className={styles.marquee}>
          <MarqueeRow items={rowA} />
          {rowB.length > 0 && <MarqueeRow items={rowB} reverse />}
        </div>
      </div>
    </section>
  );
}
