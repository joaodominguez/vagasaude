"""Gruppo KOS (Anni Azzurri = RSA, Santo Stefano = riabilitazione, psichiatria): «Posizioni aperte».

https://kosgroup.com/it/lavorare-in-kos/posizioni-aperte — a lista completa (~78 cartões) vem no HTML do site institucional,
sem JavaScript: título, «Cidade - Região», tipo de contrato e ligação à ficha (https://lavoraconnoi.kosgroup.com/job/view-job.php?id=N).
robots.txt de kosgroup.com: só proíbe `?query=`/`?formId=` (não usados aqui). A ficha em lavoraconnoi.kosgroup.com é um
stub JavaScript (789 bytes, sem texto nem JSON-LD) e o seu robots proíbe áreas internas: NÃO se lê; só se usa o link para o
utilizador. Por isso as vagas não têm descrição da fonte (texto sintético, factual) nem prazo (TTL: lastSeen + 7 dias).
O separador (tab) do cartão dá a divisão: Rsa -> Anni Azzurri; Riabilitazione -> Santo Stefano; Psichiatria/Serviços hospitalares -> Gruppo KOS.
Só funções clínicas (OSS/ADB, enfermeiro, fisioterapeuta, médico, educador...); limpezas, cozinha e front office ficam fora.
"""
from __future__ import annotations

import re
from html import unescape

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract

from . import _it_priv as P
from ._it_regional import get_retry

LIST_URL = "https://kosgroup.com/it/lavorare-in-kos/posizioni-aperte"
JOB_URL = "https://lavoraconnoi.kosgroup.com/job/view-job.php?id={id}"
SLUG = "kos-group"

# (rótulo do separador em minúsculas) -> (empresa, descrição da divisão)
DIVISIONS = {
    "rsa": ("Anni Azzurri (Gruppo KOS)", "residenza sanitaria assistenziale (RSA) Anni Azzurri"),
    "riabilitazione": ("Santo Stefano (Gruppo KOS)", "struttura di riabilitazione Santo Stefano"),
    "psichiatria": ("Gruppo KOS", "struttura psichiatrica del Gruppo KOS"),
    "servizi ospedalieri": ("Gruppo KOS", "servizi ospedalieri del Gruppo KOS"),
}
_NOT_CLINICAL_RE = re.compile(r"pulizi|cuoc[oa]|cucina|front office|segreteria|amministrativ|magazzin|autista|manutent|portiner", re.I)
_CLINICAL_EXTRA = (
    (r"\badb\b|assistenza di base|addett[oa] (?:all[' ]?)?assistenza|\basa\b|\bosa\b", "OSS"),
    (r"educatore aba|educatore professionale|\beducator", "Servizio sociale"),
)


def _text(fragment: str) -> str:
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", fragment or ""))).strip()


def parse_list(html: str) -> list[dict]:
    """[{id, title, city, region_raw, contract, division}] — levanta erro se a lista desaparecer (estrutura mudou)."""
    if "single-posizione" not in html:
        raise RuntimeError("kos-group: cartões de posições não reconhecidos (estrutura mudou?)")
    declared = re.search(r"POSIZIONI APERTE \((\d+)\)", html)
    tabs = {}
    for m in re.finditer(r'id="pos-lav-cat-(\d+)-tab"[^>]*>\s*([^<(]+?)\s*\(\d+\)', html):
        tabs[m.group(1)] = _text(m.group(2)).lower()
    out: list[dict] = []
    panes = re.split(r'<div class="tab-pane[^"]*" id="pos-lav-cat-tab(\d+)"', html)
    # panes = [antes, idx1, corpo1, idx2, corpo2, ...]
    for idx, body in zip(panes[1::2], panes[2::2]):
        division = tabs.get(idx, "")
        for card in body.split('<div class="col single-posizione search-item">')[1:]:
            t = re.search(r"<span>([^<]+)</span>", card)
            jid = re.search(r"view-job\.php\?id=(\d+)", card)
            if not t or not jid:
                continue
            loc = re.search(r'map-point\.svg"[^>]*>\s*([^<]+)', card)
            con = re.search(r'timer\.svg"[^>]*>\s*([^<]+)', card)
            place = _text(loc.group(1)) if loc else ""
            city, _, region = place.partition(" - ")
            out.append({
                "id": jid.group(1), "title": _text(t.group(1)), "city": city.strip(), "region_raw": region.strip(),
                "contract": _text(con.group(1)) if con else "", "division": division, "new": "NUOVO" in card[:600],
            })
    if declared and len(out) < int(declared.group(1)) * 0.5:
        raise RuntimeError(f"kos-group: só {len(out)} cartões lidos de {declared.group(1)} anunciados (estrutura mudou?)")
    if not out:
        raise RuntimeError("kos-group: 0 cartões lidos (estrutura mudou?)")
    return out


def _profession(title: str) -> str | None:
    if _NOT_CLINICAL_RE.search(title):
        return None
    low = title.lower()
    for pattern, label in _CLINICAL_EXTRA:
        if re.search(pattern, low):
            return label
    return P.classify(title)


def _contract(text: str) -> str | None:
    low = text.lower()
    if "indeterminat" in low:
        return "Tempo indeterminato"
    if "determinat" in low:
        return "Tempo determinato"
    if "collaborazione" in low:
        return "Libero professionale"
    return guess_contract(text)


def to_job(card: dict, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}
    title = P.pretty_title(card["title"])
    profession = _profession(card["title"])
    if profession is None:
        stats["not_clinical"] = stats.get("not_clinical", 0) + 1
        return None
    company, division_text = DIVISIONS.get(card["division"], ("Gruppo KOS", "struttura del Gruppo KOS"))
    city = P.tidy_city(card["city"]) or None
    region = P.region_label(city, card["region_raw"]) if (city or card["region_raw"]) else "Italia"
    if region == "Italia":
        stats["no_region"] = stats.get("no_region", 0) + 1
        return None
    contract = _contract(card["contract"])
    full_title = f"{title} - {city}" if city and city.lower() not in title.lower() else title
    lines = [
        f"Posizione aperta: {title}, {division_text}" + (f", a {city} ({region})." if city else f" ({region})."),
        "",
        f"Ente: {company}",
        f"Sede: {city + ' - ' if city else ''}{region}",
        f"Profilo: {title}",
    ]
    if card["contract"]:
        lines.append(f"Tipo di contratto: {card['contract'].strip()}")
    lines += [
        "",
        "L'annuncio completo (requisiti, orario, candidatura online) è pubblicato dal Gruppo KOS sul suo portale carriere: "
        + JOB_URL.format(id=card["id"]),
        "Fonte: Gruppo KOS, Posizioni aperte (kosgroup.com).",
    ]
    return JobPayload(
        title=full_title,
        company=company,
        location_district=region,
        location_concelho=city,
        profession=profession,
        specialty=None,
        sector=P.SECTOR,
        contract_type=contract,
        description="\n".join(lines),
        requirements=None,
        salary=None,
        application_url=JOB_URL.format(id=card["id"]),
        source=SLUG,
        source_id=f"kos-{card['id']}",
        published_at=None,
    )


class KosGroupScraper(BaseScraper):
    slug = SLUG
    name = "Gruppo KOS - Posizioni aperte"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        try:
            cards = parse_list(get_retry(client, LIST_URL))
        finally:
            client.close()
        self.stats["listed"] = len(cards)
        jobs = [j for j in (to_job(c, self.stats) for c in cards) if j]
        # titulos iguais na mesma cidade (ex.: 3 «Operatore socio sanitario» em Roma): a app deduplica por titulo|empresa|regiao
        seen: dict[tuple, int] = {}
        for job in jobs:
            k = (job.title.lower(), job.company, job.location_district)
            seen[k] = seen.get(k, 0) + 1
            if seen[k] > 1:
                job.title = f"{job.title} ({job.source_id.rsplit('-', 1)[-1]})"
        self.stats["published"] = len(jobs)
        return jobs
