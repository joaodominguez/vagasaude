"""Escolhe as vagas BR para o post diário (só leitura). Corre no servidor: python3 - < social_pick_br.py"""
import json, re
from datetime import datetime, timedelta, timezone
BASE = "/var/www/vagasaudebr/data"
DAYS = ["2026-11-14", "2026-11-15"]          # últimas 48 h completas (fim de semana)
NOW = datetime(2026, 11, 16, tzinfo=timezone.utc)
ANON = re.compile(r"confidencial|empresa anunciante|sigilo|anônim|anonim", re.I)
NONCLIN = re.compile(r"banco de talentos|cadastro reserva|aprendiz|estagi|cozinh|copeir|porteir|vigilant|eletricist|manuten", re.I)
SECONDARY = {"Administrativo", "Gestão", "Outros"}
stats = json.load(open(f"{BASE}/site-stats.json"))["days"]
jobs = json.load(open(f"{BASE}/jobs.json")); jobs = jobs["jobs"] if isinstance(jobs, dict) else jobs
by = {}
for j in jobs:
    if j.get("slug") and j.get("status") == "published":
        by.setdefault(j["slug"], j)
score = {}
for d in DAYS:
    st = stats.get(d, {})
    for p, n in st.get("paths", {}).items():
        if p.startswith("/vagas/"):
            s = p[7:].strip("/")
            if s in by: score[s] = score.get(s, 0) + n
    for s, n in st.get("applyBySlug", {}).items():
        if s in by: score[s] = score.get(s, 0) + 3 * n
def recent(j):
    t = j.get("publishedAt") or j.get("createdAt")
    try: return NOW - datetime.fromisoformat(t.replace("Z", "+00:00")) <= timedelta(days=14)
    except Exception: return False
cands = []
for s, sc in score.items():
    j = by[s]
    if not recent(j) or ANON.search(j.get("company") or "") or NONCLIN.search(j.get("title") or ""): continue
    cands.append((j.get("profession") in SECONDARY, -sc, s))
cands.sort()
picked, seen_c, seen_p = [], set(), set()
for _, nsc, s in cands:
    j = by[s]
    if j.get("company") in seen_c or j.get("profession") in seen_p: continue
    picked.append({"slug": s, "score": -nsc, "title": j.get("title"), "company": j.get("company"), "city": j.get("city"),
                   "state": j.get("district") or j.get("state"), "profession": j.get("profession"), "contract": j.get("contract"),
                   "salary": j.get("salary"), "workload": j.get("workload") or j.get("schedule")})
    seen_c.add(j.get("company")); seen_p.add(j.get("profession"))
    if len(picked) == 4: break
print(json.dumps(picked, ensure_ascii=False, indent=1))
