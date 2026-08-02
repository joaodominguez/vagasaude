import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { GoogleAnalytics } from "@/components/google-analytics";
import {
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  DEFAULT_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";
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
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Emprego na saúde em Portugal`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "vagas saúde",
    "emprego enfermagem",
    "emprego medicina",
    "vagas hospital",
    "emprego Portugal",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: SITE_NAME,
    description: "A tua próxima oportunidade na saúde começa aqui.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "pt_PT",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: "A tua próxima oportunidade na saúde começa aqui.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [buildWebsiteJsonLd(), buildOrganizationJsonLd()].map((item) => {
      const { ["@context"]: _context, ...rest } = item;
      void _context;
      return rest;
    }),
  };

  return (
    <html lang="pt" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </head>
      <body className="min-h-screen">
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
