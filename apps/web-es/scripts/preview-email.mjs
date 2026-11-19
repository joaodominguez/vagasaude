// Pré-visualização local do email de alertas (resumo diário): não envia nada.
// Uso: DATA_DIR=<pasta com jobs.json> node scripts/preview-email.mjs <pasta-de-saída> [profissão] [distrito]
// Gera digest.html (imagens apontam para public/email/ em disco), digest.txt e digest-subject.txt.
import { createJiti } from "jiti";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [out, profession = "", district = ""] = process.argv.slice(2);
if (!out) {
  console.error("Uso: node scripts/preview-email.mjs <pasta-de-saída> [profissão] [distrito]");
  process.exit(1);
}
process.env.DATA_DIR ??= path.join(root, "data");

const jiti = createJiti(import.meta.url, { alias: { "@": path.join(root, "src") }, moduleCache: false });
const { listJobCards } = await jiti.import("../src/lib/job-store.ts");
const { alertMatchesJob } = await jiti.import("../src/lib/alerts.ts");
const { newJobsDigestEmail } = await jiti.import("../src/lib/email.ts");
const { SITE_URL } = await jiti.import("../src/lib/seo.ts");

const all = await listJobCards();
const alert = {
  id: "preview", email: "preview@example.com", token: "preview-token", status: "active",
  filters: { ...(profession ? { profession } : {}), ...(district ? { district } : {}) },
  createdAt: "", updatedAt: "", confirmedAt: null, unsubscribedAt: null,
};
const matching = all
  .filter((job) => alertMatchesJob(alert, job))
  .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

// 5 vagas reais variadas: as mais recentes, mas com uma com salário, uma pública e uma privada se existirem.
const picked = [];
const add = (job) => job && !picked.includes(job) && picked.length < 5 && picked.push(job);
add(matching.find((j) => j.salary && /\d/.test(j.salary)));
add(matching.find((j) => j.sector === "Público"));
add(matching.find((j) => j.sector === "Privado"));
for (const job of matching) add(job);
picked.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

const email = newJobsDigestEmail(alert, picked, matching.length, all);
const emailDir = pathToFileURL(path.join(root, "public", "email") + "/").href;
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "digest.html"), email.html.replaceAll(`${SITE_URL}/email/`, emailDir), "utf8");
writeFileSync(path.join(out, "digest.txt"), `${email.subject}\n\n${email.text}\n`, "utf8");
console.log(`[preview] ${picked.length}/${matching.length} vagas — ${email.subject}`);
