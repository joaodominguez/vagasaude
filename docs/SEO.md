# SEO Técnico — VagaSaude.pt

Documento de apoio ao [`PLANO.md`](./PLANO.md). O SEO é um canal de aquisição
central para um agregador de vagas — bem feito, o Google Jobs indexa as vagas.

---

## 1. Objetivos

- Cada vaga indexável com `JobPosting` structured data (elegível para o
  **Google for Jobs**).
- Páginas de listagem por distrito/profissão como *landing pages* de SEO
  (ex.: "Vagas de Enfermagem no Porto").
- Site rápido (Core Web Vitals verdes) e mobile-first.

---

## 2. `JobPosting` (schema.org / JSON-LD)

Injetar na página `/vagas/[slug]`:

```tsx
// components/jobs/JobJsonLd.tsx
export function JobJsonLd({ job }: { job: JobDetail }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,           // HTML permitido
    datePosted: job.publishedAt,
    validThrough: job.expiresAt ?? undefined,
    employmentType: job.contractType ?? undefined,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.locationConcelho ?? job.locationDistrict,
        addressRegion: job.locationDistrict,
        addressCountry: "PT",
      },
    },
    directApply: false, // candidatura é externa
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

Validar sempre no **[Rich Results Test](https://search.google.com/test/rich-results)**.

**Requisitos do Google for Jobs:** `title`, `description`, `datePosted`,
`hiringOrganization`, `jobLocation`. `validThrough` é fortemente recomendado —
manter atualizado e desindexar/expirar vagas fechadas para não violar políticas.

---

## 3. Metadados por página

Usar `generateMetadata` do Next.js:

```tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const job = await getJob(params.slug);
  return {
    title: `${job.title} — ${job.company} | VagaSaude`,
    description: job.description.slice(0, 155),
    alternates: { canonical: `https://vagasaude.pt/vagas/${job.slug}` },
    openGraph: { title: job.title, description: "...", type: "article" },
  };
}
```

---

## 4. Sitemap e robots

- `app/sitemap.ts` gera sitemap dinâmico com todas as vagas ativas + landing
  pages de distrito/profissão. Se crescer muito, usar *sitemap index* segmentado.
- `app/robots.ts` permite indexação e aponta para o sitemap.

```ts
// app/robots.ts
export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://vagasaude.pt/sitemap.xml",
  };
}
```

---

## 5. Landing pages programáticas (SEO de cauda longa)

Gerar páginas para combinações com procura real:
- `/vagas/enfermagem/porto`
- `/vagas/medicina/lisboa`
- `/vagas/publico/braga`

Cada uma com título/descrição próprios, H1 claro, e listagem filtrada.
Usar `generateStaticParams` para as combinações mais relevantes + ISR.

---

## 6. Conteúdo duplicado

- Descrições copiadas das fontes prejudicam SEO. Estratégias:
  - Adicionar valor: badges normalizados, contexto do distrito, links úteis.
  - `canonical` para a própria página do VagaSaude.
  - Considerar resumir/normalizar descrições em vez de copiar 1:1.

---

## 7. Performance (Core Web Vitals)

- Server Components + cache Cloudflare para a listagem.
- `next/font`, `next/image`, `preconnect` mínimos.
- Evitar layout shift (reservar espaço para cartões).
- Alvo: **LCP < 1.5s**, CLS < 0.1, INP baixo.
