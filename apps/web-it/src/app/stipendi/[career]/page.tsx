import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildCareerSalaryMetadata, SalaryCareerView } from "@/components/salary-career-view";
import { categoryPath, listEligibleCategories } from "@/lib/categories";
import { getJobs } from "@/lib/jobs-data";
import { concorsiPath, filterConcorsi, listConcorsi } from "@/lib/concorsi";
import { EXPIRING_LONG_DAYS, EXPIRING_PATH, expiringItems, expiringProfessionPath, expiringProfessions, hubForProfession } from "@/lib/concorsi-hubs";
import { getPrivateSalaryData } from "@/lib/salary-observatory";
import { CAREERS, careerFromSlug } from "@/lib/salary-tables";

export const dynamic = "force-static";
export const revalidate = 3600;

type Params = Promise<{ career: string }>;

export function generateStaticParams() {
  return CAREERS.map((career) => ({ career: career.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const career = careerFromSlug((await params).career);
  return career ? buildCareerSalaryMetadata(career) : {};
}

export default async function CareerSalaryPage({ params }: { params: Params }) {
  const career = careerFromSlug((await params).career);
  if (!career) notFound();
  const jobs = await getJobs();
  const eligible = new Set(listEligibleCategories(jobs).map((ref) => ref.path));
  const all = listConcorsi(jobs);
  const mine = filterConcorsi(all, career.profession, null);
  const hub = hubForProfession(career.profession);
  const soon = expiringItems(mine, EXPIRING_LONG_DAYS);
  const expiringHasPage = expiringProfessions(all).some(([name]) => name === career.profession);
  const hubPath = categoryPath(career.profession, null);
  return (
    <SalaryCareerView
      career={career}
      privateData={await getPrivateSalaryData(career)}
      jobsHref={eligible.has(hubPath) ? hubPath : "/offerte"}
      links={{
        concorsiCount: mine.length,
        soonCount: soon.length,
        concorsiHref: mine.length > 0 ? concorsiPath(career.profession) : null,
        hubHref: hub && mine.length > 0 ? hub.path : null,
        hubLabel: hub ? `${hub.h1Lead} ${new Date().getFullYear()}` : null,
        expiringHref: expiringHasPage ? expiringProfessionPath(career.profession) : soon.length > 0 ? EXPIRING_PATH : null,
      }}
    />
  );
}
