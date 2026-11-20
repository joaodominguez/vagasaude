#!/usr/bin/env python3
"""Relatório mensal de dados do offertesanita.it: «Concorsi sanità aperti — <mese anno>».

Lê o jobs.json (só leitura) e gera:
  - apps/web-it/content/notizie/concorsi-sanita-aperti-<mese>-<anno>.md  (artigo, categoria mercato-del-lavoro)
  - apps/web-it/public/notizie/concorsi-sanita-aperti-<mese>-<anno>-regioni.svg  (gráfico de barras)
  - scrapers-it/reports/snapshots/AAAA-MM-DD.json  (agregados do dia; servem de «início do mês» nos meses seguintes)

Uso (todos os meses, de preferência no dia 1 para criar o snapshot de início de mês; e no fim do mês):
    scp root@91.99.167.243:/var/www/offertesanita/data/jobs.json /tmp/claude-501/it-data/jobs.json
    python3 scrapers-it/tools/monthly_report_it.py --jobs /tmp/claude-501/it-data/jobs.json \\
        [--date AAAA-MM-DD] [--baseline <jobs.json de backup | snapshot.json>] [--baseline-date AAAA-MM-DD] \\
        [--image-slug <nome sem extensão em public/notizie>] [--image-alt "..."] \\
        [--image-credit "Autor / Pexels"] [--image-credit-url https://www.pexels.com/photo/...]
    (a imagem de capa tem de existir em public/notizie/<slug>.webp, -sm.webp e -og.jpg; ver content/notizie/IMAGENS.md)

Sem --baseline procura o snapshot mais antigo do mesmo mês em reports/snapshots/. Se não houver,
a secção de comparação diz que não há dados de início de mês (não inventa).

«Aberta» = mesma regra do site (lib/job-store.ts): estado published, sem título de aviso de esito,
não inativa por data (scadenza passada sem ser vista há <2 dias; não vista há >7 dias; sem scadenza e
publicada há >1 ano) e sem repubblicazioni duplicadas (fica a mais antiga).
Só usa dados reais do jobs.json; não envia nada e não toca no servidor.
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
import unicodedata
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WEB = REPO / "apps" / "web-it"
SNAP_DIR = REPO / "scrapers-it" / "reports" / "snapshots"

MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto",
          "settembre", "ottobre", "novembre", "dicembre"]
MAX_UNSEEN_DAYS = 7
MAX_JOB_AGE_DAYS = 365
# Intervalo plausível entre publicação e scadenza (datas fora disto são erros da fonte).
MIN_SPAN, MAX_SPAN = 1, 365

CLOSED_NOTICE = [
    "graduatoria finale", "approvazione della graduatoria", "approvazione graduatoria", "elenco degli ammessi",
    "elenco ammessi", "elenco dei candidati", "calendario delle prove", "diario delle prove",
    "esito della selezione", "esito selezione", "rettifica del bando",
]


def norm(text: str) -> str:
    t = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", t).strip()


def parse_ts(value) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", str(value))
        if not m:
            return None
        dt = datetime(int(m[3]), int(m[2]), int(m[1]))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def is_closed_notice(title: str) -> bool:
    t = norm(title)
    if re.match(r"^graduatori[ae]\b", t):
        return False
    return any(x in t for x in CLOSED_NOTICE) or t.startswith(("revoca ", "avviso di rettifica", "comunicazione "))


def is_inactive(job: dict, now: datetime) -> bool:
    last_seen = parse_ts(job.get("lastSeenAt") or job.get("updatedAt"))
    expires = parse_ts(job.get("expiresAt"))
    seen_recently = last_seen is not None and (now - last_seen) < timedelta(days=2)
    if expires and expires < now and not seen_recently:
        return True
    if last_seen and (now - last_seen) > timedelta(days=MAX_UNSEEN_DAYS):
        return True
    if expires and expires >= now:
        return False
    published = parse_ts(job.get("publishedAt")) or parse_ts(job.get("createdAt"))
    return bool(published and (now - published) > timedelta(days=MAX_JOB_AGE_DAYS))


def open_jobs(jobs: list[dict], now: datetime) -> list[dict]:
    """Offerte aperte alla data `now` (mesmas regras do site)."""
    cands = [j for j in jobs if j.get("status") == "published" and not is_closed_notice(j.get("title", ""))
             and not is_inactive(j, now)]
    groups: dict[str, list[dict]] = {}
    for j in cands:
        key = "|".join([norm(j.get("title", "")), norm(j.get("company", "")),
                        norm(j.get("locationConcelho") or j.get("locationDistrict") or ""),
                        norm(j.get("description", ""))[:400]])
        groups.setdefault(key, []).append(j)
    out = []
    for lst in groups.values():
        lst.sort(key=lambda j: (j.get("createdAt") or "", j.get("slug") or ""))
        out.append(lst[0])
    return out


def region(j: dict) -> str:
    return (j.get("locationDistrict") or "").strip() or "Italia (nazionale/remoto)"


def aggregates(opn: list[dict]) -> dict:
    pub = [j for j in opn if j.get("sector") == "pubblico"]
    return {
        "total": len(opn),
        "public": len(pub),
        "private": len(opn) - len(pub),
        "by_region": dict(Counter(region(j) for j in opn)),
        "by_region_public": dict(Counter(region(j) for j in pub)),
        "by_profession": dict(Counter(j.get("profession") or "Altro" for j in opn)),
        "by_profession_public": dict(Counter(j.get("profession") or "Altro" for j in pub)),
        "nurses_by_region": dict(Counter(region(j) for j in opn if j.get("profession") == "Infermieristica")),
        "oss_by_region": dict(Counter(region(j) for j in opn if j.get("profession") == "OSS")),
    }


def load_jobs(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return data["jobs"] if isinstance(data, dict) else data


def fmt(n: float | int, dec: int = 0) -> str:
    s = f"{n:,.{dec}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def pct(a: int, b: int) -> str:
    return f"{fmt(100 * a / b, 1)}%" if b else "n/d"


def it_date(d: date) -> str:
    return f"{d.day} {MONTHS[d.month - 1]} {d.year}"


def md_table(headers: list[str], rows: list[list[str]]) -> str:
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    out += ["| " + " | ".join(r) + " |" for r in rows]
    return "\n".join(out)


def svg_bars(title: str, rows: list[tuple[str, int, int]], path: Path) -> None:
    """Barras horizontais empilhadas (público + privado) por região. SVG autónomo com fundo próprio."""
    w, left, right, row_h, top = 760, 190, 70, 30, 52
    h = top + row_h * len(rows) + 28
    mx = max((a + b for _, a, b in rows), default=1)
    scale = (w - left - right) / mx
    esc = lambda s: s.replace("&", "&amp;").replace("<", "&lt;")  # noqa: E731
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{esc(title)}">',
             f'<rect width="{w}" height="{h}" rx="14" fill="#ffffff"/>',
             f'<text x="20" y="30" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="#0f172a">{esc(title)}</text>']
    for i, (name, pub, priv) in enumerate(rows):
        y = top + i * row_h
        parts.append(f'<text x="{left - 10}" y="{y + 15}" text-anchor="end" font-family="Arial,sans-serif" font-size="13" fill="#334155">{esc(name)}</text>')
        wp, wv = pub * scale, priv * scale
        parts.append(f'<rect x="{left}" y="{y}" width="{wp:.1f}" height="20" fill="#0f766e"/>')
        parts.append(f'<rect x="{left + wp:.1f}" y="{y}" width="{wv:.1f}" height="20" fill="#94a3b8"/>')
        parts.append(f'<text x="{left + wp + wv + 8:.1f}" y="{y + 15}" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#0f172a">{pub + priv}</text>')
    ly = h - 12
    parts.append(f'<rect x="{left}" y="{ly - 9}" width="12" height="12" fill="#0f766e"/><text x="{left + 18}" y="{ly + 1}" font-family="Arial,sans-serif" font-size="12" fill="#334155">Enti pubblici</text>')
    parts.append(f'<rect x="{left + 120}" y="{ly - 9}" width="12" height="12" fill="#94a3b8"/><text x="{left + 138}" y="{ly + 1}" font-family="Arial,sans-serif" font-size="12" fill="#334155">Privato e agenzie</text>')
    parts.append("</svg>")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(parts), encoding="utf-8")


def span_days(opn: list[dict]) -> tuple[list[float], int]:
    spans, excluded = [], 0
    for j in opn:
        p, e = parse_ts(j.get("publishedAt")) or parse_ts(j.get("createdAt")), parse_ts(j.get("expiresAt"))
        if not p or not e:
            continue
        d = (e - p).total_seconds() / 86400
        if MIN_SPAN <= d <= MAX_SPAN:
            spans.append(d)
        else:
            excluded += 1
    return spans, excluded


def find_baseline(asof: date, explicit: Path | None, explicit_date: date | None):
    """Devolve (agregados, data) do início do mês, ou None."""
    if explicit:
        if explicit.suffix == ".json":
            raw = json.loads(explicit.read_text(encoding="utf-8"))
            if isinstance(raw, dict) and "aggregates" in raw:
                return raw["aggregates"], date.fromisoformat(raw["date"])
        d = explicit_date or asof.replace(day=1)
        now = datetime(d.year, d.month, d.day, 4, 30, tzinfo=timezone.utc)
        jobs = load_jobs(explicit)
        return aggregates(open_jobs(jobs, now)), d
    if SNAP_DIR.exists():
        cands = sorted(p for p in SNAP_DIR.glob(f"{asof.year}-{asof.month:02d}-*.json") if p.stem < asof.isoformat())
        if cands:
            raw = json.loads(cands[0].read_text(encoding="utf-8"))
            return raw["aggregates"], date.fromisoformat(raw["date"])
    return None


def delta(now: int, before: int) -> str:
    d = now - before
    return f"{'+' if d > 0 else ''}{fmt(d)}"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--jobs", required=True, type=Path)
    ap.add_argument("--date", type=date.fromisoformat, default=date.today())
    ap.add_argument("--baseline", type=Path)
    ap.add_argument("--baseline-date", type=date.fromisoformat)
    ap.add_argument("--out-dir", type=Path, default=WEB / "content" / "notizie")
    ap.add_argument("--public-dir", type=Path, default=WEB / "public" / "notizie")
    ap.add_argument("--image-slug")
    ap.add_argument("--image-alt", default="")
    ap.add_argument("--image-credit", default="")
    ap.add_argument("--image-credit-url", default="")
    ap.add_argument("--no-snapshot", action="store_true")
    args = ap.parse_args()

    asof: date = args.date
    now = datetime(asof.year, asof.month, asof.day, 23, 59, tzinfo=timezone.utc) if asof < date.today() else datetime.now(timezone.utc)
    mese = MONTHS[asof.month - 1]
    slug = f"concorsi-sanita-aperti-{mese}-{asof.year}"

    all_jobs = load_jobs(args.jobs)
    opn = open_jobs(all_jobs, now)
    agg = aggregates(opn)
    total, n_pub, n_priv = agg["total"], agg["public"], agg["private"]
    sources = Counter(j.get("source") or "n/d" for j in opn)

    reg_rows = sorted(agg["by_region"].items(), key=lambda kv: (-kv[1], kv[0]))
    prof_rows = sorted(agg["by_profession"].items(), key=lambda kv: (-kv[1], kv[0]))

    # ---- tempi medi ----
    pub_jobs = [j for j in opn if j.get("sector") == "pubblico"]
    sp_all, ex_all = span_days(pub_jobs)
    sp_nurse, _ = span_days([j for j in pub_jobs if j.get("profession") == "Infermieristica"])
    sp_oss, _ = span_days([j for j in pub_jobs if j.get("profession") == "OSS"])
    with_deadline = [j for j in pub_jobs if parse_ts(j.get("expiresAt"))]
    remaining = [(parse_ts(j["expiresAt"]) - now).total_seconds() / 86400 for j in with_deadline
                 if now <= parse_ts(j["expiresAt"]) <= now + timedelta(days=MAX_SPAN)]

    def span_line(label: str, s: list[float]) -> list[str]:
        if not s:
            return [label, "0", "n/d", "n/d"]
        return [label, fmt(len(s)), f"{fmt(statistics.mean(s), 1)} giorni", f"{fmt(statistics.median(s), 0)} giorni"]

    # ---- confronto ----
    base = find_baseline(asof, args.baseline, args.baseline_date)

    # ---- grafico ----
    top_regs = [r for r in reg_rows][:12]
    chart_rows = [(r, agg["by_region_public"].get(r, 0), n - agg["by_region_public"].get(r, 0)) for r, n in top_regs]
    chart_name = f"{slug}-regioni.svg"
    svg_bars(f"Offerte aperte per regione, {it_date(asof)}", chart_rows, args.public_dir / chart_name)

    # ---- testo ----
    L: list[str] = []
    top3 = ", ".join(f"{r} ({fmt(n)})" for r, n in reg_rows[:3])
    L.append(
        f"Il {it_date(asof)} su Offerte Sanità risultano **{fmt(total)} offerte di lavoro sanitarie aperte** in Italia: "
        f"**{fmt(n_pub)} di enti pubblici** (concorsi, avvisi a tempo determinato, mobilità, incarichi) e "
        f"{fmt(n_priv)} di strutture private, RSA e agenzie. Le regioni con più offerte sono {top3}. "
        f"Tutti i numeri sono calcolati dal nostro archivio, sulle offerte realmente aperte alla data indicata (vedi la metodologia in fondo)."
    )
    L.append("## Offerte aperte per regione")
    L.append(f"![Offerte aperte per regione, {it_date(asof)}: ripartizione fra enti pubblici e privato](/notizie/{chart_name})")
    rows = []
    for r, n in reg_rows:
        p = agg["by_region_public"].get(r, 0)
        rows.append([r, fmt(n), fmt(p), fmt(n - p), pct(n, total)])
    L.append(md_table(["Regione", "Totale", "Pubblico", "Privato", "% del totale"], rows))
    south = ["Abruzzo", "Basilicata", "Calabria", "Campania", "Molise", "Puglia", "Sardegna", "Sicilia"]
    s_tot = sum(agg["by_region"].get(r, 0) for r in south)
    s_pub = sum(agg["by_region_public"].get(r, 0) for r in south)
    L.append(f"Nel Sud e nelle Isole (Abruzzo, Basilicata, Calabria, Campania, Molise, Puglia, Sardegna, Sicilia) le offerte aperte sono {fmt(s_tot)}, il {pct(s_tot, total)} del totale; "
             f"{fmt(s_pub)} sono di enti pubblici. La copertura delle aziende sanitarie meridionali sul sito è ancora in crescita: il confronto fra regioni riflette anche le fonti che al momento riusciamo a leggere.")

    L.append("## Offerte aperte per professione")
    prows = []
    for p, n in prof_rows:
        pp = agg["by_profession_public"].get(p, 0)
        prows.append([p, fmt(n), fmt(pp), fmt(n - pp), pct(n, total)])
    L.append(md_table(["Professione", "Totale", "Pubblico", "Privato", "% del totale"], prows))

    L.append("## Dove si cerca di più: infermieri e OSS")
    for label, key, prof in (("Infermieri", "nurses_by_region", "Infermieristica"), ("OSS", "oss_by_region", "OSS")):
        n_all = agg["by_profession"].get(prof, 0)
        n_p = agg["by_profession_public"].get(prof, 0)
        top = sorted(agg[key].items(), key=lambda kv: (-kv[1], kv[0]))[:6]
        L.append(f"### {label}: {fmt(n_all)} offerte aperte ({fmt(n_p)} pubbliche)")
        pub_by = Counter(region(j) for j in pub_jobs if j.get("profession") == prof)
        L.append(md_table(["Regione", "Offerte", "di cui pubbliche"],
                          [[r, fmt(n), fmt(pub_by.get(r, 0))] for r, n in top]))

    L.append("## Pubblico e privato")
    L.append(md_table(["Settore", "Offerte", "% del totale"],
                      [["Enti pubblici (ASL, ASST, ospedali, IRCCS pubblici, enti regionali)", fmt(n_pub), pct(n_pub, total)],
                       ["Privato, accreditato e agenzie per il lavoro", fmt(n_priv), pct(n_priv, total)]]))
    big = Counter(j.get("company") or "n/d" for j in opn).most_common(5)
    L.append("I cinque datori di lavoro con più offerte aperte: " + ", ".join(f"{c} ({fmt(n)})" for c, n in big)
             + ". Le offerte private sono concentrate in pochi gruppi e in un'agenzia per il lavoro; il pubblico è molto più frammentato fra molte aziende.")

    L.append("## Quanto tempo passa fra pubblicazione e scadenza")
    L.append(f"Per i bandi pubblici con una scadenza dichiarata abbiamo misurato i giorni fra la data di pubblicazione e quella di scadenza delle domande "
             f"(esclusi {fmt(ex_all)} casi con date incoerenti, oltre un anno o negative).")
    L.append(md_table(["Gruppo", "Bandi misurati", "Media", "Mediana"],
                      [span_line("Tutti i bandi pubblici", sp_all), span_line("Infermieri", sp_nurse), span_line("OSS", sp_oss)]))
    if remaining:
        L.append(f"Oggi i bandi pubblici con scadenza futura sono {fmt(len(remaining))}; a quelli ancora aperti restano in media "
                 f"{fmt(statistics.mean(remaining), 1)} giorni (mediana {fmt(statistics.median(remaining), 0)}). "
                 f"{fmt(sum(1 for d in remaining if d <= 7))} scadono entro 7 giorni e {fmt(sum(1 for d in remaining if d <= 14))} entro 14: "
                 f"li trovi nella pagina [concorsi in scadenza](/concorsi/in-scadenza) e nel [calendario dei concorsi](/concorsi/calendario).")

    L.append("## Il confronto con l'inizio del mese")
    if base:
        b, bdate = base
        L.append(f"Confronto con il dato del {it_date(bdate)} (primo archivio giornaliero disponibile del mese, calcolato con le stesse regole).")
        comp = [["Offerte aperte", fmt(b["total"]), fmt(total), delta(total, b["total"])],
                ["di cui pubbliche", fmt(b["public"]), fmt(n_pub), delta(n_pub, b["public"])],
                ["di cui private", fmt(b["private"]), fmt(n_priv), delta(n_priv, b["private"])],
                ["Infermieri", fmt(b["by_profession"].get("Infermieristica", 0)), fmt(agg["by_profession"].get("Infermieristica", 0)),
                 delta(agg["by_profession"].get("Infermieristica", 0), b["by_profession"].get("Infermieristica", 0))],
                ["OSS", fmt(b["by_profession"].get("OSS", 0)), fmt(agg["by_profession"].get("OSS", 0)),
                 delta(agg["by_profession"].get("OSS", 0), b["by_profession"].get("OSS", 0))]]
        L.append(md_table(["", f"{it_date(bdate)}", f"{it_date(asof)}", "Variazione"], comp))
        movers = sorted(((r, agg["by_region"].get(r, 0) - b["by_region"].get(r, 0)) for r in set(agg["by_region"]) | set(b["by_region"])),
                        key=lambda kv: -abs(kv[1]))[:5]
        L.append("Le regioni con la variazione più grande: " + ", ".join(f"{r} ({'+' if d > 0 else ''}{fmt(d)})" for r, d in movers if d) + ".")
        L.append("Attenzione: la variazione non misura solo il mercato. Nel periodo abbiamo aggiunto nuove fonti (aziende sanitarie e gruppi privati) e "
                 "i bandi chiusi escono dal conteggio, quindi il saldo va letto come indicazione e non come tendenza del settore.")
    else:
        L.append("Per questo mese non abbiamo un dato di inizio periodo confrontabile: il primo "
                 "rilevamento mensile è quello di questo report. Dal prossimo mese il confronto sarà disponibile.")

    L.append("## Metodologia e campione")
    L.append(f"- **Data dei dati**: {it_date(asof)}.\n"
             f"- **Campione**: {fmt(total)} offerte aperte, su {fmt(len(all_jobs))} record dell'archivio (le altre sono scadute, duplicate o non più confermate dalla fonte), provenienti da {len(sources)} fonti.\n"
             "- **Offerta aperta**: pubblicata dalla fonte, con scadenza non trascorsa (o senza scadenza ma confermata dalla fonte negli ultimi 7 giorni), senza avvisi di esito o rettifica e senza ripubblicazioni duplicate.\n"
             "- **Pubblico**: enti del Servizio sanitario e altre pubbliche amministrazioni; **privato**: strutture private, RSA, gruppi sanitari e agenzie per il lavoro.\n"
             "- **Fonti**: portali istituzionali delle aziende sanitarie, inPA, Gazzetta Ufficiale (4ª Serie Speciale) e siti di lavoro dei gruppi privati; non è un censimento di tutti i bandi d'Italia ma dei bandi che leggiamo.\n"
             f"- **Come citare**: «Offerte Sanità, Concorsi sanità aperti — {mese} {asof.year}», https://offertesanita.it/notizie/{slug}, dati del {it_date(asof)}.")
    L.append("Ogni mese aggiorniamo questo report. Il panorama sempre aggiornato è nella pagina [Dati](/dati).")
    body = "\n\n".join(L)

    # ---- frontmatter ----
    nurse_top = sorted(agg["nurses_by_region"].items(), key=lambda kv: -kv[1])[:3]
    oss_top = sorted(agg["oss_by_region"].items(), key=lambda kv: -kv[1])[:3]
    summary = [
        f"Il {it_date(asof)} sono aperte {fmt(total)} offerte di lavoro sanitarie su Offerte Sanità: {fmt(n_pub)} di enti pubblici ({pct(n_pub, total)}) e {fmt(n_priv)} private.",
        f"Più offerte in {', '.join(r for r, _ in reg_rows[:3])}. Per gli infermieri: {', '.join(f'{r} ({n})' for r, n in nurse_top)}; per gli OSS: {', '.join(f'{r} ({n})' for r, n in oss_top)}.",
    ]
    if sp_all:
        summary.append(f"Tra pubblicazione e scadenza dei bandi pubblici passano in media {fmt(statistics.mean(sp_all), 0)} giorni (mediana {fmt(statistics.median(sp_all), 0)}), su {fmt(len(sp_all))} bandi misurati.")
    description = (f"Report mensile con i dati del {it_date(asof)}: {fmt(total)} offerte sanitarie aperte in Italia per regione e professione, "
                   f"pubblico e privato, tempi fra pubblicazione e scadenza, regioni con più offerte per infermieri e OSS.")
    fm = ["---", f'title: "Concorsi sanità aperti — {mese} {asof.year}: i dati per regione e professione"', f"slug: {slug}",
          f"date: {asof.isoformat()}", "category: mercato-del-lavoro"]
    if args.image_slug or (args.public_dir / f"{slug}.webp").exists():
        img = args.image_slug or slug
        fm += [f"image: /notizie/{img}.webp", f'imageAlt: "{args.image_alt or "Documenti, lente d\'ingrandimento e smartphone su una scrivania"}"']
        if args.image_credit:
            fm.append(f'imageCredit: "{args.image_credit}"')
        if args.image_credit_url:
            fm.append(f'imageCreditUrl: "{args.image_credit_url}"')
    fm += ["draft: false", "professions:", "  - Infermieristica", "  - OSS", f'description: "{description}"', "summary:"]
    fm += [f'  - "{s}"' for s in summary]
    fm += ["sources:",
           '  - label: "Offerte Sanità - Mercato del lavoro sanitario: panorama delle offerte (dati aggiornati)"', '    url: "https://offertesanita.it/dati"',
           '  - label: "inPA - Portale del reclutamento nella PA"', '    url: "https://www.inpa.gov.it/"',
           '  - label: "Gazzetta Ufficiale, 4ª Serie Speciale - Concorsi ed esami"', '    url: "https://www.gazzettaufficiale.it/30giorni/concorsi"',
           "---", ""]

    args.out_dir.mkdir(parents=True, exist_ok=True)
    out = args.out_dir / f"{slug}.md"
    out.write_text("\n".join(fm) + "\n" + body + "\n", encoding="utf-8")
    if not args.no_snapshot:
        SNAP_DIR.mkdir(parents=True, exist_ok=True)
        (SNAP_DIR / f"{asof.isoformat()}.json").write_text(
            json.dumps({"date": asof.isoformat(), "sample": len(all_jobs), "aggregates": agg}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"OK {out} | aperte={total} pubbliche={n_pub} private={n_priv} regioni={len(reg_rows)} fonti={len(sources)} "
          f"baseline={'sì' if base else 'no'} grafico={args.public_dir / chart_name}")


if __name__ == "__main__":
    main()
