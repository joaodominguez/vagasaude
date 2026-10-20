"""Pandapé (InfoJobs ATS) — scraper multi-tenant.

Boards públicos `https://<tenant>.pandape.infojobs.com.br/`:

* Listagem: ``/?PageNumber=N`` (20 vagas/página, cartões com título, local
  "Cidade - UF", contrato, jornada, salário e data "20 out"). Parar quando a
  página vem vazia / ``hdn_isLast=True``.
* Detalhe: ``/Detail/{id}`` — HTML com ``#description`` / tags ``#detail`` e,
  em muitos tenants (não todos!), JSON-LD ``JobPosting`` (datePosted,
  validThrough, jobLocation, baseSalary).
* robots.txt só bloqueia ``/Apply/``.

Política de pedidos (gentil): ≥1 s entre pedidos, detalhes só para IDs novos
(cache em disco), teto ``PANDAPE_MAX_DETAILS`` por corrida de classe.

Vagas sem detalhe (IDs novos acima do teto, ou erro no detalhe) são emitidas
com os dados do cartão da listagem (título + local estão sempre presentes) —
assim um ID já ingerido nunca desaparece do lote por falta de orçamento e não
é soft-expirado. O detalhe chega nas corridas seguintes e substitui o texto.

Falha de um board: usa o último snapshot bom da listagem (≤ 48 h, guardado no
mesmo ficheiro de cache) para não expirar em massa as vagas desse board; sem
snapshot, o board é ignorado (padrão Gupy). Se nenhum board responder, a
corrida falha (nada é ingerido → nada expira).

Env:
* ``PANDAPE_DETAIL_CACHE`` — caminho do JSON (default
  ``scrapers-br/.cache/pandape_details.json``; ``off`` desliga). Se não for
  gravável, segue sem cache.
* ``PANDAPE_MAX_DETAILS`` — máx. detalhes por corrida (default 400).
* ``PANDAPE_MIN_INTERVAL`` — segundos entre pedidos (default 1.0, mínimo 1.0).
"""

from __future__ import annotations

import json
import os
import re
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_profession,
    html_to_text,
    looks_like_health_job,
    looks_like_hospital_employer_job,
    state_from_uf,
)

PAGE_SIZE = 20
MAX_PAGES = 300
CACHE_TTL_SECONDS = 30 * 24 * 3600
SNAPSHOT_MAX_AGE_SECONDS = 48 * 3600
DEFAULT_MAX_DETAILS = 400
BRT = timezone(timedelta(hours=-3))  # Brasília (sem horário de verão desde 2019)

DETAIL_HREF_RE = re.compile(r"/Detail/(\d+)", re.I)
JSONLD_RE = re.compile(
    r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', re.S | re.I
)
MONEY_RE = re.compile(r"R\$\s*([\d.]+(?:,\d{1,2})?)")
PT_MONTHS = {
    "jan": 1,
    "fev": 2,
    "mar": 3,
    "abr": 4,
    "mai": 5,
    "jun": 6,
    "jul": 7,
    "ago": 8,
    "set": 9,
    "out": 10,
    "nov": 11,
    "dez": 12,
}
SALARY_UNITS = {
    "HOUR": "hora",
    "DAY": "dia",
    "WEEK": "semana",
    "MONTH": "mês",
    "YEAR": "ano",
}
# Ícones dos cartões / tags → campo
ICON_FIELDS = {
    "icon-location-pin-1": "location",
    "icon-buildings": "work_mode",
    "icon-building-house": "work_mode",
    "icon-clock": "schedule",
    "icon-candidates": "positions",
    "icon-users-1": "positions",
    "icon-sheet": "contract",
    "icon-wallet": "salary",
    "icon-sign-disable": "pcd",
    "icon-suitcase": "level",
}


# ---------------------------------------------------------------------------
# Helpers de parsing (puros — testados com fixtures)
# ---------------------------------------------------------------------------


def _clean(text: str | None) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def split_location(text: str | None) -> tuple[str | None, str | None]:
    """'São Bernardo do Campo - SP' → ('São Bernardo do Campo', 'SP')."""
    loc = _clean(text)
    if not loc:
        return None, None
    m = re.match(r"^(.*?)\s*[-–]\s*([A-Za-z]{2})$", loc)
    if m:
        return (m.group(1).strip() or None), m.group(2).upper()
    if re.fullmatch(r"[A-Za-z]{2}", loc):
        return None, loc.upper()
    return loc, None


def format_brl(value: float) -> str:
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _parse_brl(raw: str) -> float | None:
    try:
        return float(raw.replace(".", "").replace(",", "."))
    except ValueError:
        return None


def format_salary_text(text: str | None) -> str | None:
    """'R$ 1.700,00  - R$ 1.900,00' / 'R$ 1.799,85 (Bruto Mensal)' → texto limpo."""
    raw = _clean(text)
    if not raw:
        return None
    values = [v for v in (_parse_brl(m) for m in MONEY_RE.findall(raw)) if v]
    if not values:
        return None
    if len(values) >= 2 and values[1] > values[0]:
        out = f"{format_brl(values[0])} – {format_brl(values[1])}"
    else:
        out = format_brl(values[0])
    low = raw.lower()
    if "mensal" in low or "/mês" in low or "por mês" in low:
        out += " / mês"
    elif "hora" in low:
        out += " / hora"
    elif "anual" in low:
        out += " / ano"
    return out


def format_base_salary(base: Any) -> str | None:
    """schema.org MonetaryAmount → 'R$ 1.700,00 – R$ 1.900,00 / mês'."""
    if not isinstance(base, dict):
        return None
    currency = (base.get("currency") or "BRL").upper()
    if currency != "BRL":
        return None
    value = base.get("value")
    unit = None
    lo = hi = None
    if isinstance(value, dict):
        unit = value.get("unitText")
        lo = value.get("minValue")
        hi = value.get("maxValue")
        if lo is None and hi is None:
            lo = value.get("value")
    elif isinstance(value, (int, float, str)):
        lo = value
    try:
        lo_f = float(lo) if lo not in (None, "") else 0.0
        hi_f = float(hi) if hi not in (None, "") else 0.0
    except (TypeError, ValueError):
        return None
    if lo_f <= 0 and hi_f <= 0:
        return None
    if lo_f > 0 and hi_f > lo_f:
        out = f"{format_brl(lo_f)} – {format_brl(hi_f)}"
    else:
        out = format_brl(hi_f or lo_f)
    label = SALARY_UNITS.get(str(unit or "").upper())
    if label:
        out += f" / {label}"
    return out


def normalize_pandape_datetime(raw: Any) -> str | None:
    """'2026-10-20T10:47:32.5851347' (hora de Brasília, sem TZ) → ISO-8601 com -03:00."""
    if not raw or not isinstance(raw, str):
        return None
    m = re.match(r"^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?))?", raw.strip())
    if not m:
        return None
    day, hm = m.group(1), m.group(2)
    tz_m = re.search(r"(Z|[+-]\d{2}:?\d{2})$", raw.strip())
    if not hm:
        return day
    if len(hm) == 5:
        hm += ":00"
    if tz_m:
        tz = tz_m.group(1)
        return f"{day}T{hm}{'+00:00' if tz == 'Z' else tz}"
    return f"{day}T{hm}-03:00"


def parse_listing_date(label: str | None, today: date | None = None) -> str | None:
    """'20 out' → '2026-10-20' (ano inferido: datas no futuro recuam um ano)."""
    m = re.match(r"^\s*(\d{1,2})\s+([a-zç]{3})", (label or "").lower())
    if not m:
        return None
    month = PT_MONTHS.get(m.group(2))
    if not month:
        return None
    today = today or datetime.now(BRT).date()
    try:
        d = date(today.year, month, int(m.group(1)))
    except ValueError:
        return None
    if d > today + timedelta(days=1):
        try:
            d = d.replace(year=today.year - 1)
        except ValueError:
            return None
    return d.isoformat()


def _icon_field(node: Any) -> str | None:
    icon = node.select_one("i.icon")
    if not icon:
        return None
    for cls in icon.get("class") or []:
        if cls in ICON_FIELDS:
            return ICON_FIELDS[cls]
    return None


def parse_listing_page(html: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Cartões de uma página de listagem → (itens, meta{total,is_last})."""
    soup = BeautifulSoup(html, "html.parser")
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    cards = soup.select("a.card-vacancy[href]") or soup.select("a[href*='/Detail/']")
    for card in cards:
        m = DETAIL_HREF_RE.search(card.get("href") or "")
        if not m:
            continue
        job_id = m.group(1)
        if job_id in seen:
            continue
        seen.add(job_id)
        title_el = card.select_one("h3, h2")
        title = ""
        if title_el:
            title = _clean(title_el.get("title") or title_el.get_text(" ", strip=True))
        item: dict[str, Any] = {"id": job_id, "title": title}
        for div in card.select(".vacancy-detail .d-flex > div"):
            field = _icon_field(div)
            if not field or field in item:
                continue
            item[field] = _clean(div.get_text(" ", strip=True)) or None
        date_el = card.select_one(".vacancy-date")
        item["date_label"] = _clean(date_el.get_text(" ", strip=True)) if date_el else None
        city, uf = split_location(item.get("location"))
        item["city"], item["uf"] = city, uf
        items.append(item)

    meta: dict[str, Any] = {"total": None, "is_last": None}
    sub = soup.select_one("#subTotal")
    if sub:
        digits = re.sub(r"\D", "", sub.get_text())
        meta["total"] = int(digits) if digits else None
    last = soup.select_one("#hdn_isLast")
    if last is not None:
        meta["is_last"] = (last.get("value") or "").strip().lower() == "true"
    return items, meta


def _jsonld_job(html: str) -> dict[str, Any] | None:
    for m in JSONLD_RE.finditer(html):
        try:
            data = json.loads(m.group(1))
        except ValueError:
            continue
        candidates = data if isinstance(data, list) else [data]
        for c in candidates:
            if isinstance(c, dict) and c.get("@type") == "JobPosting":
                return c
    return None


def parse_detail_page(html: str) -> dict[str, Any] | None:
    """Página /Detail/{id} → dict normalizado (None se não parece uma vaga)."""
    soup = BeautifulSoup(html, "html.parser")
    ld = _jsonld_job(html) or {}
    h1 = soup.find("h1")
    title = _clean(ld.get("title")) or (_clean(h1.get_text(" ", strip=True)) if h1 else "")
    if not title:
        return None

    tags: dict[str, str] = {}
    if "não está mais disponível" in title.lower():
        return None
    for tag in soup.select("#detail .custom-tag"):
        field = _icon_field(tag)
        text = _clean(tag.get_text(" ", strip=True))
        if field and text and field not in tags:
            tags[field] = text

    city = state_uf = None
    address = ((ld.get("jobLocation") or {}) if isinstance(ld.get("jobLocation"), dict) else {}).get(
        "address"
    ) or {}
    if isinstance(address, dict):
        city = _clean(address.get("addressLocality")) or None
        state_uf = _clean(address.get("addressRegion")) or None
    tag_city, tag_uf = split_location(tags.get("location"))
    city = city or tag_city
    state_uf = state_uf or tag_uf

    description = ""
    desc_node = soup.select_one("#description .order-1") or soup.select_one("#description")
    if desc_node:
        for chip in desc_node.select(".chip"):
            chip.decompose()
        description = html_to_text(str(desc_node))
    if len(description) < 40 and ld.get("description"):
        description = str(ld["description"]).strip()

    req_lines: list[str] = []
    req = soup.select_one("#Requirements")
    if req:
        for block in req.find_all("div", id=True, recursive=False) or req.select("div[id]"):
            head = block.find(["h4", "h5", "h6"])
            values = [
                _clean(t.get_text(" ", strip=True))
                for t in block.select(".js_tagText")
            ]
            values = [v for v in values if v]
            if not values:
                text = _clean(block.get_text(" ", strip=True))
                if head:
                    text = text.replace(_clean(head.get_text(" ", strip=True)), "", 1).strip()
                values = [text] if text else []
            if values:
                label = _clean(head.get_text(" ", strip=True)) if head else ""
                req_lines.append(f"{label}: {', '.join(values)}" if label else ", ".join(values))

    salary = format_base_salary(ld.get("baseSalary")) or format_salary_text(tags.get("salary"))

    return {
        "title": title,
        "description": description,
        "requirements": "\n".join(req_lines) or None,
        "city": city,
        "uf": state_uf,
        "salary": salary,
        "contract": tags.get("contract"),
        "schedule": tags.get("schedule"),
        "work_mode": tags.get("work_mode"),
        "employment_type": ld.get("employmentType"),
        "date_posted": normalize_pandape_datetime(ld.get("datePosted")),
        "valid_through": normalize_pandape_datetime(ld.get("validThrough")),
    }


def pandape_contract(contract_tag: str | None, title: str) -> str | None:
    guessed = guess_contract(f"{contract_tag or ''} {title}")
    if guessed:
        return guessed
    tag = _clean(contract_tag)
    if tag and tag.lower() not in {"outros", "outro"}:
        return tag
    return None


def listing_description(item: dict[str, Any]) -> str:
    """Texto mínimo a partir do cartão (até o detalhe ser obtido)."""
    lines = [item.get("title") or ""]
    facts = [
        ("Local", item.get("location")),
        ("Modalidade", item.get("work_mode")),
        ("Jornada", item.get("schedule")),
        ("Contrato", item.get("contract")),
        ("Vagas", item.get("positions")),
        ("Salário", format_salary_text(item.get("salary"))),
        ("Inclusão", item.get("pcd")),
    ]
    body = [f"{label}: {value}" for label, value in facts if value]
    if body:
        lines.append("")
        lines.extend(body)
    return "\n".join(lines).strip()


# ---------------------------------------------------------------------------
# Cache em disco
# ---------------------------------------------------------------------------


def _default_cache_path() -> Path | None:
    env = os.environ.get("PANDAPE_DETAIL_CACHE", "").strip()
    if env.lower() in {"off", "0", "false", "none"}:
        return None  # cache desligada (só memória)
    if env:
        return Path(env).expanduser()
    return Path(__file__).resolve().parent.parent / ".cache" / "pandape_details.json"


class PandapeCache:
    """JSON {details: {"tenant:id": {f, s, d}}, listings: {tenant: {at, items}}}.

    f = fetched_at (detalhe), s = last_seen (na listagem), d = detalhe parseado.
    Entradas não vistas há > TTL são removidas. Detalhes ainda listados mas
    com f > TTL são re-buscados só com orçamento sobrante (senão usa-se o
    antigo). Erros de I/O nunca rebentam o scraper.
    """

    def __init__(self, path: Path | None = None, ttl: int = CACHE_TTL_SECONDS):
        self.path = path if path is not None else _default_cache_path()
        self.ttl = ttl
        self.details: dict[str, dict[str, Any]] = {}
        self.listings: dict[str, dict[str, Any]] = {}
        self._dirty_details: set[str] = set()
        self._dirty_listings: set[str] = set()
        self._load()

    def _read_file(self) -> dict[str, Any]:
        if self.path is None:
            return {}
        try:
            with open(self.path, encoding="utf-8") as fh:
                data = json.load(fh)
            return data if isinstance(data, dict) else {}
        except FileNotFoundError:
            return {}
        except (OSError, ValueError) as exc:
            print(f"[pandape] cache ilegível ({self.path}): {exc}")
            return {}

    def _load(self) -> None:
        data = self._read_file()
        now = time.time()
        details = data.get("details") or {}
        if isinstance(details, dict):
            self.details = {
                k: v
                for k, v in details.items()
                if isinstance(v, dict) and now - float(v.get("s") or 0) <= self.ttl
            }
        listings = data.get("listings") or {}
        if isinstance(listings, dict):
            self.listings = {k: v for k, v in listings.items() if isinstance(v, dict)}

    def get(self, key: str) -> dict[str, Any] | None:
        entry = self.details.get(key)
        return entry.get("d") if entry else None

    def is_stale(self, key: str) -> bool:
        entry = self.details.get(key)
        return not entry or time.time() - float(entry.get("f") or 0) > self.ttl

    def touch(self, key: str) -> None:
        entry = self.details.get(key)
        if entry is not None:
            entry["s"] = time.time()
            self._dirty_details.add(key)

    def put(self, key: str, detail: dict[str, Any]) -> None:
        now = time.time()
        self.details[key] = {"f": now, "s": now, "d": detail}
        self._dirty_details.add(key)

    def snapshot(self, tenant: str, items: list[dict[str, Any]]) -> None:
        self.listings[tenant] = {"at": time.time(), "items": items}
        self._dirty_listings.add(tenant)

    def get_snapshot(self, tenant: str, max_age: int) -> list[dict[str, Any]] | None:
        snap = self.listings.get(tenant)
        if not snap or time.time() - float(snap.get("at") or 0) > max_age:
            return None
        items = snap.get("items")
        return items if isinstance(items, list) else None

    def save(self) -> None:
        if self.path is None or (not self._dirty_details and not self._dirty_listings):
            return
        try:
            # Merge com o que está em disco (outra classe Pandapé pode ter gravado).
            disk = self._read_file()
            now = time.time()
            details = {
                k: v
                for k, v in (disk.get("details") or {}).items()
                if isinstance(v, dict) and now - float(v.get("s") or 0) <= self.ttl
            }
            for key in self._dirty_details:
                if key in self.details:
                    details[key] = self.details[key]
            listings = {
                k: v for k, v in (disk.get("listings") or {}).items() if isinstance(v, dict)
            }
            for tenant in self._dirty_listings:
                listings[tenant] = self.listings[tenant]
            self.path.parent.mkdir(parents=True, exist_ok=True)
            ignore = self.path.parent / ".gitignore"
            if self.path.parent.name == ".cache" and not ignore.exists():
                ignore.write_text("*\n", encoding="utf-8")
            tmp = self.path.with_name(self.path.name + f".tmp{os.getpid()}")
            with open(tmp, "w", encoding="utf-8") as fh:
                json.dump(
                    {"version": 1, "details": details, "listings": listings},
                    fh,
                    ensure_ascii=False,
                    separators=(",", ":"),
                )
            os.replace(tmp, self.path)
            self._dirty_details.clear()
            self._dirty_listings.clear()
        except OSError as exc:
            print(f"[pandape] cache não gravável ({self.path}): {exc}")


# ---------------------------------------------------------------------------
# Scraper base
# ---------------------------------------------------------------------------


class PandapeBoardScraper(BaseScraper):
    """Base multi-board para Pandapé.

    Subclasses definem ``BOARDS = [(tenant, company, sector), ...]``.
    ``filter_mode``: health (= Gupy health) | hospital (= Gupy hospital) | all.
    ``source_id_style``: "tenant" → "<tenant>-<id>"; "bare" → "<id>" (legado HCor).
    """

    slug: str
    name: str
    BOARDS: list[tuple[str, str, str]] = []
    filter_mode: str = "hospital"
    source_id_style: str = "tenant"

    def __init__(self) -> None:
        self.stats: dict[str, dict[str, Any]] = {}

    # -- config ------------------------------------------------------------

    @staticmethod
    def base_url(tenant: str) -> str:
        return f"https://{tenant}.pandape.infojobs.com.br"

    def detail_url(self, tenant: str, job_id: str) -> str:
        return f"{self.base_url(tenant)}/Detail/{job_id}"

    def source_id(self, tenant: str, job_id: str) -> str:
        if self.source_id_style == "bare":
            return str(job_id)
        return f"{tenant}-{job_id}"

    @staticmethod
    def max_details() -> int:
        raw = os.environ.get("PANDAPE_MAX_DETAILS", "").strip()
        try:
            return max(0, int(raw)) if raw else DEFAULT_MAX_DETAILS
        except ValueError:
            return DEFAULT_MAX_DETAILS

    @staticmethod
    def min_interval() -> float:
        raw = os.environ.get("PANDAPE_MIN_INTERVAL", "").strip()
        try:
            return max(1.0, float(raw)) if raw else 1.0
        except ValueError:
            return 1.0

    def keep_title(self, title: str) -> bool:
        if self.filter_mode == "all":
            return bool(title)
        if self.filter_mode == "health":
            return looks_like_health_job(title)
        return looks_like_hospital_employer_job(title)

    # -- fetch -------------------------------------------------------------

    def fetch(self) -> list[JobPayload]:
        cache = PandapeCache()
        client = HttpClient(
            min_interval=self.min_interval(),
            headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        )
        try:
            # 1) Listagens (isolamento de falhas por board)
            boards: list[tuple[str, str, str, list[dict[str, Any]]]] = []
            fresh = 0
            for tenant, company, sector in self.BOARDS:
                st = self.stats.setdefault(tenant, {})
                try:
                    items, total = self._fetch_listing(client, tenant)
                    cache.snapshot(tenant, items)
                    st.update(listing=len(items), listing_total=total, snapshot=False)
                    fresh += 1
                except Exception as exc:  # noqa: BLE001
                    snap = cache.get_snapshot(tenant, SNAPSHOT_MAX_AGE_SECONDS)
                    if snap is None:
                        print(f"[{self.slug}] board {tenant}: {exc} (sem snapshot — ignorado)")
                        st.update(error=str(exc), listing=0)
                        continue
                    print(
                        f"[{self.slug}] board {tenant}: {exc} — a usar snapshot "
                        f"({len(snap)} vagas) para não expirar"
                    )
                    items = snap
                    st.update(error=str(exc), listing=len(items), snapshot=True)
                kept = [i for i in items if i.get("id") and self.keep_title(i.get("title") or "")]
                st["kept"] = len(kept)
                boards.append((tenant, company, sector, kept))
            if fresh == 0:
                raise RuntimeError(f"Pandapé {self.slug}: nenhum board respondeu")

            # 2) Detalhes: novos primeiro (round-robin entre boards), depois refresh
            budget = self.max_details()
            new_q: list[list[tuple[str, str]]] = []
            stale_q: list[list[tuple[str, str]]] = []
            for tenant, _c, _s, kept in boards:
                n, s = [], []
                for item in kept:
                    key = f"{tenant}:{item['id']}"
                    if cache.get(key) is None:
                        n.append((tenant, item["id"]))
                    else:
                        cache.touch(key)
                        if cache.is_stale(key):
                            s.append((tenant, item["id"]))
                new_q.append(n)
                stale_q.append(s)
            queue = _round_robin(new_q) + _round_robin(stale_q)
            gone: set[str] = set()
            for tenant, job_id in queue[:budget]:
                key = f"{tenant}:{job_id}"
                st = self.stats[tenant]
                try:
                    detail = self._fetch_detail(client, tenant, job_id)
                except _Gone:
                    gone.add(key)
                    st["gone"] = st.get("gone", 0) + 1
                    continue
                except Exception as exc:  # noqa: BLE001
                    print(f"[{self.slug}] detalhe {tenant}/{job_id}: {exc}")
                    st["detail_errors"] = st.get("detail_errors", 0) + 1
                    continue
                if detail:
                    cache.put(key, detail)
                    st["details_fetched"] = st.get("details_fetched", 0) + 1
                else:
                    st["detail_errors"] = st.get("detail_errors", 0) + 1
            cache.save()

            # 3) Payloads
            jobs: list[JobPayload] = []
            seen: set[str] = set()
            for tenant, company, sector, kept in boards:
                st = self.stats[tenant]
                for item in kept:
                    key = f"{tenant}:{item['id']}"
                    if key in gone:
                        continue
                    sid = self.source_id(tenant, item["id"])
                    if sid in seen:
                        continue
                    detail = cache.get(key)
                    job = self._build_payload(tenant, company, sector, item, detail)
                    if job is None:
                        continue
                    seen.add(sid)
                    jobs.append(job)
                    st["emitted"] = st.get("emitted", 0) + 1
                    if not detail:
                        st["listing_only"] = st.get("listing_only", 0) + 1
            for tenant, st in self.stats.items():
                print(f"[{self.slug}] {tenant}: {json.dumps(st, ensure_ascii=False)}")
            return jobs
        finally:
            client.close()

    def _get_with_retry(self, client: HttpClient, url: str) -> str:
        try:
            return client.get_text(url)
        except (httpx.TransportError, httpx.HTTPStatusError) as exc:
            if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code < 500:
                raise
            time.sleep(3)
            return client.get_text(url)

    def _fetch_listing(
        self, client: HttpClient, tenant: str
    ) -> tuple[list[dict[str, Any]], int | None]:
        base = self.base_url(tenant)
        items: dict[str, dict[str, Any]] = {}
        total: int | None = None
        page = 1
        while page <= MAX_PAGES:
            html = self._get_with_retry(client, f"{base}/?PageNumber={page}")
            page_items, meta = parse_listing_page(html)
            if page == 1:
                total = meta.get("total")
                if not page_items and "VacancyList" not in html:
                    raise RuntimeError(f"Pandapé {tenant}: página sem #VacancyList")
            new = [i for i in page_items if i["id"] not in items]
            for it in new:
                items[it["id"]] = it
            if not page_items or not new or meta.get("is_last"):
                break
            if total is not None and page * PAGE_SIZE >= total + PAGE_SIZE:
                break
            page += 1
        if total is not None and len(items) < total * 0.95:
            print(f"[{self.slug}] {tenant}: listagem {len(items)}/{total} (drift de paginação?)")
        return list(items.values()), total

    def _fetch_detail(self, client: HttpClient, tenant: str, job_id: str) -> dict[str, Any] | None:
        try:
            html = client.get_text(self.detail_url(tenant, job_id))
        except httpx.HTTPStatusError as exc:
            # Vaga fechada: Pandapé responde 404 "Esta vaga não está mais disponível".
            if exc.response.status_code in (404, 410):
                raise _Gone() from exc
            raise
        m = re.search(r'id="HdnIdVacancy"\s+value="(\d+)"', html)
        if m and m.group(1) != str(job_id):
            raise _Gone()  # redirect para outra vaga / home do board
        return parse_detail_page(html)

    def _build_payload(
        self,
        tenant: str,
        company: str,
        sector: str,
        item: dict[str, Any],
        detail: dict[str, Any] | None,
    ) -> JobPayload | None:
        d = detail or {}
        title = _clean(d.get("title") or item.get("title"))
        if not title:
            return None
        city = d.get("city") or item.get("city")
        uf = d.get("uf") or item.get("uf")
        if not city and not uf:
            return None
        description = (d.get("description") or "").strip()
        if len(description) < 40:
            description = listing_description({**item, "title": title})
        salary = d.get("salary") or format_salary_text(item.get("salary"))
        published = d.get("date_posted") or parse_listing_date(item.get("date_label"))
        return JobPayload(
            title=title,
            company=company,
            location_district=state_from_uf(uf),
            location_concelho=city,
            profession=guess_profession(title),
            specialty=None,
            sector=sector,
            contract_type=pandape_contract(d.get("contract") or item.get("contract"), title),
            description=description,
            requirements=d.get("requirements"),
            salary=salary,
            application_url=self.detail_url(tenant, item["id"]),
            source=self.slug,
            source_id=self.source_id(tenant, item["id"]),
            published_at=published,
            expires_at=d.get("valid_through"),
        )


class _Gone(Exception):
    """Vaga já não existe (404/410 ou redirect para fora do detalhe)."""


def _round_robin(queues: list[list[tuple[str, str]]]) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    idx = 0
    while any(idx < len(q) for q in queues):
        for q in queues:
            if idx < len(q):
                out.append(q[idx])
        idx += 1
    return out


# ---------------------------------------------------------------------------
# Classes registáveis
# ---------------------------------------------------------------------------


class HapvidaPandapeScraper(PandapeBoardScraper):
    """Hapvida NotreDame Intermédica — board Pandapé (também tem Gupy `hapvida`).

    Mesmo label de empresa que `HapvidaScraper` (Gupy) para o dedupe
    título+empresa+estado da app funcionar. Filtro `health` = mesma política.
    """

    slug = "hapvida_pandape"
    name = "Hapvida NotreDame Intermédica (Pandapé)"
    filter_mode = "health"
    BOARDS = [("hapvidandi", "Hapvida NotreDame Intermédica", "privado")]


class PandapeHospitaisScraper(PandapeBoardScraper):
    """Hospitais / OSS / filantrópicos em Pandapé (multi-board)."""

    slug = "pandape_hospitais"
    name = "Hospitais (Pandapé)"
    filter_mode = "hospital"
    # (tenant, company label, sector) — todos com vagas (probe 20 Out 2026)
    BOARDS = [
        ("redesantacatarina", "Rede Santa Catarina", "ipss"),
        ("santacasademisericordiadesaopaulo", "Santa Casa de Misericórdia de São Paulo", "ipss"),
        ("cejam", "CEJAM", "ipss"),
        ("santacasadechavantes", "Grupo Chavantes (Santa Casa de Chavantes)", "ipss"),
        ("santamarcelinasaude", "Santa Marcelina Saúde", "ipss"),
        ("hospitalematernidadesaocristovao", "Grupo São Cristóvão Saúde", "ipss"),
        ("isasaude", "ISA Saúde", "privado"),
        ("hospitaladventistapenfigo", "Hospital Adventista do Pênfigo", "ipss"),
        ("blanchospital", "Blanc Hospital", "privado"),
        ("cemahospitalespecializado", "CEMA Hospital Especializado", "privado"),
        ("hospitalsaovicentedepaulo", "Hospital São Vicente de Paulo", "ipss"),
        ("hospitalangelinacaron", "Hospital Angelina Caron", "ipss"),
        ("irmandadedasantacasademisericordiadecuritiba", "Santa Casa de Curitiba", "ipss"),
        ("complexodesaudesbc", "Complexo de Saúde de São Bernardo do Campo", "publico"),
        ("hospitalematernidademarieta", "Hospital e Maternidade Marieta", "ipss"),
        ("hospitalpequenoprincipe", "Hospital Pequeno Príncipe", "ipss"),
    ]
