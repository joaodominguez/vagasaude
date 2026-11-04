import type { CSSProperties } from "react";
import { JOB_SOURCES, type JobSourceMeta } from "@/lib/sources";
import styles from "./partners.module.css";

/** Com poucas fontes basta uma fila; a partir daqui, duas em sentidos opostos. */
const TWO_ROWS_FROM = 24;
/** Segundos por logótipo: velocidade constante, seja qual for o tamanho da lista. */
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
        {/* Cópia para o ciclo contínuo: invisível para leitores de tela. */}
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
  // Sem fontes ativas: não mostrar uma seção vazia.
  if (JOB_SOURCES.length === 0) return null;

  const twoRows = JOB_SOURCES.length >= TWO_ROWS_FROM;
  const rowA = twoRows ? JOB_SOURCES.filter((_, i) => i % 2 === 0) : JOB_SOURCES;
  const rowB = twoRows ? JOB_SOURCES.filter((_, i) => i % 2 === 1) : [];

  return (
    <section className="border-t border-border" aria-labelledby="partners-title">
      <div className="page-container py-14 sm:py-18">
        <div className="max-w-2xl">
          <span className="section-kicker">Parceiros</span>
          <h2 id="partners-title" className="section-title">
            De onde vêm as vagas
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
            Agregamos anúncios oficiais de {JOB_SOURCES.length} entidades. A
            candidatura é feita sempre no site de origem.
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
