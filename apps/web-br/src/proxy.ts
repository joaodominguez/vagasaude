import { NextRequest, NextResponse } from "next/server";
import { GONE_JOB_SLUGS } from "@/lib/gone-job-slugs";
import { jobSlugExists } from "@/lib/job-slug-exists";

const GONE_LINKS: Array<[string, string]> = [
  ["/vagas/enfermagem", "Enfermagem"],
  ["/vagas/farmacia", "Farmácia"],
  ["/vagas/medicina", "Medicina"],
  ["/vagas/sao-paulo", "São Paulo"],
  ["/vagas/minas-gerais", "Minas Gerais"],
  ["/vagas/rio-de-janeiro", "Rio de Janeiro"],
];

// Página leve (sem JS) para vagas removidas de vez: pesquisa, atalhos e alerta, para quem chega
// do Google não ficar num beco sem saída. noindex; o 410 diz ao Google para a retirar.
const GONE_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Vaga removida | VagaSaúde</title>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f7faf9;color:#10221d}
header{border-bottom:1px solid #e2e8f0;background:#fff}
.wrap{max-width:640px;margin:0 auto;padding:0 20px}
.brand{display:inline-block;padding:16px 0;font-weight:800;font-size:1.15rem;color:#10221d;text-decoration:none}
.brand span{color:#0f766e}
main{padding:9vh 0 12vh}
h1{font-size:1.6rem;margin:0 0 .6rem;letter-spacing:-.02em}
p{line-height:1.6;color:#475569;margin:0 0 1.2rem}
form{display:flex;gap:8px;margin:0 0 1.4rem}
input{flex:1;min-width:0;padding:.75rem 1rem;border:1px solid #cbd5e1;border-radius:12px;font:inherit;background:#fff}
button,.btn{padding:.75rem 1.1rem;border:0;border-radius:12px;background:#0f766e;color:#fff;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 1.6rem;padding:0;list-style:none}
.chips a{display:inline-block;padding:.5rem .9rem;border:1px solid #cbd5e1;border-radius:999px;color:#0f766e;text-decoration:none;font-weight:600;background:#fff}
.sec{background:transparent;color:#0f766e;border:1px solid #0f766e}
:focus-visible{outline:2px solid #0f766e;outline-offset:2px}
</style>
</head>
<body>
<header><div class="wrap"><a class="brand" href="/">Vaga<span>Saúde</span></a></div></header>
<main class="wrap">
<h1>Esta vaga foi removida</h1>
<p>A vaga que você procura não está mais disponível. Busque outras vagas abertas na saúde:</p>
<form action="/vagas" method="get" role="search">
<input type="search" name="q" placeholder="Profissão, cargo ou empresa" aria-label="Buscar vagas">
<button type="submit">Buscar</button>
</form>
<ul class="chips">
${GONE_LINKS.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join("")}
</ul>
<a class="btn" href="/vagas">Ver todas as vagas</a> <a class="btn sec" href="/alertas">Criar alerta de vagas</a>
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
