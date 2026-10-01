import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { getAlertByToken } from "@/lib/alerts";
import { ManageAlertClient } from "./manage-alert-client";

export const metadata: Metadata = {
  title: "Gerir alerta",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ManageAlertPage({ searchParams }: Props) {
  const { token } = await searchParams;

  return (
    <>
      <Header />
      <main className="page-container min-h-[70vh] py-14">
        <section className="mx-auto max-w-xl content-card p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-[-0.04em]">
            Gerir alerta
          </h1>
          <ManageBody token={token} />
        </section>
      </main>
      <Footer />
    </>
  );
}

async function ManageBody({ token }: { token?: string }) {
  if (!token) {
    return (
      <p className="mt-3 text-sm leading-6 text-muted">
        Falta o token. Usa o link do email ou{" "}
        <Link className="font-bold text-primary" href="/alertas">
          cria um novo alerta
        </Link>
        .
      </p>
    );
  }

  const alert = await getAlertByToken(token);
  if (!alert) {
    return (
      <p className="mt-3 text-sm leading-6 text-muted">
        Não encontrámos esta inscrição.{" "}
        <Link className="font-bold text-primary" href="/alertas">
          Criar alerta
        </Link>
      </p>
    );
  }

  return (
    <div className="mt-6">
      <ManageAlertClient
        token={token}
        email={alert.email}
        status={alert.status}
        filters={alert.filters}
      />
    </div>
  );
}
