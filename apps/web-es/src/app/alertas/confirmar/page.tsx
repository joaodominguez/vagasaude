import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { confirmAlert, getAlertByToken } from "@/lib/alerts";
import { buildAlertConfirmedEmail } from "@/lib/alert-digest";
import { isEmailConfigured, sendEmail } from "@/lib/email";

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
        <h1 className="text-2xl font-extrabold tracking-[-0.04em]">Enlace no válido</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Falta el token de confirmación. Usa el enlace del email.
        </p>
        <p className="mt-6">
          <Link className="font-bold text-primary" href="/alertas">
            Crear alerta
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
          Enlace no válido o caducado
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          No hemos encontrado esta suscripción. Crea una nueva alerta.
        </p>
        <p className="mt-6">
          <Link className="font-bold text-primary" href="/alertas">
            Crear alerta
          </Link>
        </p>
      </>
    );
  }

  if (existing.status === "unsubscribed") {
    return (
      <>
        <h1 className="text-2xl font-extrabold tracking-[-0.04em]">
          Suscripción cancelada
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Esta suscripción se ha cancelado. Puedes crear una nueva alerta cuando quieras.
        </p>
        <p className="mt-6">
          <Link className="font-bold text-primary" href="/alertas">
            Crear alerta
          </Link>
        </p>
      </>
    );
  }

  if (existing.status === "active") {
    return (
      <>
        <h1 className="text-2xl font-extrabold tracking-[-0.04em]">Ya confirmada</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          La alerta para <strong>{existing.email}</strong> ya está activa.
        </p>
        <p className="mt-6">
          <Link
            className="font-bold text-primary"
            href={`/alertas/gestionar?token=${encodeURIComponent(token)}`}
          >
            Gestionar preferencias
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
          No se ha podido confirmar
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Inténtalo de nuevo o crea una nueva alerta.
        </p>
        <p className="mt-6">
          <Link className="font-bold text-primary" href="/alertas">
            Crear alerta
          </Link>
        </p>
      </>
    );
  }

  if (isEmailConfigured()) {
    await sendEmail({
      to: alert.email,
      ...(await buildAlertConfirmedEmail(alert)),
    }).catch(() => null);
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-[-0.04em]">Alerta confirmada</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        La suscripción de <strong>{alert.email}</strong> está activa. Te enviaremos
        las ofertas nuevas que coincidan con tus preferencias.
      </p>
      <p className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link
          className="font-bold text-primary"
          href={`/alertas/gestionar?token=${encodeURIComponent(alert.token)}`}
        >
          Gestionar preferencias
        </Link>
        <Link className="font-bold text-primary" href="/empleo">
          Ver ofertas
        </Link>
      </p>
    </>
  );
}
