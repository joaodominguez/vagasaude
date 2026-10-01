import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { confirmAlert, getAlertByToken } from "@/lib/alerts";
import {
  alertConfirmedEmailHtml,
  isEmailConfigured,
  sendEmail,
} from "@/lib/email";

export const metadata: Metadata = {
  title: "Confirmar alerta",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ConfirmAlertPage({ searchParams }: Props) {
  const { token } = await searchParams;

  return (
    <>
      <Header />
      <main className="page-container min-h-[70vh] py-14">
        <section className="mx-auto max-w-xl content-card p-6 sm:p-8">
          <ConfirmBody token={token} />
        </section>
      </main>
      <Footer />
    </>
  );
}

async function ConfirmBody({ token }: { token?: string }) {
  if (!token) {
    return (
      <>
        <h1 className="text-2xl font-extrabold tracking-[-0.04em]">Link inválido</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Falta o token de confirmação. Usa o link do email.
        </p>
        <p className="mt-6">
          <Link className="font-bold text-primary" href="/alertas">
            Criar alerta
          </Link>
        </p>
      </>
    );
  }

  const existing = await getAlertByToken(token);
  if (!existing) {
    return (
      <>
        <h1 className="text-2xl font-extrabold tracking-[-0.04em]">
          Link inválido ou expirado
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Não encontrámos esta inscrição. Cria um novo alerta.
        </p>
        <p className="mt-6">
          <Link className="font-bold text-primary" href="/alertas">
            Criar alerta
          </Link>
        </p>
      </>
    );
  }

  if (existing.status === "unsubscribed") {
    return (
      <>
        <h1 className="text-2xl font-extrabold tracking-[-0.04em]">
          Inscrição cancelada
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Esta inscrição foi cancelada. Podes criar um novo alerta quando quiseres.
        </p>
        <p className="mt-6">
          <Link className="font-bold text-primary" href="/alertas">
            Criar alerta
          </Link>
        </p>
      </>
    );
  }

  if (existing.status === "active") {
    return (
      <>
        <h1 className="text-2xl font-extrabold tracking-[-0.04em]">Já confirmado</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          O alerta para <strong>{existing.email}</strong> já está activo.
        </p>
        <p className="mt-6">
          <Link
            className="font-bold text-primary"
            href={`/alertas/gerir?token=${encodeURIComponent(token)}`}
          >
            Gerir preferências
          </Link>
        </p>
      </>
    );
  }

  const alert = await confirmAlert(token);
  if (!alert || alert.status !== "active") {
    return (
      <>
        <h1 className="text-2xl font-extrabold tracking-[-0.04em]">
          Não foi possível confirmar
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Tenta novamente ou cria um novo alerta.
        </p>
        <p className="mt-6">
          <Link className="font-bold text-primary" href="/alertas">
            Criar alerta
          </Link>
        </p>
      </>
    );
  }

  if (isEmailConfigured()) {
    await sendEmail({
      to: alert.email,
      subject: "O teu alerta VagaSaúde está confirmado",
      html: alertConfirmedEmailHtml(alert),
    }).catch(() => null);
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-[-0.04em]">Alerta confirmado</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        A inscrição de <strong>{alert.email}</strong> está activa. Vamos enviar
        vagas novas quando corresponderem às tuas preferências.
      </p>
      <p className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link
          className="font-bold text-primary"
          href={`/alertas/gerir?token=${encodeURIComponent(alert.token)}`}
        >
          Gerir preferências
        </Link>
        <Link className="font-bold text-primary" href="/vagas">
          Ver vagas
        </Link>
      </p>
    </>
  );
}
