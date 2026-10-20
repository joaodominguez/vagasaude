from __future__ import annotations

import re
from datetime import date

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_profession, html_to_text, norm
from sources._pt_boards import (
    HEALTH_RE,
    decode_cfemails,
    find_pt_place,
    guess_employer,
    guess_sector,
    is_abroad,
    is_recent,
    iso_day,
    parse_pt_date,
    smart_title,
    stable_id,
    text_fragment_url,
    today_utc,
)

PAGE = "https://www.ess.ipp.pt/comunidade/empregabilidade/ofertas-de-emprego"
BOARD = "ESS P.Porto — Ofertas de emprego"
MAX_AGE_DAYS = 60

# Cabeçalho de área (curso da ESS) → função a usar no título.
AREA_ROLES = [
    ("terapia ocupacional", "Terapeuta Ocupacional"),
    ("terapia da fala", "Terapeuta da Fala"),
    ("fisioterapia", "Fisioterapeuta"),
    ("farmacia", "Técnico(a) de Farmácia"),
    ("osteopatia", "Osteopata"),
    ("ortoptica", "Ortoptista"),
    ("ciencias da visao", "Ortoptista"),
    ("cardiopneumologia", "Fisiologista Clínico(a) / Cardiopneumologista"),
    ("fisiologia clinica", "Fisiologista Clínico(a) / Cardiopneumologista"),
    ("medicina nuclear", "Técnico(a) de Medicina Nuclear"),
    ("radioterapia", "Técnico(a) de Radioterapia"),
    ("imagem medica", "Técnico(a) de Radiologia"),
    ("radiologia", "Técnico(a) de Radiologia"),
    ("analises clinicas", "Técnico(a) de Análises Clínicas"),
    ("ciencias biomedicas", "Técnico(a) de Ciências Biomédicas Laboratoriais"),
    ("anatomia patologica", "Técnico(a) de Anatomia Patológica"),
    ("audiologia", "Audiologista"),
    ("neurofisiologia", "Neurofisiologista"),
    ("dietetica", "Nutricionista / Dietista"),
    ("nutricao", "Nutricionista / Dietista"),
    ("saude ambiental", "Técnico(a) de Saúde Ambiental"),
    ("gerontologia", "Gerontólogo(a)"),
    ("enfermagem", "Enfermeiro(a)"),
    ("higiene oral", "Higienista Oral"),
    ("protese", "Técnico(a) de Prótese Dentária"),
    ("podologia", "Podologista"),
]

# Primeira linha que já é um título ("Técnico de Farmácia (m/f) – Póvoa de Lanhoso").
_TITLE_LINE_RE = re.compile(
    r"^(?:t[ée]cnic[oa]|terapeuta|fisioterapeuta|osteopata|ortoptista|enfermeir|"
    r"nutricionista|dietista|audiolog|cardiopneumolog|fisiologista|farmac[êe]utic|"
    r"higienista|radiologista)",
    re.I,
)
_PUBLISHED_RE = re.compile(r"\(?\s*publicad[oa]\s+a\s+([^)<]{6,30})\)?", re.I)


class EssPortoScraper(BaseScraper):
    slug = "ess_porto"
    name = BOARD

    def fetch(self) -> list[JobPayload]:
        # Site lento (6–25 s por pedido).
        client = HttpClient(timeout=60.0, min_interval=1.0)
        try:
            html = client.get_text(PAGE)
        finally:
            client.close()
        return [_to_payload(item, self.slug) for item in parse_ess_porto(html)]


def parse_ess_porto(
    html: str, today: date | None = None, max_age_days: int = MAX_AGE_DAYS
) -> list[dict]:
    """Página de ofertas → ofertas recentes, em Portugal, da área da saúde."""
    today = today or today_utc()
    soup = BeautifulSoup(decode_cfemails(html), "lxml")
    core = (
        soup.select_one("[id^=parent-fieldname-text]")
        or soup.select_one("#content-core")
        or soup.body
        or soup
    )
    items: list[dict] = []
    seen: set[str] = set()
    for area, body_html in _blocks(core.decode_contents()):
        m = _PUBLISHED_RE.search(html_to_text(body_html))
        published = parse_pt_date(m.group(1)) if m else None
        if not is_recent(published, today, max_age_days):
            continue
        # Texto sem a linha "(publicado a …)".
        body_wo_date = re.sub(
            r"(?is)<p[^>]*>\s*(?:<[^>]+>\s*)*\(\s*publicad[oa]\s+a[^)]*\)(?:\s*</[^>]+>)*",
            "",
            body_html,
            count=1,
        )
        text = html_to_text(body_wo_date)
        if not text:
            continue
        if not HEALTH_RE.search(f"{area} {text[:800]}"):
            continue
        paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
        first = paragraphs[0] if paragraphs else ""
        role = _role_for_area(area)
        place = find_pt_place(first, text)
        if is_abroad(first, text):
            continue
        district, concelho = place if place else ("Portugal", None)
        title = _title(first, role, concelho)
        employer = guess_employer("", paragraphs)
        source_id = stable_id(published.isoformat(), text[:300], prefix="ess-")
        if source_id in seen:
            continue
        seen.add(source_id)
        description = "\n\n".join(
            part
            for part in (
                f"Área: {smart_title(area.upper()) if area else ''}".strip(": "),
                f"Publicado a {published.strftime('%d/%m/%Y')}",
                text,
            )
            if part and part != "Área"
        )
        items.append(
            {
                "title": title,
                "company": employer or BOARD,
                "district": district,
                "concelho": concelho,
                "description": description,
                "published_at": iso_day(published),
                "application_url": text_fragment_url(PAGE, _fragment_text(body_wo_date)),
                "source_id": source_id,
                "area": area,
            }
        )
    return items


def _blocks(content_html: str) -> list[tuple[str, str]]:
    """Divide o conteúdo pelos <h2> de área; cabeçalhos vazios colam ao bloco anterior."""
    parts = re.split(r"(?is)<h2[^>]*>(.*?)</h2>", content_html)
    blocks: list[list[str]] = []
    # parts = [antes, área1, corpo1, área2, corpo2, …]
    for i in range(1, len(parts) - 1, 2):
        area = re.sub(r"\s+", " ", html_to_text(parts[i])).strip()
        body = parts[i + 1]
        if not area and not re.search(r"publicad[oa]\s+a", body, re.I):
            if blocks:
                blocks[-1][1] += body
            continue
        # Vários "(publicado a …)" debaixo do mesmo cabeçalho → uma oferta cada.
        chunks = re.split(
            r"(?i)(?=<p[^>]*>\s*(?:<[^>]+>\s*)*\(\s*publicad[oa]\s+a)", body
        )
        chunks = [c for c in chunks if re.search(r"publicad[oa]\s+a", c, re.I)]
        if not chunks:
            if blocks:
                blocks[-1][1] += body
            continue
        for chunk in chunks:
            blocks.append([area, chunk])
    return [(a, b) for a, b in blocks]


def _role_for_area(area: str) -> str:
    key = norm(area)
    roles: list[str] = []
    for needle, role in AREA_ROLES:
        if needle in key and role not in roles:
            roles.append(role)
    if roles:
        return " / ".join(roles)
    return smart_title(area.upper()) if area else "Profissional de Saúde"


def _title(first_line: str, role: str, concelho: str | None) -> str:
    line = re.sub(r"\s+", " ", first_line).strip(" -–:=")
    line = re.sub(r"\s*=+\s*$", "", line)
    if line and len(line) <= 110 and _TITLE_LINE_RE.match(line):
        return smart_title(line)
    return f"{role} — {concelho}" if concelho else role


def _fragment_text(body_html: str) -> str:
    """Primeiras palavras da oferta tal como aparecem no browser (sem espaços extra)."""
    soup = BeautifulSoup(body_html, "lxml")
    for el in soup.find_all(["p", "li", "div"]):
        txt = re.sub(r"\s+", " ", el.get_text("", strip=False)).strip()
        if len(txt) > 15:
            return txt
    return ""


def _to_payload(item: dict, slug: str) -> JobPayload:
    title = item["title"]
    return JobPayload(
        title=title,
        company=item["company"],
        location_district=item["district"],
        location_concelho=item["concelho"],
        profession=guess_profession(title, fallback=item.get("area") or None),
        specialty=None,
        sector=guess_sector(f"{item['company']} {item['description'][:800]}"),
        contract_type=guess_contract(item["description"][:1200]),
        description=item["description"],
        requirements=None,
        salary=None,
        application_url=item["application_url"],
        source=slug,
        source_id=item["source_id"],
        published_at=item["published_at"],
    )
