import { JOB_SOURCES } from "@/lib/sources";

export function Partners() {
  return (
    <section className="border-t border-border" aria-labelledby="partners-title">
      <div className="page-container py-14 sm:py-18">
        <div className="max-w-2xl">
          <span className="section-kicker">Parceiros</span>
          <h2 id="partners-title" className="section-title">
            De onde vêm as vagas
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
            Agregamos anúncios oficiais destas entidades. A candidatura faz-se
            sempre no site de origem.
          </p>
        </div>

        <ul className="partners-grid">
          {JOB_SOURCES.map((source) => (
            <li key={source.id}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="partner-card"
                title={source.name}
              >
                <span className="partner-logo-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={source.logo} alt={source.shortName} />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
