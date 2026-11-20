"""Construtor comum das fontes regionais em HTML (ARES Sardegna, ESTAR Toscana, ARCS FVG).

Cada fonte lê o seu elenco e devolve `Item` (dados já limpos); aqui acontece o que é igual para todas, no
mesmo padrão dos leitores IT existentes (plone_er, veneto_concorsi): filtro «só saúde / só recrutamento
externo aberto», profissão e disciplina, tipo de procedimento (concorso / avviso / mobilità / incarico),
região e cidade, ente, prazo (-> expires_at) e CHAVE de deduplicação contra inPA e GU.

A chave (`P.make_key`) usa só dados do ELENCO (título, ente, prazo), nunca o detalhe: assim o modo
«só chaves» (1 pedido por página de elenco, sem textos) dá a mesma chave que a leitura completa.
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from html import unescape

import httpx

from common.http import HttpClient
from common.models import BaseScraper, JobPayload

from . import _it_pub as P
from . import plone_er


@dataclass
class Item:
    ident: str                      # id estável na fonte (slug/URL)
    title: str
    url: str
    deadline: date | None
    published: date | None = None
    entes: list[str] = field(default_factory=list)   # entes que recrutam (vazio = o próprio ente da fonte)
    section: str = ""               # tipologia/categoria da fonte (ajuda o tipo de procedimento)
    figura: str = ""                # figura profissional declarada (se houver)
    body: str = ""                  # texto descritivo (detalhe), só para a descrição
    extra: list[str] = field(default_factory=list)   # linhas «Etichetta: valore»
    docs: list[tuple[str, str]] = field(default_factory=list)  # (nome, URL) de anexos
    city: str | None = None


@dataclass(frozen=True)
class Source:
    slug: str
    label: str            # nome da fonte
    owner: str            # ente titular (company por defeito)
    owner_short: str
    region: str
    city: str             # sede do ente titular
    portal: str           # texto «Fonte: ...»


def _contract(kind: str, text: str) -> str | None:
    low = text.lower()
    if kind == P.KIND_INCARICO:
        return "Libero professionale"
    if kind == P.KIND_TEMPO_DET:
        return "Tempo determinato"  # «a tempo determinato ... nelle more della procedura a tempo indeterminato»
    if re.search(r"indeterminat", low) or (kind == P.KIND_CONCORSO and not re.search(r"determinat", low)):
        return "Tempo indeterminato"
    if re.search(r"determinat|temporane|sostituzion|urgenza|graduatoria", low) or kind == P.KIND_TEMPO_DET:
        return "Tempo determinato"
    return None


# Avvisi riservati al personale interno / convenzionato, elezioni di comitati, docenze e tutor universitari: non sono offerte aperte al pubblico.
INTERNAL_RE = re.compile(
    r"\bavvisi?\s+interni?\b|\bselezione\s+interna\b|\bselezioni\s+interne\b|\bprocedura\s+interna\b|\bpersonale\s+interno\b|"
    r"riservat\w+\s+(?:esclusivamente\s+)?agli?\s+specialisti\s+ambulatoriali\s+interni|"
    r"\belezion[ei]\b|\bcomitato\b|incarichi?\s+didattic|\btutor\b|\bdocenz[ae]\b|\bcorso di formazione\b|\bpermessi retribuiti\b|"
    r"progressione (?:dall|verticale|economica)|dirigente sostituto|sostituto del (?:direttore|titolare)",
    re.I,
)
NO_DEADLINE_MAX_AGE_DAYS = 45   # sem prazo na fonte: so se foi publicado ha pouco; depois segue o TTL (lastSeen + 7 dias)
# «incarico di Direzione della UOC X»: direttore de struttura complessa = medico (o outro dirigente sanitario)
_DIRECTOR_UOC_RE = re.compile(r"\b(?:direzione|direttore)\b.{0,50}\b(?:U\.?\s?O\.?\s?C\.?|struttura complessa)\b", re.I)
GRAD_MAX_AGE_DAYS = 365   # so graduatorie recentes (as listas valem ~3 anos, mas o interesse SEO esta no ano corrente)


def skip_reason(item: Item, now: datetime) -> str | None:
    title = re.sub(r"\s+", " ", item.title).strip()
    if not title:
        return "empty"
    if INTERNAL_RE.search(title):
        return "internal"
    if P.is_graduatoria_act(title):
        # Graduatoria pubblicata: non ha scadenza; serve un profilo sanitario e una data recente (solo titolo, ente, data, link).
        if item.deadline and P.end_of_day(item.deadline) < now and not item.published:
            return "expired"
        if not item.published or (now.date() - item.published).days > GRAD_MAX_AGE_DAYS:
            return "grad_old"
        if P.ACADEMIC_RE.search(title) or P.is_not_job(title) or not plone_er.is_health_call(f"{title} {item.figura}"):
            return "non_health"
        return None
    if item.deadline and P.end_of_day(item.deadline) < now:
        return "expired"
    if not item.deadline and item.published and (now.date() - item.published).days > NO_DEADLINE_MAX_AGE_DAYS:
        return "stale"
    if plone_er._SKIP_SECTION_RE.search(f"{item.section} {title}"):
        return "not_recruitment"
    if P.is_not_open_call(title) or P.is_not_job(title) or P.ACADEMIC_RE.search(title):
        return "not_open"
    if not plone_er.is_health_call(f"{title} {item.figura}") and not _DIRECTOR_UOC_RE.search(title):
        return "non_health"
    return None


def build_call(
    item: Item, src: Source, now: datetime | None = None, stats: dict | None = None, with_detail: bool = True,
) -> P.Call | None:
    now = now or datetime.now(timezone.utc)
    stats = stats if stats is not None else {}
    reason = skip_reason(item, now)
    if reason:
        stats[reason] = stats.get(reason, 0) + 1
        return None
    title = re.sub(r"\s+", " ", item.title).strip()
    if title.isupper():
        title = P.nice_case(title)
    if P.is_graduatoria_act(title):
        return _build_graduatoria(item, title, src)
    entes = [e for e in item.entes if e]
    multi = len(entes) > 1
    if len(entes) == 1:
        company, short = P.nice_ente(entes[0]), P.short_ente(entes[0])
    else:
        company, short = src.owner, src.owner_short
    # Cidade: a do item se a fonte a souber; senão a do ente (se for um só e reconhecido); senão a sede do titular.
    city = item.city
    if not city and len(entes) == 1:
        city = P.location_from_text(entes[0])[1]
    city = city or src.city
    region = src.region

    posts = P.posts_from(title)
    profile = P.extract_profile(title) or (P.nice_case(item.figura) if item.figura and not re.search(r"(?i)^(area|tutte|altro)", item.figura) else None)
    if profile and re.match(r"(?i)^(area sanitaria|area )", profile):
        profile = None
    discipline = P.extract_discipline(title)
    kind = P.classify_kind(f"{title} {item.section}")
    if profile:
        job_title = P.build_title(kind, profile, discipline, short, posts)
    else:
        bare = re.sub(r"(?i)^(?:indizione|avviso(?: pubblico)?|selezione pubblica)[,]?\s*(?:(?:di|per|del)\s+)?", "", title)
        job_title = P.fit_title(f"{kind}: {P.nice_case(bare) if bare.isupper() else bare}", short)
    profession = P.profession_for(profile, discipline, title, True)

    parts = [title, ""]
    if item.body and item.body.strip().lower() != title.lower() and with_detail:
        parts.extend([item.body.strip(), ""])
    parts.append(f"Ente: {company}" + (f" (sede: {city})" if city else ""))
    if multi:
        parts.append("Enti che assumono: " + "; ".join(P.nice_ente(e) for e in entes))
    parts.append(f"Tipologia: {kind}")
    if posts:
        parts.append(f"Posti: {posts}")
    if profile:
        parts.append(f"Profilo: {profile}" + (f", disciplina {discipline}" if discipline else ""))
    if item.published:
        parts.append(f"Data di apertura: {P.fmt_date(item.published)}")
    if item.deadline:
        parts.append(f"Scadenza per la presentazione delle domande: {P.fmt_date(item.deadline)}")
    parts.extend(item.extra)
    if item.docs and with_detail:
        parts.extend(["", "Documenti ufficiali:"])
        parts.extend(f"- {name}: {link}" for name, link in item.docs[:8])
    parts.extend(["", f"Bando integrale e allegati sul sito dell'ente: {item.url}", f"Fonte: {src.portal}."])
    description = P.clip_description("\n".join(parts))
    if with_detail and len(description) < 200:
        stats["thin"] = stats.get("thin", 0) + 1
        return None

    # Chave: enti destinatari + ente titolare della fonte (ARES/ESTAR/ARCS): inPA e GU citano spesso il titolare
    # («ARES Sardegna») e non la ASL destinataria, e viceversa. Servono comunque profilo, disciplina e posti/scadenza uguali.
    key_entes = [*entes, src.owner] if entes else [src.owner]
    key = P.make_key(key_entes, profile, discipline, [posts], item.deadline)
    job = JobPayload(
        title=job_title,
        company=company,
        location_district=region,
        location_concelho=city,
        profession=profession,
        specialty=discipline,
        sector="pubblico",
        contract_type=_contract(kind, f"{title} {item.section}"),
        description=description,
        requirements=None,
        salary=None,
        application_url=item.url,
        source=src.slug,
        source_id=f"{src.slug}-{item.ident}",
        published_at=P.start_of_day(item.published).isoformat() if item.published else None,
        expires_at=P.end_of_day(item.deadline).isoformat() if item.deadline else None,
    )
    return P.Call(job, key)


def _build_graduatoria(item: Item, title: str, src: Source) -> P.Call:
    """Graduatoria pubblicata: SO titolo, ente, data e link ufficiale (mai nomi o punteggi); senza scadenza e senza JobPosting.

    O titulo comeca por «Graduatoria» (job-type.ts classifica por prefixo) e nunca contem «graduatoria finale»/«approvazione»
    (job-store.ts trata esses titulos como avisos fechados e esconde-os).
    """
    entes = [e for e in item.entes if e]
    if len(entes) == 1:
        company, short = P.nice_ente(entes[0]), P.short_ente(entes[0])
    else:
        company, short = src.owner, src.owner_short
    city = item.city or (P.location_from_text(entes[0])[1] if len(entes) == 1 else None) or src.city
    profile = P.extract_profile(title) or (P.nice_case(item.figura) if item.figura else None)
    if profile and re.match(r"(?i)^(area sanitaria|area )", profile):
        profile = None
    discipline = P.extract_discipline(title)
    if profile:
        job_title = P.build_title(P.KIND_GRADUATORIA, profile, discipline, short, None)
    else:
        bare = re.sub(r"(?i)\b(graduatoria|graduatorie|elenco (degli )?idonei|finale|definitiva|provvisoria|di merito|approvazione|esito)\b[:,]?\s*", "", title).strip(" -–—:,")
        job_title = P.fit_title(f"Graduatoria: {P.nice_case(bare) if bare.isupper() else bare}", short)
    profession = P.profession_for(profile, discipline, title, True)
    parts = [
        f"Graduatoria pubblicata da {company}.",
        "",
        title,
        "",
        f"Ente: {company}" + (f" (sede: {city})" if city else ""),
        "Tipologia: Graduatoria",
    ]
    if profile:
        parts.append(f"Profilo: {profile}" + (f", disciplina {discipline}" if discipline else ""))
    if item.published:
        parts.append(f"Data di pubblicazione: {P.fmt_date(item.published)}")
    parts.extend([
        "",
        "Offerte Sanità non pubblica nomi né punteggi dei candidati: per leggere la graduatoria consulta il documento ufficiale dell'ente.",
        f"Documento ufficiale e allegati sul sito dell'ente: {item.url}",
        f"Fonte: {src.portal}.",
    ])
    job = JobPayload(
        title=job_title,
        company=company,
        location_district=src.region,
        location_concelho=city,
        profession=profession,
        specialty=discipline,
        sector="pubblico",
        contract_type=None,
        description=P.clip_description("\n".join(parts)),
        requirements=None,
        salary=None,
        application_url=item.url,
        source=src.slug,
        source_id=f"{src.slug}-{item.ident}",
        published_at=P.start_of_day(item.published).isoformat() if item.published else None,
        expires_at=None,
    )
    # Chave vazia de proposito: uma graduatoria nunca duplica um bando (e nao entra na deduplicacao inPA/GU).
    return P.Call(job, P.make_key([src.owner], profile, discipline, [], None))


# --- infra comum dos leitores a medida (Lazio, Campania) -------------------------------------------------------

def get_retry(client: HttpClient, url: str, tries: int = 3, pause: float = 4.0, post: dict | None = None) -> str:
    """GET (ou POST de formulario) com 3 tentativas e pausa crescente nos 5xx/timeouts; 4xx (403 do WAF incluido) falha logo, sem insistir."""
    for attempt in range(tries):
        try:
            return client.post_form(url, post) if post is not None else client.get_text(url)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code < 500 or attempt == tries - 1:
                raise
        except (httpx.TimeoutException, httpx.TransportError):
            if attempt == tries - 1:
                raise
        time.sleep(pause * (attempt + 1))
    raise RuntimeError("unreachable")


def text_of(fragment: str) -> str:
    """HTML -> texto numa linha (entidades decodificadas)."""
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", fragment or ""))).strip()


def collect(
    src: Source, cache: dict, list_fn, detail_fn, client: HttpClient, now: datetime | None = None,
    stats: dict | None = None, with_detail: bool = True,
) -> list[P.Call]:
    """Lista (1x por processo) + detalhe opcional so dos itens que passam o filtro. Modo `with_detail=False` = so chaves de dedupe."""
    now = now or datetime.now(timezone.utc)
    stats = stats if stats is not None else {}
    if "list" not in cache:
        cache["list"] = list_fn(client, now)
    items = cache["list"]
    stats["listed"] = len(items)
    calls: list[P.Call] = []
    for item in items:
        probe = build_call(item, src, now, {} if with_detail else stats, with_detail=False)
        if probe is None:
            if with_detail:
                build_call(item, src, now, stats, with_detail=False)  # conta o motivo
            continue
        if not with_detail:
            calls.append(probe)
            continue
        if detail_fn is not None:
            try:
                detail_fn(client, item)
            except Exception:  # noqa: BLE001
                stats["errors"] = stats.get("errors", 0) + 1
                continue
        call = build_call(item, src, now, stats, with_detail=True)
        if call:
            calls.append(call)
    return calls


class RegionalScraper(BaseScraper):
    """Leitor de um ente: `module` tem SRC, _CACHE e collect_calls(client, now, stats, with_detail). Lote incompleto (erro de detalhe) nao expira vagas."""

    module = None
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        m = self.module
        m._CACHE.clear()
        client = HttpClient(min_interval=1.1)
        try:
            calls = m.collect_calls(client, stats=self.stats)
        finally:
            client.close()
        jobs = P.dedupe_titles([c.job for c in calls])
        self.stats["published"] = len(jobs)
        self.stats["graduatorie"] = sum(1 for j in jobs if j.title.startswith("Graduatoria"))
        self.last_listings_complete = not self.stats.get("errors")
        return jobs


_DMY_RE = re.compile(r"(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})")


def parse_dmy(text: str | None) -> date | None:
    """«24/11/2026», «24.11.2026», «24-11-2026» -> date (None se invalida)."""
    m = _DMY_RE.search(text or "")
    if not m:
        return None
    try:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    except ValueError:
        return None


def all_dmy(text: str | None) -> list[date]:
    out: list[date] = []
    for m in _DMY_RE.finditer(text or ""):
        try:
            out.append(date(int(m.group(3)), int(m.group(2)), int(m.group(1))))
        except ValueError:
            continue
    return out


_GU_RE = re.compile(r"G\.?\s?U\.?(?:\s?R\.?\s?I\.?)?[^0-9\n]{0,18}\d+\s*(?:del|d[ei]l)\s*(\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{4})", re.I)


def gu_deadline(*texts: str | None) -> date | None:
    """Concursos sem prazo explicito: 30 dias depois da publicacao do extracto na Gazzetta Ufficiale («GU n. 88 del 13.11.2026»)."""
    for text in texts:
        m = _GU_RE.search(text or "")
        if m:
            d = parse_dmy(m.group(1))
            if d:
                return d + timedelta(days=30)
    return None
