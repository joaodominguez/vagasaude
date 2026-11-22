import { recordEmailEvent, verifySvix } from "@/lib/email-events-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 256 * 1024;

const seen = new Map<string, number>();

function reply(status: number, body = "") {
  return new Response(body || null, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** Webhook da Resend (Svix). Nunca responde com detalhes do payload. */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) return reply(503);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) return reply(413);
  const body = await request.text();
  if (body.length > MAX_BODY) return reply(413);

  const id = request.headers.get("svix-id");
  const ok = verifySvix(
    secret,
    {
      id,
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    body,
  );
  if (!ok) return reply(401);

  // Deduplicação das repetições da Svix (em memória).
  if (id) {
    if (seen.has(id)) return reply(200);
    seen.set(id, Date.now());
    if (seen.size > 5000) {
      for (const key of [...seen.keys()].slice(0, 2500)) seen.delete(key);
    }
  }

  try {
    await recordEmailEvent(JSON.parse(body));
  } catch (error) {
    if (id) seen.delete(id);
    console.error("email-events: falha a gravar", error);
    return reply(500);
  }
  return reply(200);
}

export function GET() {
  return reply(405);
}
