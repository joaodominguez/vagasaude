import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // URLs antigas do BEP partiam o slug com OE202607/0939.
  // Reescreve /vagas/...-OE202607/0939 → /vagas/...-oe202607-0939
  if (pathname.startsWith("/vagas/")) {
    const repaired = repairBepJobPath(pathname);
    if (repaired && repaired !== pathname) {
      const url = request.nextUrl.clone();
      url.pathname = repaired;
      return NextResponse.redirect(url, 308);
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const expectedUser = process.env.ADMIN_USER;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.next();
    }
    return new NextResponse("Backoffice indisponível.", { status: 503 });
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
      // Responde com um novo desafio de autenticação.
    }
  }

  return new NextResponse("Autenticação necessária.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="VagaSaúde Backoffice", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

function repairBepJobPath(pathname: string) {
  // /vagas/<slug-com-OEYYYYMM>/<nnnn>
  const match = pathname.match(
    /^(\/vagas\/.+?)(OE\d{6})\/(\d+)(\/)?$/i,
  );
  if (!match) return null;
  const [, prefix, code, num] = match;
  return `${prefix}${code}-${num}`.toLowerCase();
}

export const config = {
  matcher: ["/admin/:path*", "/vagas/:path*"],
};
