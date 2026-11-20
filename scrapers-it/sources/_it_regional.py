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
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

from common.models import JobPayload

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
    if re.search(r"indeterminat", low) or (kind == P.KIND_CONCORSO and not re.search(r"determinat", low)):
        return "Tempo indeterminato"
    if re.search(r"determinat|temporane|sostituzion|urgenza|graduatoria", low) or kind == P.KIND_TEMPO_DET:
        return "Tempo determinato"
    return None


def skip_reason(item: Item, now: datetime) -> str | None:
    title = re.sub(r"\s+", " ", item.title).strip()
    if not title:
        return "empty"
    if item.deadline and P.end_of_day(item.deadline) < now:
        return "expired"
    if plone_er._SKIP_SECTION_RE.search(f"{item.section} {title}"):
        return "not_recruitment"
    if P.is_not_open_call(title) or P.is_not_job(title) or P.ACADEMIC_RE.search(title):
        return "not_open"
    if not plone_er.is_health_call(f"{title} {item.figura}"):
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
        bare = re.sub(r"(?i)^(indizione|avviso|selezione pubblica)[,]?\s*", "", title)
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

    key_entes = entes or [src.owner]
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
