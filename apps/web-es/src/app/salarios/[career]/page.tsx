import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildCareerSalaryMetadata, SalaryCareerView } from "@/components/salary-career-view";
import { categoryPath, listEligibleCategories } from "@/lib/categories";
import { getJobs } from "@/lib/jobs-data";
import { getPrivateSalaryData } from "@/lib/salary-observatory";
import { careerFromSlug } from "@/lib/salary-tables";

export const dynamic = "force-static";
export const revalidate = 3600;

type Params = Promise<{ career: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const career = careerFromSlug((await params).career);
  return career ? buildCareerSalaryMetadata(career) : {};
}

export default async function CareerSalaryPage({ params }: { params: Params }) {
  const career = careerFromSlug((await params).career);
  if (!career) notFound();
  const eligible = new Set(listEligibleCategories(await getJobs()).map((ref) => ref.path));
  const hub = categoryPath(career.profession, null);
  return (
    <SalaryCareerView
      career={career}
      privateData={await getPrivateSalaryData(career)}
      jobsHref={eligible.has(hub) ? hub : "/empleo"}
    />
  );
}
