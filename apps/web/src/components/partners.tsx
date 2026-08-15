import { JOB_SOURCES } from "@/lib/sources";

export function Partners() {
  return (
    <section className="partners-section" aria-labelledby="partners-title">
      <div className="page-container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-kicker">Parceiros</span>
          <h2 id="partners-title" className="section-title">
            De onde vêm as vagas
          </h2>
          <p className="partners-copy">
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
