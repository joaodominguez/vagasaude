import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const themeScript = `
  (() => {
    try {
      const saved = localStorage.getItem("vagasaude-theme");
      const dark = saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    } catch {}
  })();
`;

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://vagasaude.pt",
  ),
  title: {
    default: "VagaSaúde — Emprego na saúde em Portugal",
    template: "%s | VagaSaúde",
  },
  description:
    "Todas as vagas de saúde em Portugal num só sítio. Encontra oportunidades no setor público, privado e IPSS.",
  openGraph: {
    title: "VagaSaúde",
    description: "A tua próxima oportunidade na saúde começa aqui.",
    locale: "pt_PT",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
