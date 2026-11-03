import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildSalaryMetadata, SalaryPageView } from "@/components/salary-page-view";
import { getSalaryPage, salaryJobsHref } from "@/lib/salary-observatory";

export const dynamic = "force-static";
export const revalidate = 3600;

type Params = Promise<{ role: string; state: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { role, state } = await params;
  const data = await getSalaryPage(role, state);
  return data ? buildSalaryMetadata(data.role, data.district, data.stats) : {};
}

export default async function SalaryRoleStatePage({ params }: { params: Params }) {
  const { role, state } = await params;
  const data = await getSalaryPage(role, state);
  if (!data) notFound();
  return (
    <SalaryPageView
      data={data}
      jobsHref={await salaryJobsHref(data.role, data.district)}
    />
  );
}
