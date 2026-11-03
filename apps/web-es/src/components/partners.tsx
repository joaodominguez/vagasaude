import { JOB_SOURCES } from "@/lib/sources";

export function Partners() {
  // Sin fuentes activas todavía: no mostrar una sección vacía.
  if (JOB_SOURCES.length === 0) return null;

  return (
    <section className="border-t border-border" aria-labelledby="partners-title">
      <div className="page-container py-14 sm:py-18">
        <div className="max-w-2xl">
          <span className="section-kicker">Colaboradores</span>
          <h2 id="partners-title" className="section-title">
            De dónde vienen las ofertas
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
            Agregamos los anuncios oficiales de estas entidades. La inscripción se
            hace siempre en la web de origen.
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
                  {source.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={source.logo} alt={source.shortName} />
                  ) : (
                    <span className="text-sm font-extrabold text-muted">
                      {source.shortName}
                    </span>
                  )}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
