"""Ca' Zampa (cliniche e ospedali veterinari, Nord/Centro Italia): "Lavora con noi".

La pagina https://www.cazampa.it/lavora-con-noi/ pagina l'elenco via AJAX; la via piu' pulita e' la sitemap Yoast dei
posti di lavoro (``lavoro-sitemap.xml``, ~35 URL ``/lavoro/<slug>/``). Ogni scheda ha h1 "Ruolo | Struttura", la regione
nella classe del template (``regione-lavoro-<slug>``) e il testo (descrizione, posizione, requisiti) nel template Elementor;
non ha JSON-LD ne' data di pubblicazione. robots.txt (Yoast): solo cookie/privacy/wp-admin; la sitemap e /lavoro/ sono
permessi. Solo ruoli clinici (medico veterinario, tecnico veterinario, borsisti/tirocinanti clinici); receptionist,
toelettatori, amministrativi restano fuori. Tutto "Veterinaria". >= 2 s tra le richieste.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text, slugify

from . import _it_priv as P

SITEMAP = "https://www.cazampa.it/lavoro-sitemap.xml"
COMPANY = "Ca' Zampa"
_CLINICAL = re.compile(r"veterinar|borsist|internship|tirocin|specializzand|anestesist|chirurg|ecografist|radiolog|diplomat", re.I)
_NOT_CLINICAL = re.compile(
    r"receptionist|toelettat|accounting|amministrativ|segreter|impiegat|contabil|\bhr\b|risorse umane|marketing|"
    r"customer|call center|addett[oa] (alla|al)|pulizi|manutenz|ausiliari|clinic manager|practice manager|"
    r"responsabile (di )?(sede|struttura|amministr)", re.I,
)
_CITY_RE = re.compile(r"\b(?:sede|situat[ao]|presso (?:la )?(?:clinica|struttura) (?:di|a)|a)\s+(?:a\s+)?([A-ZÀ-Ý][\wà-ù'’]+(?:\s[A-ZÀ-Ý][\wà-ù'’]+){0,2})[\s.,;]")
_TAIL = re.compile(r"\n\s*Notice: JavaScript is required.*", re.S)


def parse_sitemap(xml: str) -> list[str]:
    urls: list[str] = []
    for loc in re.findall(r"<loc>\s*([^<]+?)\s*</loc>", xml):
        if "/lavoro/" in loc and loc not in urls:
            urls.append(loc)
    return urls


def parse_detail(html: str, url: str, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    raw = re.sub(r"\s+", " ", h1.get_text(" ")).strip() if h1 else ""
    if not raw:
        skip("no_data")
        return None
    role, _, structure = (part.strip() for part in raw.partition("|"))
    title = P.pretty_title(role)
    if P.is_talent_pool(title):
        skip("talent_pool")
        return None
    if _NOT_CLINICAL.search(role) or not _CLINICAL.search(role):
        skip("not_clinical")
        return None
    slug_region = re.search(r'class="[^"]*\bregione-lavoro-([a-z0-9-]+)', html)
    region_name = re.sub(r"-\d+$", "", slug_region.group(1)).replace("-", " ") if slug_region else None
    district = P.region_label(None, region_name) if region_name else "Italia"
    if district == "Italia":
        skip("no_region")
        return None
    box = h1.find_parent(class_="elementor-location-single") or h1.find_parent("main") or soup.body
    for tag in box.select("script, style, form, button"):
        tag.decompose()
    text = html_to_text(str(box))
    text = _TAIL.sub("", text)
    # Fuori il titolo ripetuto, la struttura e la riga "Candidati per questo ruolo".
    lines = [ln for ln in text.splitlines() if ln.strip() and ln.strip() != raw and ln.strip() != structure
             and not re.fullmatch(r"candidati per questo ruolo", ln.strip(), re.I)
             and not ln.strip().startswith("Home >")]
    text = P.clean_text("\n".join(lines))
    if len(text) < P.MIN_BODY:
        skip("thin")
        return None
    if structure:
        text = f"Struttura: {structure}\n\n{text}"
    city = None
    m = _CITY_RE.search(re.sub(r"^Struttura:[^\n]*\n+", "", text))
    if m and P.region_label(m.group(1), None) == district:
        city = m.group(1)
    head = text[:1200]
    # "full-time che part-time" = contratto non definito.
    contract = None if re.search(r"full.?time", head, re.I) and re.search(r"part.?time", head, re.I) else guess_contract(head)
    if contract in ("Contratto", "Turni"):  # "turni notturni" nel testo non e' un tipo di contratto
        contract = None
    ident = slugify(url.rstrip("/").rsplit("/", 1)[-1])[:90]
    return JobPayload(
        title=f"{title} - {structure}" if structure else title,  # la struttura distingue annunci con lo stesso ruolo
        company=COMPANY,
        location_district=district,
        location_concelho=city,
        profession="Veterinaria",
        specialty=None,
        sector=P.SECTOR,
        contract_type=contract,
        description=text[: P.MAX_DESCRIPTION],
        requirements=None,
        salary=None,
        application_url=url,
        source=CazampaScraper.slug,
        source_id=f"cazampa-{ident}",
        published_at=None,
    )


class CazampaScraper(BaseScraper):
    slug = "cazampa"
    name = "Ca' Zampa - Lavora con noi"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=2.0)
        jobs: list[JobPayload] = []
        errors = 0
        urls: list[str] = []
        try:
            urls = parse_sitemap(client.get_text(SITEMAP))
            self.stats["sitemap"] = len(urls)
            for url in urls:
                try:
                    html = client.get_text(url)
                except Exception:  # noqa: BLE001
                    errors += 1
                    continue
                job = parse_detail(html, url, self.stats)
                if job and all(job.source_id != j.source_id for j in jobs):
                    jobs.append(job)
        finally:
            client.close()
        self.last_listings_complete = bool(urls) and errors <= max(2, len(urls) // 10)
        self.stats["errors"] = errors
        self.stats["published"] = len(jobs)
        return jobs
