#!/usr/bin/env node
/**
 * Pesquisa Diário da República (OutSystems + Elastic) via Chrome headless.
 * Uso: node tools/dre_search.mjs ['query1', 'query2']
 * Escreve JSON array de hits _source para stdout.
 */
import puppeteer from "puppeteer-core";
import process from "node:process";

const CHROME =
  process.env.GOOGLE_CHROME_BIN ||
  process.env.CHROME_PATH ||
  "/usr/local/bin/google-chrome";

const QUERIES = JSON.parse(
  process.argv[2] ||
    JSON.stringify([
      "procedimento concursal enfermeiro",
      'procedimento concursal "Unidade Local de Saúde"',
      'procedimento concursal "técnico auxiliar de saúde"',
      'procedimento concursal "Instituto Português de Oncologia"',
      "procedimento concursal fisioterapeuta",
      "procedimento concursal médico Unidade Local",
      "Aviso recrutamento enfermagem",
    ]),
);

async function searchRecent(page, query) {
  let firstReq = null;
  const onRequest = (req) => {
    if (
      !firstReq &&
      req.url().includes("DataActionGetPesquisas") &&
      req.method() === "POST"
    ) {
      firstReq = { headers: req.headers(), postData: req.postData() };
    }
  };
  page.on("request", onRequest);
  try {
    await page.goto("https://diariodarepublica.pt/dr/home", {
      waitUntil: "networkidle2",
      timeout: 90000,
    });
    await new Promise((r) => setTimeout(r, 2000));
    const focused = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll("input")];
      const el =
        inputs.find((i) =>
          (i.placeholder || "").toLowerCase().includes("pesquis"),
        ) ||
        inputs.find(
          (i) => i.offsetParent && i.getBoundingClientRect().width > 100,
        );
      if (!el) return false;
      el.focus();
      el.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    });
    if (!focused) throw new Error("Campo de pesquisa DR não encontrado");
    await page.keyboard.type(query, { delay: 8 });
    await page.keyboard.press("Enter");
    for (let i = 0; i < 30 && !firstReq; i++) {
      await new Promise((r) => setTimeout(r, 400));
    }
    if (!firstReq) throw new Error("Sem DataActionGetPesquisas");
    const body = JSON.parse(firstReq.postData);
    body.screenData.variables.TipoOrdenacaoId = 8;
    body.screenData.variables.Ordenacoes = {
      List: [
        { Field: "whenSearchable", Order: "desc" },
        { Field: "dbId", Order: "desc" },
      ],
    };
    body.screenData.variables.MaxRecordsPerPage = 100;
    body.screenData.variables.ResultadosPorPaginaId = 3;
    body.screenData.variables.StartIndex = 0;
    const csrf = firstReq.headers["x-csrftoken"];
    const text = await page.evaluate(
      async ({ body, csrf }) => {
        const res = await fetch(
          "/dr/screenservices/dr/Pesquisas/PesquisaResultado/DataActionGetPesquisas",
          {
            method: "POST",
            headers: {
              "content-type": "application/json; charset=UTF-8",
              accept: "application/json",
              "x-csrftoken": csrf,
              "outsystems-locale": "pt-PT",
            },
            body: JSON.stringify(body),
            credentials: "include",
          },
        );
        return await res.text();
      },
      { body, csrf },
    );
    const data = JSON.parse(text);
    const resultado = JSON.parse(data.data.Resultado);
    return resultado.hits.hits.map((h) => h._source);
  } finally {
    page.off("request", onRequest);
  }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  userDataDir: process.env.DRE_USER_DATA_DIR || "/tmp/vagasaude-dre-chrome",
});

try {
  const page = await browser.newPage();
  const byId = new Map();
  for (const query of QUERIES) {
    try {
      const hits = await searchRecent(page, query);
      for (const src of hits) {
        const id = String(src.dbId || src.id || "");
        if (id) byId.set(id, src);
      }
      console.error(`[dre] ${query}: +${hits.length} (unique ${byId.size})`);
    } catch (err) {
      console.error(`[dre] ERRO ${query}: ${err.message || err}`);
    }
  }
  process.stdout.write(JSON.stringify([...byId.values()]));
} finally {
  await browser.close();
}
