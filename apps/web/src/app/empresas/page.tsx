import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { listEmployers } from "@/lib/employers";
import { getJobs } from "@/lib/jobs-data";
import { SITE_NAME } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const employers = listEmployers(await getJobs());
  const title = "Empresas de saúde a recrutar: vagas por empregador";
  const description = `Hospitais, clínicas, laboratórios e redes de saúde com vagas abertas: ${employers.length} empregadores com vagas atualizadas todos os dias no ${SITE_NAME}.`;
  return {
    title,
    description,
    alternates: { canonical: "/empresas" },
    robots: { index: true, follow: true },
    openGraph: { title, description, url: "/empresas", type: "website", siteName: SITE_NAME, locale: "pt_PT" },
  };
}

export default async function EmployersIndexPage() {
  const employers = listEmployers(await getJobs());
  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <section className="border-b border-border bg-surface py-8">
          <div className="page-container">
            <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Empresas", href: "/empresas" }]} />
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Empresas de saúde a recrutar
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {employers.length} hospitais, clínicas, laboratórios, farmácias e redes de saúde com vagas
              abertas. Em cada empresa encontra as vagas atuais, as áreas e os distritos onde está a
              recrutar e os salários anunciados.
            </p>
          </div>
        </section>
        <div className="page-container py-10">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {employers.map((employer) => (
              <li key={employer.slug}>
                <Link
                  href={employer.path}
                  prefetch={false}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:border-primary"
                >
                  <span className="font-semibold">{employer.name}</span>
                  <span className="shrink-0 text-sm text-muted">{employer.jobs.length} vagas</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <Footer />
    </>
  );
}
