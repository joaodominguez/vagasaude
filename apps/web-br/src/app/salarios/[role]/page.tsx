import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildSalaryMetadata, SalaryPageView } from "@/components/salary-page-view";
import { getSalaryPage, salaryJobsHref } from "@/lib/salary-observatory";

export const dynamic = "force-static";
export const revalidate = 3600;

type Params = Promise<{ role: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { role } = await params;
  const data = await getSalaryPage(role);
  return data ? buildSalaryMetadata(data.role, null, data.stats) : {};
}

export default async function SalaryRolePage({ params }: { params: Params }) {
  const { role } = await params;
  const data = await getSalaryPage(role);
  if (!data) notFound();
  return <SalaryPageView data={data} jobsHref={await salaryJobsHref(data.role)} />;
}
