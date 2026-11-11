import { NextRequest, NextResponse } from "next/server";
import { GONE_JOB_SLUGS } from "@/lib/gone-job-slugs";
import { jobSlugExists } from "@/lib/job-slug-exists";

const GONE_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Vaga removida | VagaSaúde</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f7faf9;color:#10221d}
main{max-width:560px;margin:12vh auto;padding:0 20px}
h1{font-size:1.6rem;margin:0 0 .6rem}
p{line-height:1.6;color:#475569}
a{display:inline-block;margin:1rem .6rem 0 0;padding:.65rem 1.1rem;border-radius:999px;background:#0f766e;color:#fff;text-decoration:none;font-weight:600}
a.sec{background:transparent;color:#0f766e;border:1px solid #0f766e}
</style>
</head>
<body>
<main>
<h1>Esta vaga foi removida</h1>
<p>A vaga que você procura não está mais disponível. Veja as vagas de saúde abertas agora:</p>
<a href="/vagas">Ver vagas abertas</a><a class="sec" href="/">Página inicial</a>
</main>
</body>
</html>`;

function goneResponse() {
  return new NextResponse(GONE_HTML, {
    status: 410,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600",
    },
  });
}

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
    // Vagas que deixaram de existir de vez: 410 (o Google retira-as mais depressa do que com 404).
    const slug = pathname.slice("/vagas/".length).replace(/\/$/, "");
    if (GONE_JOB_SLUGS.has(slug) && !jobSlugExists(slug)) {
      return goneResponse();
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
