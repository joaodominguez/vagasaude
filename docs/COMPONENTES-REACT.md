# Estrutura Frontend (Next.js 15 + React) — VagaSaúde

Documento de apoio ao [`PLANO.md`](./PLANO.md). Propõe rotas, componentes e
padrões para o `apps/web`.

---

## 1. Rotas (App Router)

```
apps/web/src/app/
├── layout.tsx                 # layout global, <html>, fonts, header/footer
├── page.tsx                   # Home: hero + pesquisa + vagas em destaque
├── globals.css
├── vagas/
│   ├── page.tsx               # Listagem com filtros (Server Component)
│   └── [slug]/
│       └── page.tsx           # Detalhe da vaga + JobPosting JSON-LD
├── alertas/
│   ├── page.tsx               # Criar alerta
│   ├── confirmar/page.tsx     # Confirmação double opt-in (?token=)
│   └── gerir/page.tsx         # Gerir/cancelar alertas (?token=)
├── admin/
│   ├── layout.tsx             # sessão obrigatória + navegação administrativa
│   ├── page.tsx               # dashboard operacional
│   ├── vagas/page.tsx
│   ├── vagas/[id]/page.tsx
│   ├── fontes/page.tsx
│   ├── scrapers/page.tsx
│   ├── taxonomias/page.tsx
│   ├── alertas/page.tsx
│   ├── auditoria/page.tsx
│   └── sistema/page.tsx
├── sobre/page.tsx
├── privacidade/page.tsx
├── sitemap.ts                 # sitemap dinâmico
├── robots.ts
└── api/
    ├── health/route.ts        # healthcheck (BD)
    ├── alerts/route.ts        # POST criar alerta
    ├── alerts/confirm/route.ts
    └── ingest/route.ts        # POST autenticado (scraper escreve vagas)
```

URLs limpas para SEO: `/vagas/[slug]` onde
`slug = kebab(title)-kebab(company)-shortId`.

---

## 2. Componentes

```
apps/web/src/components/
├── layout/
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Container.tsx
│   └── ThemeSwitcher.tsx
├── jobs/
│   ├── JobCard.tsx            # cartão na listagem
│   ├── JobList.tsx            # grelha/lista + estado vazio
│   ├── JobDetail.tsx          # conteúdo da página de detalhe
│   ├── JobBadges.tsx          # setor, contrato, distrito
│   └── JobJsonLd.tsx          # structured data JobPosting
├── filters/
│   ├── FilterBar.tsx          # container dos filtros (URL state)
│   ├── DistrictSelect.tsx
│   ├── ProfessionSelect.tsx
│   ├── SectorSelect.tsx
│   ├── ContractSelect.tsx
│   └── SearchInput.tsx
├── alerts/
│   ├── AlertForm.tsx          # criar alerta (client component)
│   └── AlertManager.tsx
├── admin/
│   ├── AdminSidebar.tsx
│   ├── DashboardMetrics.tsx
│   ├── JobsTable.tsx
│   ├── JobEditor.tsx
│   ├── SourcesTable.tsx
│   └── ScraperRunsTable.tsx
├── ui/                        # primitivos (Button, Input, Select, Badge...)
└── seo/
    └── Meta.tsx
```

Padrão recomendado: **shadcn/ui + Tailwind CSS** para os primitivos de UI —
rápido, acessível e mobile-first.

---

## 3. Padrões técnicos

- **Server Components por defeito.** A listagem (`/vagas`) lê os filtros a
  partir dos `searchParams`, consulta a BD via Prisma no servidor e devolve
  HTML já renderizado (rápido + SEO).
- **Filtros no URL** (`?distrito=braga&profissao=enfermagem&setor=publico`):
  partilhável, cacheável e compatível com SSR. Componentes de filtro fazem
  `router.push` para atualizar o URL.
- **ISR / cache:** a listagem pode ser revalidada (`revalidate = 300`) ou
  cacheada na Cloudflare; a página de detalhe usa `generateStaticParams` +
  ISR para as vagas ativas.
- **Metadados** via `generateMetadata` por página (título, descrição, OG).
- **`JobPosting` JSON-LD** injetado na página de detalhe (ver [`SEO.md`](./SEO.md)).
- **Tema claro/escuro/sistema:** tokens CSS partilhados e preferência aplicada
  antes da renderização, conforme [`DESIGN.md`](./DESIGN.md).
- **Backoffice:** Server Components/Actions protegidos no servidor; Cloudflare
  Access é uma camada adicional e não substitui a autorização da aplicação.

---

## 4. Exemplo — listagem (Server Component)

```tsx
// apps/web/src/app/vagas/page.tsx
import { prisma } from "@vagasaude/database";
import { JobList } from "@/components/jobs/JobList";
import { FilterBar } from "@/components/filters/FilterBar";

export const revalidate = 300;

export default async function VagasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { distrito, profissao, setor, q, page } = await searchParams;
  const pageNum = Number(page ?? 1);
  const pageSize = 20;

  const jobs = await prisma.job.findMany({
    where: {
      status: "published",
      ...(distrito && { locationDistrict: distrito }),
      ...(profissao && { profession: profissao }),
      ...(setor && { sector: setor as any }),
      ...(q && { title: { contains: q, mode: "insensitive" } }),
    },
    orderBy: { publishedAt: "desc" },
    take: pageSize,
    skip: (pageNum - 1) * pageSize,
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <FilterBar />
      <JobList jobs={jobs} />
    </main>
  );
}
```

---

## 5. Exemplo — cartão de vaga

```tsx
// apps/web/src/components/jobs/JobCard.tsx
import Link from "next/link";
import { JobBadges } from "./JobBadges";

export function JobCard({ job }: { job: JobCardData }) {
  return (
    <Link
      href={`/vagas/${job.slug}`}
      className="block rounded-xl border p-4 transition hover:shadow-md"
    >
      <h3 className="text-lg font-semibold">{job.title}</h3>
      <p className="text-sm text-muted-foreground">{job.company}</p>
      <JobBadges
        sector={job.sector}
        district={job.locationDistrict}
        contractType={job.contractType}
      />
    </Link>
  );
}
```

---

## 6. Acessibilidade & Performance

- Contraste AA, foco visível, labels em todos os inputs de filtro.
- Imagens com `next/image`; fontes com `next/font`.
- Sem JS desnecessário na listagem (Server Components).
- Objetivo Lighthouse: Performance/SEO/A11y ≥ 90.
