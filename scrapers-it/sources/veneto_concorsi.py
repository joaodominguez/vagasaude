"""Veneto: portale regionale «Concorsi, Avvisi e Incarichi libero professionali» (Azienda Zero).

https://aziendazero.concorsieavvisi.it (ColdFusion + jQuery). La pagina chiama via AJAX
  GET /index.cfm?action=trasparenza.concorsi_elenco&nomelenco=concorsi_elenco&stato=1&startrow=N&...
(5 bandi per pagina; `stato=1` = "Concorsi Aperti") e, per il dettaglio, la normale pagina
  GET /index.cfm?action=trasparenza.concorso&id=N
Solo richieste pubbliche, le stesse del browser. robots.txt vieta solo `*?action=mys.print`, `*?action=mys.cerca`
e `*debug=mys*`: non si usano.

NB: il portale contiene i bandi centralizzati di Azienda Zero (concorsi aggregati per piu' ULSS, con i posti per
ente) e gli avvisi regionali; i bandi che ogni ULSS pubblica sul proprio sito NON sono qui. Sono ~5 aperti alla volta.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timezone
from html import unescape

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import html_to_text

from . import _it_pub as P

BASE = "https://aziendazero.concorsieavvisi.it"
LIST_URL = (
    BASE + "/index.cfm?action=trasparenza.concorsi_elenco&nomelenco=concorsi_elenco&campord=inizio&tipoord=desc"
    "&titolo=&tipo_reclutamento=0&figura=0&cate_figura=0&specialscad=&ente=0&stato=1&maxrows=5&startrow={start}"
)
DETAIL_URL = BASE + "/index.cfm?action=trasparenza.concorso&id={id}"
MAX_PAGES = 12  # 60 bandi aperti: molto piu' di quelli reali

_LABELS = ("Stato", "Descrizione", "Enti", "Ente", "Data inizio", "Data scadenza", "Figura professionale", "Tipo reclutamento", "Riferimenti")
_LABEL_RE = re.compile(
    r'<td class="stronger[^"]*"[^>]*>\s*(' + "|".join(_LABELS) + r"):\s*</td>", re.I
)
_ID_RE = re.compile(r"action=trasparenza\.concorso&(?:amp;)?id=(\d+)")
_ENTE_POSTS_RE = re.compile(r"^(?P<name>.*?)\s*\((?P<n>\d+)\s+Post[oi]\)\s*$", re.I)


def parse_list(html: str) -> list[str]:
    """ID dei bandi in una pagina dell'elenco (in ordine, senza duplicati)."""
    seen: list[str] = []
    for m in _ID_RE.finditer(html):
        if m.group(1) not in seen:
            seen.append(m.group(1))
    return seen


def _clean(fragment: str) -> str:
    return html_to_text(fragment).strip()


def parse_detail(html: str, ident: str) -> dict | None:
    """Campi del dettaglio; None se la pagina non e' un bando."""
    h1 = re.search(r'<h1 class="titolo">(.*?)</h1>', html, re.S)
    if not h1:
        return None
    start = h1.end()
    end_m = re.search(r'<div class="ballegat">', html[start:])
    block = html[start: start + end_m.start()] if end_m else html[start: start + 20000]
    out: dict = {"id": ident, "title": re.sub(r"\s+", " ", _clean(h1.group(1)))}
    marks = list(_LABEL_RE.finditer(block))
    for i, m in enumerate(marks):
        stop = marks[i + 1].start() if i + 1 < len(marks) else len(block)
        out[m.group(1).lower()] = block[m.end(): stop]
    entes: list[tuple[str, int | None]] = []
    raw_entes = out.get("enti") or out.get("ente") or ""
    for part in re.split(r"<br\s*/?>", raw_entes):
        line = re.sub(r"\s+", " ", _clean(part)).strip()
        if not line:
            continue
        pm = _ENTE_POSTS_RE.match(line)
        if pm:
            entes.append((pm.group("name").strip(), int(pm.group("n"))))
        else:
            entes.append((line, None))
    out["entes"] = entes
    for key in ("stato", "figura professionale", "tipo reclutamento", "data inizio", "data scadenza"):
        out[key] = re.sub(r"\s+", " ", _clean(out.get(key, ""))).strip()
    out["descrizione"] = _clean(out.get("descrizione", ""))
    out["riferimenti"] = _clean(out.get("riferimenti", ""))
    attachments = []
    for am in re.finditer(r'<a href="(/index\.cfm\?action=trasparenza\.concorso_apridoc[^"]+)" class="spostatut">\s*(.*?)</a>', html, re.S):
        attachments.append((re.sub(r"\s+", " ", _clean(am.group(2))), BASE + unescape(am.group(1))))
    out["attachments"] = attachments
    return out


def build_call(detail: dict, now: datetime | None = None, stats: dict | None = None) -> P.Call | None:
    now = now or datetime.now(timezone.utc)
    stats = stats if stats is not None else {}
    title = detail["title"]
    if not title:
        return None
    if detail.get("stato", "").lower() not in ("aperto", "aperta"):
        stats["not_open"] = stats.get("not_open", 0) + 1
        return None
    if P.is_not_open_call(title):
        stats["not_open"] = stats.get("not_open", 0) + 1
        return None
    deadline = P.parse_it_date(detail.get("data scadenza"))
    if deadline and P.end_of_day(deadline) < now:
        stats["expired"] = stats.get("expired", 0) + 1
        return None
    published = P.parse_it_date(detail.get("data inizio"))
    entes: list[tuple[str, int | None]] = detail["entes"]
    figura = detail.get("figura professionale") or ""
    tipo = detail.get("tipo reclutamento") or ""
    concrete_figura = figura and not re.search(r"indicat[ae]/?e? nel bando|^tutte$", figura, re.I)

    health = any(P.is_health_ente(name) for name, _ in entes) or P.is_health_profile(title)
    if not health:
        stats["non_health"] = stats.get("non_health", 0) + 1
        return None

    if P.ACADEMIC_RE.search(title) or P.is_not_job(title):
        stats["non_health"] = stats.get("non_health", 0) + 1
        return None

    title_posts = P.posts_from(title)
    profile = P.extract_profile(title) if title_posts else None
    if not profile and concrete_figura and not figura.lower().startswith("disciplina"):
        profile = P.nice_case(figura)
    if not profile:
        profile = P.extract_profile(title)
    discipline = P.extract_discipline(title)
    if not discipline and re.match(r"(?i)disciplina", figura):
        discipline = P.extract_discipline(figura) or P.nice_case(re.sub(r"(?i)^disciplina\s*(di|in)?\s*", "", figura))
    per_ente_posts = [n for _, n in entes if n]
    total_posts = title_posts or (sum(per_ente_posts) if per_ente_posts else None)

    multi = len(entes) > 1
    if multi or len(entes) == 0:
        company, short = "Azienda Zero — Regione Veneto", "Azienda Zero Veneto"
        city = "Padova"
    else:
        name = entes[0][0]
        company, short = P.nice_ente(name), P.short_ente(name)
        city = "Venezia" if re.search(r"regione veneto", name, re.I) else (P.location_from_text(name)[1] or None)

    kind = P.classify_kind(f"{title} {tipo}")
    job_title = P.build_title(kind, profile, discipline, short, total_posts)
    profession = P.profession_for(profile, discipline, title, True)

    ente_lines = []
    for name, n in entes:
        ente_lines.append(f"- {P.nice_ente(name)}" + (f": {n} post{'o' if n == 1 else 'i'}" if n else ""))
    ident = detail["id"]
    url = DETAIL_URL.format(id=ident)
    parts = [P.nice_case(title) if title.isupper() else title, ""]
    parts.append(f"Tipologia: {kind}" + (f" ({tipo.lower()})" if tipo else ""))
    if total_posts:
        parts.append(f"Posti: {total_posts}")
    if profile:
        parts.append(f"Profilo: {profile}" + (f", disciplina {discipline}" if discipline else ""))
    elif concrete_figura:
        parts.append(f"Figura professionale: {figura}")
    if ente_lines:
        parts.append("Enti che assumono:" if multi else "Ente:")
        parts.extend(ente_lines)
    if published:
        parts.append(f"Data di pubblicazione: {P.fmt_date(published)}")
    if deadline:
        parts.append(f"Scadenza per la presentazione delle domande: {P.fmt_date(deadline)}")
    if detail.get("descrizione"):
        parts.extend(["", "Come candidarsi (dal portale):", detail["descrizione"]])
    if detail.get("attachments"):
        parts.extend(["", "Documenti ufficiali:"])
        parts.extend(f"- {name}: {link}" for name, link in detail["attachments"][:8])
    if detail.get("riferimenti"):
        parts.extend(["", "Riferimenti: " + re.sub(r"\s*\n\s*", " — ", detail["riferimenti"])])
    parts.extend(["", f"Fonte: portale regionale Concorsi, Avvisi e Incarichi (Azienda Zero, Regione Veneto): {url}"])
    description = P.clip_description("\n".join(parts))
    if len(description) < 200:
        stats["thin"] = stats.get("thin", 0) + 1
        return None

    key_entes = [name for name, _ in entes]
    key_posts = [n for _, n in entes]
    if multi or not entes:
        key_entes = ["Azienda Zero"] + key_entes
        key_posts = [None] + key_posts
    key = P.make_key(key_entes, profile, discipline, [total_posts], deadline, key_posts)
    job = JobPayload(
        title=job_title,
        company=company,
        location_district="Veneto",
        location_concelho=city,
        profession=profession,
        specialty=discipline,
        sector="pubblico",
        contract_type=_contract(tipo, kind),
        description=description,
        requirements=None,
        salary=None,
        application_url=url,
        source="veneto-concorsi",
        source_id=f"veneto-{ident}",
        published_at=P.start_of_day(published).isoformat() if published else None,
        expires_at=P.end_of_day(deadline).isoformat() if deadline else None,
    )
    return P.Call(job, key)


def _contract(tipo: str, kind: str) -> str | None:
    t = tipo.lower()
    if "indeterminato" in t:
        return "Tempo indeterminato"
    if "determinato" in t:
        return "Tempo determinato"
    if "autonomo" in t or "libero" in t or kind == P.KIND_INCARICO:
        return "Libero professionale"
    return None


def collect_calls(client: HttpClient, now: datetime | None = None, stats: dict | None = None) -> list[P.Call]:
    ids: list[str] = []
    for page in range(MAX_PAGES):
        html = client.get_text(LIST_URL.format(start=page * 5 + 1))
        page_ids = [i for i in parse_list(html) if i not in ids]
        if not page_ids:
            break
        ids.extend(page_ids)
        if len(parse_list(html)) < 5:
            break
    calls: list[P.Call] = []
    for ident in ids:
        try:
            detail = parse_detail(client.get_text(DETAIL_URL.format(id=ident)), ident)
        except Exception:  # noqa: BLE001
            if stats is not None:
                stats["errors"] = stats.get("errors", 0) + 1
            continue
        call = build_call(detail, now, stats) if detail else None
        if call:
            calls.append(call)
    return calls


class VenetoConcorsiScraper(BaseScraper):
    slug = "veneto-concorsi"
    name = "Veneto — Concorsi, Avvisi e Incarichi (Azienda Zero)"

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        try:
            calls = collect_calls(client, stats=self.stats)
        finally:
            client.close()
        jobs = P.dedupe_titles([c.job for c in calls])
        self.stats["published"] = len(jobs)
        return jobs
