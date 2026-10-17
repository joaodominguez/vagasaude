from __future__ import annotations

import re
from datetime import datetime
from html import unescape
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_district, guess_profession, html_to_text, strip_accents

BASE = "https://recrutamento.scml.pt"
LIST_URLS = [
    f"{BASE}/go/Todas-as-oportunidades/8801502/",
    f"{BASE}/search/?q=&sortColumn=referencedate&sortDirection=desc",
]

HEALTH_RE = re.compile(
    r"enferm|auxiliar de a[cç][aã]o m[eé]dica|auxiliar de geriatr|"
    r"m[eé]dic|fisioterap|terapeuta|sa[uú]de|cuidador|"
    r"psicolog|nutric|farmac|radiolog|formador|delegad|"
    r"coordenador|qualidade|rececion",
    re.I,
)
SKIP_RE = re.compile(
    r"educadora de inf[aâ]ncia|a[cç][aã]o educativa|inform[aá]tic|"
    r"jur[ií]dic|motorista|cozinh",
    re.I,
)

# Títulos SuccessFactors trazem ruído tipo "Terapeuta da Fala-NQ6-NQ8 1".
_TITLE_NOISE_RE = re.compile(
    r"(?i)\s*[-–—]?\s*NQ\d+(?:\s*[-–—/]\s*NQ\d+)?(?:\s+\d+)?\s*$"
)

_LABEL_ALIASES = {
    "referencia do anuncio": "referencia",
    "data-limite de candidatura": "data_limite",
    "data limite de candidatura": "data_limite",
    "local de trabalho": "local",
    "concelho": "concelho",
    "tipo de vaga": "tipo_vaga",
    "carga horaria semanal": "carga",
    "carga horária semanal": "carga",
}

_SECTION_ALIASES = {
    "descricao funcional": "descricao",
    "descrição funcional": "descricao",
    "requisitos obrigatorios": "requisitos",
    "requisitos obrigatórios": "requisitos",
    "competencias obrigatorias": "competencias",
    "competências obrigatórias": "competencias",
    "o que oferecemos": "oferecemos",
    "condicoes remuneratorias": "remuneracao",
    "condições remuneratórias": "remuneracao",
}


class ScmlScraper(BaseScraper):
    slug = "scml"
    name = "Santa Casa Misericórdia Lisboa"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.4)
        try:
            paths = self._list_paths(client)
            jobs: list[JobPayload] = []
            for path in paths:
                job = self._detail(client, path)
                if job:
                    jobs.append(job)
            return jobs
        finally:
            client.close()

    def _list_paths(self, client: HttpClient) -> list[str]:
        seen: dict[str, str] = {}
        for url in LIST_URLS:
            html = client.get_text(url)
            for path in re.findall(r'href="(/job/[^"]+)"', html):
                path = unescape(path)
                if path not in seen:
                    seen[path] = path
        return list(seen)

    def _detail(self, client: HttpClient, path: str) -> JobPayload | None:
        url = urljoin(BASE, path)
        html = client.get_text(url)
        return parse_scml_detail(html, url=url, path=path)


def parse_scml_detail(
    html: str,
    *,
    url: str,
    path: str = "",
) -> JobPayload | None:
    """Extrai JobPayload do HTML estático SuccessFactors da SCML."""
    parsed = _parse_body(html)
    title = _clean_title(
        parsed.get("title")
        or _meta(html, "og:title")
        or _h1(html)
        or path
    )
    if not title:
        return None
    if SKIP_RE.search(title) and not HEALTH_RE.search(title):
        return None
    if not HEALTH_RE.search(title):
        return None

    labels = parsed.get("labels") or {}
    sections = parsed.get("sections") or {}

    description = _compose_description(sections, labels)
    if not description:
        description = (
            html_to_text(parsed.get("raw_html") or "")
            or _meta(html, "og:description")
            or title
        )

    requirements = _compose_requirements(sections)
    salary_raw = _clean_text(sections.get("remuneracao") or "")
    salary = salary_raw.lstrip("-•* ").strip() or None
    contract = _compose_contract(labels)
    concelho = _clean_text(labels.get("concelho") or "") or None
    local = _clean_text(labels.get("local") or "")
    district = guess_district(concelho or local or "Lisboa", local or "Lisboa")
    if district == "Portugal":
        district = "Lisboa"
    expires_at = _parse_pt_deadline(labels.get("data_limite") or "")

    source_id = (path or url).rstrip("/").rsplit("/", 1)[-1]

    return JobPayload(
        title=title,
        company="Santa Casa da Misericórdia de Lisboa",
        location_district=district,
        location_concelho=concelho,
        profession=guess_profession(title, description[:240]),
        specialty=None,
        sector="ipss",
        contract_type=contract,
        description=description,
        requirements=requirements,
        salary=salary,
        application_url=url,
        source="scml",
        source_id=source_id,
        published_at=None,
        expires_at=expires_at,
    )


def _parse_body(html: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    node = soup.select_one("span.jobdescription") or soup.select_one(
        "[class*='jobdescription']"
    )
    if not node:
        return {"title": "", "labels": {}, "sections": {}, "raw_html": ""}

    labels: dict[str, str] = {}
    for p in node.find_all("p"):
        bold = p.find("b")
        if not bold:
            continue
        label_raw = _clean_text(bold.get_text(" ", strip=True)).rstrip(":")
        key = _alias_key(label_raw, _LABEL_ALIASES)
        if not key:
            # Título limpo costuma ser o primeiro <b> sem ":" (ex. "Terapeuta da Fala").
            continue
        value = _text_after_label(p, bold)
        if value:
            labels[key] = value

    sections: dict[str, str] = {}
    for heading in node.find_all(["h2", "h3"]):
        label_raw = _clean_text(heading.get_text(" ", strip=True)).rstrip(":")
        key = _alias_key(label_raw, _SECTION_ALIASES)
        if not key:
            continue
        body = _section_body(heading)
        if body:
            sections[key] = body

    title = ""
    first_b = node.find("b")
    if first_b:
        candidate = _clean_text(first_b.get_text(" ", strip=True))
        if candidate and ":" not in candidate:
            title = candidate

    # Documentos de candidatura (texto solto no rodapé do anúncio).
    docs = _extract_documents(node)
    if docs:
        sections["documentos"] = docs

    return {
        "title": title,
        "labels": labels,
        "sections": sections,
        "raw_html": str(node),
    }


def _text_after_label(container: Tag, bold: Tag) -> str:
    chunks: list[str] = []
    for sibling in bold.next_siblings:
        if isinstance(sibling, str):
            text = sibling.strip()
        elif isinstance(sibling, Tag):
            text = sibling.get_text(" ", strip=True)
        else:
            continue
        text = _clean_text(text)
        if text:
            chunks.append(text)
    if chunks:
        return _clean_text(" ".join(chunks))
    full = _clean_text(container.get_text(" ", strip=True))
    label = _clean_text(bold.get_text(" ", strip=True))
    if full.lower().startswith(label.lower()):
        return _clean_text(full[len(label) :].lstrip(" :"))
    return full


def _section_body(heading: Tag) -> str:
    """Lê o conteúdo da secção após o h2 (irmão seguinte ou contentor pai)."""
    # O h2 está tipicamente dentro de um wrapper; o corpo é o próximo irmão
    # do wrapper, ou o próximo irmão do próprio h2.
    for anchor in (heading.parent, heading):
        if not isinstance(anchor, Tag):
            continue
        for sibling in anchor.next_siblings:
            if isinstance(sibling, str):
                text = _clean_text(sibling)
                if text:
                    return text
                continue
            if not isinstance(sibling, Tag):
                continue
            if sibling.name in {"h2", "h3"}:
                break
            if sibling.find(["h2", "h3"]):
                # Outro bloco de secção — parar.
                if sibling.find(["h2", "h3"]) is sibling.find(recursive=True):
                    inner_h = sibling.find(["h2", "h3"])
                    if inner_h and inner_h is not heading:
                        break
            text = _list_or_text(sibling)
            if text:
                return text
    # Fallback: contentor do bloco completo (heading + lista).
    block = heading.find_parent("div")
    if block and block.parent:
        block = block.parent
    if isinstance(block, Tag):
        clone_parts: list[str] = []
        for child in block.children:
            if isinstance(child, Tag) and child.find(["h2", "h3"]) is heading:
                continue
            if isinstance(child, Tag) and child.name in {"h2", "h3"}:
                continue
            piece = _list_or_text(child) if isinstance(child, Tag) else _clean_text(str(child))
            if piece:
                clone_parts.append(piece)
        if clone_parts:
            return "\n".join(clone_parts)
    return ""


def _list_or_text(node: Tag | str) -> str:
    if isinstance(node, str):
        return _clean_text(node)
    items = [_clean_text(li.get_text(" ", strip=True)) for li in node.find_all("li")]
    items = [item for item in items if item]
    if items:
        return "\n".join(f"- {item}" for item in items)
    return _clean_text(node.get_text("\n", strip=True))


def _extract_documents(node: Tag) -> str:
    text = node.get_text("\n", strip=True)
    match = re.search(
        r"candidaturas devem ser acompanhadas[^\n]*:?\s*(.*?)(?:O teu talento|SANTA CASA|$)",
        text,
        re.I | re.S,
    )
    if not match:
        return ""
    lines: list[str] = []
    for raw in match.group(1).splitlines():
        line = _clean_text(raw).strip(" ;.")
        if not line:
            continue
        if line.lower().startswith("as candidaturas"):
            continue
        if not line.startswith("-"):
            line = f"- {line}"
        lines.append(line)
    return "\n".join(lines)


def _compose_description(sections: dict[str, str], labels: dict[str, str]) -> str:
    blocks: list[str] = []
    func = sections.get("descricao") or ""
    if func:
        blocks.append(func if func.lstrip().startswith("-") else func)

    meta_lines: list[str] = []
    local = _clean_text(labels.get("local") or "")
    if local:
        meta_lines.append(f"- Local de trabalho: {local}")
    concelho = _clean_text(labels.get("concelho") or "")
    if concelho:
        meta_lines.append(f"- Concelho: {concelho}")
    ref = _clean_text(labels.get("referencia") or "")
    if ref:
        meta_lines.append(f"- Referência: {ref}")
    if meta_lines:
        blocks.append("Detalhes do anúncio:\n" + "\n".join(meta_lines))

    oferecemos = sections.get("oferecemos") or ""
    if oferecemos:
        blocks.append("O que oferecemos:\n" + oferecemos)

    docs = sections.get("documentos") or ""
    if docs:
        blocks.append("Documentos de candidatura:\n" + docs)

    return "\n\n".join(block for block in blocks if block).strip()


def _compose_requirements(sections: dict[str, str]) -> str | None:
    lines: list[str] = []
    for key, prefix in (
        ("requisitos", None),
        ("competencias", "Competência"),
    ):
        raw = sections.get(key) or ""
        if not raw:
            continue
        for line in raw.splitlines():
            item = _clean_text(line).lstrip("-•* ").strip()
            if not item:
                continue
            if prefix and not item.lower().startswith("compet"):
                item = f"{prefix}: {item}"
            lines.append(f"- {item}")
    return "\n".join(lines) if lines else None


def _compose_contract(labels: dict[str, str]) -> str | None:
    parts: list[str] = []
    tipo = _clean_text(labels.get("tipo_vaga") or "")
    carga = _clean_text(labels.get("carga") or "")
    if tipo:
        parts.append(tipo)
    if carga:
        parts.append(carga)
    if not parts:
        return None
    return " · ".join(parts)


def _clean_title(title: str) -> str:
    text = _clean_text(title)
    text = _TITLE_NOISE_RE.sub("", text).strip(" -–—")
    return text or _clean_text(title)


def _parse_pt_deadline(value: str) -> str | None:
    match = re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b", value or "")
    if not match:
        return None
    day, month, year = (int(match.group(1)), int(match.group(2)), int(match.group(3)))
    try:
        return datetime(year, month, day).strftime("%Y-%m-%dT00:00:00+00:00")
    except ValueError:
        return None


def _alias_key(label: str, aliases: dict[str, str]) -> str | None:
    key = _norm_key(label)
    if key in aliases:
        return aliases[key]
    # Também aceitar chaves já normalizadas sem acentos.
    for raw, dest in aliases.items():
        if _norm_key(raw) == key:
            return dest
    return None


def _norm_key(text: str) -> str:
    folded = strip_accents(text or "").lower()
    return re.sub(r"[^a-z0-9]+", "", folded)


def _clean_text(value: str) -> str:
    text = unescape(value or "")
    text = text.replace("\xa0", " ").replace("\u200b", "")
    return re.sub(r"[ \t]+", " ", text).strip()


def _meta(html: str, prop: str) -> str:
    match = re.search(
        rf'property="{re.escape(prop)}"[^>]*content="([^"]*)"',
        html,
        re.I,
    )
    return unescape(match.group(1)).strip() if match else ""


def _h1(html: str) -> str:
    match = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
    if not match:
        return ""
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", match.group(1)))).strip()
