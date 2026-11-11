import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { CookieConsent } from "@/components/cookie-consent";
import {
  ConsentModeDefaults,
  GoogleAnalytics,
} from "@/components/google-analytics";
import { MicrosoftClarity } from "@/components/microsoft-clarity";
import { CardIconSprite } from "@/components/card-icons";
import { SiteStatsTracker } from "@/components/site-stats-tracker";
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
      const saved = localStorage.getItem("vacantessalud-theme");
      const dark = saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    } catch {}
  })();
`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Empleo sanitario en España`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "empleo sanitario",
    "empleo enfermería",
    "empleo TCAE",
    "ofertas hospital",
    "bolsas de empleo sanidad",
    "empleo España",
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
    title: `${SITE_NAME} — Empleo sanitario en España`,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Empleo sanitario en España`,
    description: DEFAULT_DESCRIPTION,
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
    <html lang="es" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ConsentModeDefaults />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </head>
      <body className="min-h-screen">
        <CardIconSprite />
        {children}
        <GoogleAnalytics />
        <MicrosoftClarity />
        <SiteStatsTracker />
        <CookieConsent />
      </body>
    </html>
  );
}
