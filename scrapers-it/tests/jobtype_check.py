"""Esegue il VERO classifyJob di apps/web-it/src/lib/job-type.ts (transpilato con il typescript dell'app) su un elenco di offerte.

Usato dai test dei lettori per verificare che i titoli producano il tipo atteso (concorso, mobilita', ...).
Se node o apps/web-it/node_modules/typescript non ci sono, restituisce None (i test fanno skip).
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "apps" / "web-it"
NODE_CANDIDATES = [
    os.environ.get("NODE_BIN"),
    "/Users/joaodominguez/.nvm/versions/node/v20.17.0/bin/node",
    shutil.which("node"),
]

SCRIPT = r"""
const fs = require("fs");
const [app] = process.argv.slice(1);
const ts = require(app + "/node_modules/typescript");
const src = fs.readFileSync(app + "/src/lib/job-type.ts", "utf8");
const out = ts.transpileModule(src, { compilerOptions: { module: "commonjs", target: "es2020" } }).outputText;
const m = { exports: {} };
new Function("require", "module", "exports", out)(
  (id) => (id === "@/lib/sources" ? { SOURCE_META: {} } : require(id)), m, m.exports);
const jobs = JSON.parse(fs.readFileSync(0, "utf8"));
console.log(JSON.stringify(jobs.map((j) => m.exports.classifyJob({ title: j.title, description: j.description || "", sector: "Pubblico", source: j.source || "x" }))));
"""


def classify(jobs: list[dict]) -> list[str] | None:
    if not (APP / "node_modules" / "typescript").exists():
        return None
    for node in NODE_CANDIDATES:
        if not node or not Path(node).exists():
            continue
        try:
            proc = subprocess.run(
                [node, "-e", SCRIPT, str(APP)], input=json.dumps(jobs), capture_output=True, text=True, timeout=60
            )
        except Exception:  # noqa: BLE001
            continue
        if proc.returncode == 0 and proc.stdout.strip():
            return json.loads(proc.stdout.strip().splitlines()[-1])
    return None
