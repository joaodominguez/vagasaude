import { NextRequest, NextResponse } from "next/server";

import { expiredConcorsoRedirectTarget } from "@/lib/expired-redirect";
import { resolveCategoryFromSegments } from "@/lib/categories";

const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || "https://offertesanita.it").replace(/\/$/, "");

/**
 * A5: pagina di un concorso pubblico chiuso da piu' di 90 giorni → 301 verso /concorsi/... (vedi
 * lib/expired-redirect.ts). Nel proxy e non in redirect() della pagina (Next 16 duplica Location).
 * Qualsiasi errore → la pagina risponde come prima.
 */
async function expiredConcorsoRedirect(request: NextRequest) {
  const match = /^\/offerte\/([^/]+)\/?$/.exec(request.nextUrl.pathname);
  if (!match) return NextResponse.next();
  try {
    let slug = match[1];
    try {
      slug = decodeURIComponent(slug);
    } catch {
      return NextResponse.next();
    }
    if (resolveCategoryFromSegments(slug)) return NextResponse.next();
    const target = await expiredConcorsoRedirectTarget(slug);
    if (!target) return NextResponse.next();
    return new NextResponse(null, {
      status: 301,
      headers: {
        Location: `${SITE_ORIGIN}${target}`,
        "Cache-Control": "public, max-age=600, s-maxage=600",
      },
    });
  } catch {
    return NextResponse.next();
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return expiredConcorsoRedirect(request);
  }

  const expectedUser = process.env.ADMIN_USER;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.next();
    }
    return new NextResponse("Backoffice non disponibile.", { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    try {
      const credentials = Buffer.from(authorization.slice(6), "base64").toString(
        "utf8",
      );
      const separator = credentials.indexOf(":");
      const user = credentials.slice(0, separator);
      const password = credentials.slice(separator + 1);

      if (
        separator > 0 &&
        user === expectedUser &&
        password === expectedPassword
      ) {
        return NextResponse.next();
      }
    } catch {
      // Risponde con una nuova richiesta di autenticazione.
    }
  }

  return new NextResponse("Autenticazione necessaria.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Offerte Sanità Backoffice", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/admin/:path*", "/offerte/:slug"],
};
