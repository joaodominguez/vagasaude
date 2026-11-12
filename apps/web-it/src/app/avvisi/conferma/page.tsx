import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { confirmAlert, getAlertByToken } from "@/lib/alerts";
import { buildAlertConfirmedEmail } from "@/lib/alert-digest";
import { isEmailConfigured, sendEmail } from "@/lib/email";

export const metadata: Metadata = {
  title: "Conferma avviso",
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
        <h1 className="text-2xl font-extrabold tracking-[-0.04em]">Link non valido</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Manca il token di conferma. Usa il link presente nell’email.
        </p>
        <p className="mt-6">
          <Link className="font-bold text-primary" href="/avvisi">
            Crea un avviso
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
          Link non valido o scaduto
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Non abbiamo trovato questa iscrizione. Crea un nuovo avviso.
        </p>
        <p className="mt-6">
          <Link className="font-bold text-primary" href="/avvisi">
            Crea un avviso
          </Link>
        </p>
      </>
    );
  }

  if (existing.status === "unsubscribed") {
    return (
      <>
        <h1 className="text-2xl font-extrabold tracking-[-0.04em]">
          Iscrizione annullata
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Questa iscrizione è stata annullata. Puoi creare un nuovo avviso quando vuoi.
        </p>
        <p className="mt-6">
          <Link className="font-bold text-primary" href="/avvisi">
            Crea un avviso
          </Link>
        </p>
      </>
    );
  }

  if (existing.status === "active") {
    return (
      <>
        <h1 className="text-2xl font-extrabold tracking-[-0.04em]">Già confermato</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          L’avviso per <strong>{existing.email}</strong> è già attivo.
        </p>
        <p className="mt-6">
          <Link
            className="font-bold text-primary"
            href={`/avvisi/gestisci?token=${encodeURIComponent(token)}`}
          >
            Gestisci le preferenze
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
          Impossibile confermare
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Riprova oppure crea un nuovo avviso.
        </p>
        <p className="mt-6">
          <Link className="font-bold text-primary" href="/avvisi">
            Crea un avviso
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
      <h1 className="text-2xl font-extrabold tracking-[-0.04em]">Avviso confermato</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        L&apos;iscrizione di <strong>{alert.email}</strong> è attiva. Ti invieremo
        le nuove offerte che corrispondono alle tue preferenze.
      </p>
      <p className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link
          className="font-bold text-primary"
          href={`/avvisi/gestisci?token=${encodeURIComponent(alert.token)}`}
        >
          Gestisci le preferenze
        </Link>
        <Link className="font-bold text-primary" href="/offerte">
          Vedi le offerte
        </Link>
      </p>
    </>
  );
}
