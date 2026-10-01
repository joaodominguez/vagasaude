from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from html import unescape

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_profession, html_to_text, state_from_uf

WP_POSTS = "https://agenciasus.org.br/wp-json/wp/v2/posts"
# 50 = Trabalhe Conosco · 105 = Processos Seletivos Abertos
CATEGORIES = (105, 50)
MAX_AGE_DAYS = 180
MAX_PAGES_PER_CAT = 4
UF_RE = re.compile(
    r"\b("
    r"AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO"
    r")\b"
)
REGION_HINTS = (
    ("amazonas", "Amazonas"),
    ("manaus", "Amazonas"),
    ("roraima", "Roraima"),
    ("boa vista", "Roraima"),
    ("acre", "Acre"),
    ("rondonia", "Rondônia"),
    ("rondônia", "Rondônia"),
    ("dsei ", "Brasil"),  # placeholder skipped below
    ("pará", "Pará"),
    ("xingu", "Pará"),
    ("altamira", "Pará"),
    ("tapajos", "Pará"),
    ("tapajós", "Pará"),
    ("mato grosso do sul", "Mato Grosso do Sul"),
    ("mato grosso", "Mato Grosso"),
    ("bahia", "Bahia"),
    ("ceara", "Ceará"),
    ("ceará", "Ceará"),
    ("maranhao", "Maranhão"),
    ("maranhão", "Maranhão"),
    ("tocantins", "Tocantins"),
    ("minas gerais", "Minas Gerais"),
    ("espirito santo", "Espírito Santo"),
    ("espírito santo", "Espírito Santo"),
    ("sao paulo", "São Paulo"),
    ("são paulo", "São Paulo"),
    ("rio de janeiro", "Rio de Janeiro"),
    ("distrito federal", "Distrito Federal"),
    ("brasilia", "Distrito Federal"),
    ("brasília", "Distrito Federal"),
    ("alagoas", "Alagoas"),
    ("sergipe", "Sergipe"),
    ("pernambuco", "Pernambuco"),
    ("parintins", "Amazonas"),
    ("solimoes", "Amazonas"),
    ("solimões", "Amazonas"),
    ("javari", "Amazonas"),
    ("purus", "Amazonas"),
    ("yanomami", "Roraima"),
    ("porto velho", "Rondônia"),
)


class AgsusScraper(BaseScraper):
    """AgSUS — PSS / editais públicos via WP REST (Trabalhe Conosco)."""

    slug = "agsus"
    name = "AgSUS — Trabalhe Conosco"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.35)
        try:
            posts = self._collect_posts(client)
            jobs: list[JobPayload] = []
            for post in posts:
                title = unescape(post.get("title", {}).get("rendered") or "").strip()
                if not title:
                    continue
                if not self._looks_like_selection(title):
                    continue
                link = post.get("link") or ""
                if not link:
                    continue
                content_html = post.get("content", {}).get("rendered") or ""
                excerpt_html = post.get("excerpt", {}).get("rendered") or ""
                description = html_to_text(content_html) or html_to_text(excerpt_html) or title
                blob = f"{title} {description[:500]}"
                state = self._guess_state(blob)
                contract = guess_contract(blob) or "PSS"
                jobs.append(
                    JobPayload(
                        title=title[:200],
                        company="AgSUS — Agência Brasileira de Apoio à Gestão do SUS",
                        location_district=state,
                        location_concelho=None,
                        profession=guess_profession(title),
                        specialty=None,
                        sector="publico",
                        contract_type=contract,
                        description=description[:8000],
                        requirements=None,
                        salary=None,
                        application_url=link,
                        source=self.slug,
                        source_id=str(post.get("id")),
                        published_at=post.get("date"),
                        expires_at=None,
                    )
                )
            return jobs
        finally:
            client.close()

    def _collect_posts(self, client: HttpClient) -> list[dict]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
        by_id: dict[int, dict] = {}
        for cat in CATEGORIES:
            for page in range(1, MAX_PAGES_PER_CAT + 1):
                batch = client.get_json(
                    WP_POSTS,
                    params={
                        "categories": cat,
                        "per_page": 50,
                        "page": page,
                        "orderby": "date",
                        "order": "desc",
                    },
                )
                if not isinstance(batch, list) or not batch:
                    break
                older_only = True
                for post in batch:
                    pid = post.get("id")
                    if pid is None:
                        continue
                    date_raw = post.get("date") or ""
                    try:
                        # WP dates are local without Z; treat as naive UTC-ish cutoff.
                        dt = datetime.fromisoformat(date_raw.replace("Z", "+00:00"))
                        if dt.tzinfo is None:
                            dt = dt.replace(tzinfo=timezone.utc)
                    except ValueError:
                        dt = cutoff
                    if dt < cutoff and cat != 105:
                        continue
                    older_only = False
                    by_id[int(pid)] = post
                if older_only and cat != 105:
                    break
                if len(batch) < 50:
                    break
        return list(by_id.values())

    @staticmethod
    def _looks_like_selection(title: str) -> bool:
        t = title.lower()
        if "cipaa" in t or "eleitoral" in t:
            return False
        return any(
            k in t
            for k in (
                "edital",
                "processo seletivo",
                "pss",
                "seleção",
                "selecao",
                "vaga",
            )
        )

    @staticmethod
    def _guess_state(text: str) -> str:
        m = UF_RE.search(text.upper())
        if m:
            return state_from_uf(m.group(1))
        low = text.lower()
        for needle, name in REGION_HINTS:
            if needle == "dsei ":
                continue
            if needle in low:
                return name
        return "Brasil"
