from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from html import unescape

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_profession,
    html_to_text,
    looks_like_hospital_employer_job,
    norm,
    state_from_uf,
)

BASE = "https://vagas.hsl.org.br"
# SAP SuccessFactors (career site "Unify"): a pesquisa é um widget React que
# chama /services/recruiting/… (robots: Disallow /services/), por isso o HTML
# de /search/ deixou de ter links /job/ e o scraper antigo devolvia 0.
# O feed Google Base RSS do career site (servido em /sitemap_index.xml, não
# bloqueado no robots) traz TODAS as vagas num só pedido: título, descrição
# HTML completa, link, id e data de expiração.
FEED_URL = f"{BASE}/sitemap_index.xml"
G_NS = "{http://base.google.com/ns/1.0}"
# Página /job/… de vaga fechada (feed ainda a lista).
UNAVAILABLE_MARKER = "não está disponível no momento"

# (padrão normalizado, cidade, UF) — unidades HSL: SP (Bela Vista, Itaim…),
# Brasília, e APS/saúde populacional no Rio e em Salvador.
CITY_HINTS: list[tuple[str, str, str]] = [
    ("brasilia", "Brasília", "DF"),
    ("rio de janeiro", "Rio de Janeiro", "RJ"),
    ("salvador", "Salvador", "BA"),
    ("sao paulo", "São Paulo", "SP"),
    ("bela vista", "São Paulo", "SP"),
]
UF_DEFAULT_CITY = {
    "SP": "São Paulo",
    "DF": "Brasília",
    "RJ": "Rio de Janeiro",
    "BA": "Salvador",
}
UF_TOKEN_RE = re.compile(r"(?:^|[\s/\-])(SP|DF|RJ|BA)(?:\s*\d*)?(?=$|[\s)/\-|])")
_CITY_ALT = r"S[ãa]o\s+P[aà]ulo|Bras[ií]lia|Rio\s+de\s+Janeiro|Salvador|Bela\s+Vista"
# " - Brasília/ DF", " / Brasília-DF", " - São Paulo - SP", " - São Paulo/SP 1",
# " - São Paulo - SP (Vaga Afirmativa)", " - Unidade Bela Vista" — no fim do
# título ou antes de um parêntese final.
LOC_SEGMENT_RE = re.compile(
    rf"\s*[-–/|]\s*(?:Unidade\s+)?(?:{_CITY_ALT})\s*(?:[-/]?\s*(?:SP|DF|RJ|BA)\b)?\s*\d*\s*(?=$|\()",
    re.I,
)


class HslSirioScraper(BaseScraper):
    """Hospital Sírio-Libanês (privado) — SAP SuccessFactors (vagas.hsl.org.br).

    1) Feed RSS Google Base do career site (1 pedido, ~170 itens com descrição
       completa). O feed é regenerado ~semanalmente (lastmod igual para todos)
       e arrasta vagas já fechadas.
    2) Por isso cada item que passa o filtro é confirmado na página /job/…
       (não bloqueada no robots): "não está disponível no momento" → descartado.
       Erro de rede no detalhe → mantém o item (não expirar por falha nossa).

    O braço OSS/SUS do ecossistema Sírio já é coberto por `irssl` (Gupy).
    """

    slug = "hsl_sirio"
    name = "Hospital Sírio-Libanês"
    company = "Hospital Sírio-Libanês"
    sector = "privado"
    verify_details: bool = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(
            headers={
                "Accept": "application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer": "https://hospitalsiriolibanes.org.br/trabalhe-conosco",
            }
        )
        try:
            items = parse_feed(client.get_bytes(FEED_URL))
            candidates = [job for job in (self._to_payload(it) for it in items) if job]
            if not self.verify_details:
                print(f"[{self.slug}] feed: {len(candidates)}/{len(items)} vagas após filtro")
                return candidates
            jobs: list[JobPayload] = []
            closed = errors = 0
            for job in candidates:
                try:
                    html = client.get_text(job.application_url)
                except Exception as exc:  # noqa: BLE001
                    print(f"[{self.slug}] detalhe {job.source_id}: {exc} (mantido)")
                    errors += 1
                    jobs.append(job)
                    continue
                if UNAVAILABLE_MARKER in html:
                    closed += 1
                    continue
                jobs.append(job)
        finally:
            client.close()
        print(
            f"[{self.slug}] feed: {len(items)} itens, {len(candidates)} após filtro, "
            f"{closed} fechadas no site, {errors} erros de detalhe → {len(jobs)} vagas"
        )
        if candidates and not jobs:
            raise RuntimeError(
                f"HSL: todas as {len(candidates)} vagas do feed estão indisponíveis "
                "no site — feed obsoleto ou página de detalhe mudou"
            )
        return jobs

    def _to_payload(self, item: dict[str, str]) -> JobPayload | None:
        raw_title = item["title"]
        title = clean_title(raw_title)
        if not title or not looks_like_hospital_employer_job(title):
            return None
        description = html_to_text(item.get("description"))
        if len(description) < 40:
            # Itens sem descrição no feed = requisições já fechadas (verificado
            # Out 2026: todas "não está disponível" no site).
            return None
        city, uf = guess_location(raw_title)
        return JobPayload(
            title=title,
            company=self.company,
            location_district=state_from_uf(uf),
            location_concelho=city,
            profession=guess_profession(title),
            specialty=None,
            sector=self.sector,
            contract_type=guess_contract(f"{raw_title} {description[:300]}"),
            description=description,
            requirements=None,
            salary=None,
            application_url=item["link"],
            source=self.slug,
            source_id=item["id"],
            published_at=None,
            expires_at=item.get("expires") or None,
        )


def parse_feed(xml: bytes | str) -> list[dict[str, str]]:
    """RSS Google Base do SuccessFactors → [{id,title,link,description,expires}].

    Levanta RuntimeError se a estrutura esperada não existir (página de
    erro/desafio, feed movido, 0 <item>) — nunca devolve [] em silêncio.
    """
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as exc:
        head = (xml[:120] if isinstance(xml, str) else xml[:120].decode("utf-8", "replace"))
        raise RuntimeError(f"HSL feed não é XML válido ({exc}): {head!r}") from exc
    channel = root.find("channel")
    if root.tag != "rss" or channel is None:
        raise RuntimeError(f"HSL feed: esperado <rss><channel>, obtido <{root.tag}>")
    items: list[dict[str, str]] = []
    seen: set[str] = set()
    for node in channel.findall("item"):
        link = (node.findtext("link") or "").strip()
        title = re.sub(r"\s+", " ", node.findtext("title") or "").strip()
        job_id = (node.findtext(f"{G_NS}id") or node.findtext("guid") or "").strip()
        if not job_id:
            m = re.search(r"/(\d+)/?$", link)
            job_id = m.group(1) if m else ""
        if not (link and title and job_id) or job_id in seen:
            continue
        seen.add(job_id)
        # A descrição vem HTML-escapada dentro do CDATA (&lt;p&gt;…).
        desc = unescape(node.findtext("description") or "")
        items.append(
            {
                "id": job_id,
                "title": title,
                "link": link,
                "description": desc,
                "expires": (node.findtext(f"{G_NS}expiration_date") or "").strip(),
            }
        )
    if not items:
        raise RuntimeError("HSL feed: 0 <item> com link/título/id — feed vazio ou mudou")
    return items


def clean_title(title: str) -> str:
    """'Enfermeiro Clinico Oncologia - Brasília/ DF (BR)' → 'Enfermeiro Clinico Oncologia'."""
    t = re.sub(r"\s*\(BR\)\s*$", "", title or "").strip()
    stripped = t
    for _ in range(3):  # "Bela Vista / São Paulo - SP" → 2 segmentos
        nxt = re.sub(r"\s+", " ", LOC_SEGMENT_RE.sub(" ", stripped)).strip(" -–/|")
        if nxt == stripped:
            break
        stripped = nxt
    return re.sub(r"\s+", " ", stripped or t).strip()


def guess_location(title: str) -> tuple[str, str]:
    """Cidade/UF a partir do título do feed (g:location é só 'BR').

    Sem pista no título → sede (São Paulo/SP), onde está a maioria das vagas
    com títulos-código ('ENFERMEIRO PL', 'TEC. ENFERMAGEM PL').
    """
    t = re.sub(r"\s*\(BR\)\s*$", "", title or "")
    low = norm(t)
    best: tuple[int, str, str] | None = None
    for key, city, uf in CITY_HINTS:
        idx = low.find(norm(key))
        if idx >= 0 and (best is None or idx < best[0]):
            best = (idx, city, uf)
    if best:
        return best[1], best[2]
    m = UF_TOKEN_RE.search(t)
    if m:
        uf = m.group(1)
        return UF_DEFAULT_CITY[uf], uf
    return "São Paulo", "SP"
