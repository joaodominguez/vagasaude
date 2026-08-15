import { JOB_SOURCES } from "@/lib/sources";

export function Partners() {
  const track = [...JOB_SOURCES, ...JOB_SOURCES];

  return (
    <section className="partners-section" aria-labelledby="partners-title">
      <div className="page-container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-kicker partners-kicker">Parceiros</span>
          <h2 id="partners-title" className="section-title partners-title">
            De onde vêm as vagas
          </h2>
          <p className="partners-copy">
            Agregamos anúncios oficiais destas entidades. A candidatura faz-se
            sempre no site de origem.
          </p>
        </div>
      </div>

      <div className="partners-slider" aria-label="Logos das fontes de vagas">
        <ul className="partners-track">
          {track.map((source, index) => (
            <li key={`${source.id}-${index}`}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="partner-logo"
                title={source.name}
                tabIndex={index >= JOB_SOURCES.length ? -1 : 0}
                aria-hidden={index >= JOB_SOURCES.length}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={source.logo} alt={source.shortName} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
