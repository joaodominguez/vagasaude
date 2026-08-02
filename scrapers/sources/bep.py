from __future__ import annotations

import re
from html import unescape

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_district, guess_profession, html_to_text

BASE = "https://www.bep.gov.pt"
SEARCH_URL = f"{BASE}/pages/oferta/Oferta_Pesquisa_basica.aspx"

# Termos de pesquisa focados em saúde pública (BEP indexa texto livre).
SEARCH_TERMS = [
    "enfermeiro",
    "enfermagem",
    "médico",
    "medico",
    "médica",
    "fisioterapeuta",
    "farmacêutico",
    "farmaceutico",
    "terapeuta",
    "nutricionista",
    "psicólogo",
    "psicologo",
    "ortoptista",
    "audiologia",
    "imagiologia",
    "radiologia",
    "cardiopneumologia",
    "anatomia patológica",
    "técnico de diagnóstico",
    "tecnico de diagnostico",
    "técnico superior de saúde",
    "técnico auxiliar de saúde",
    "administrador hospitalar",
    "assistente operacional",
    "auxiliar de ação médica",
    "Unidade Local de Saúde",
    "ULS",
    "hospital",
    "IPO",
]

HEALTH_RE = re.compile(
    r"enferm|m[eé]dic|fisioterap|farmac|diagn[oó]stico|terap[eê]ut|"
    r"nutric|psicolog|ortopt|audiolog|imagiolog|radiolog|cardiopneum|"
    r"anatomia\s+patol|neurofisiolog|higienista|auxilia|"
    r"administrador\s+hospitalar|assistente\s+graduado|"
    r"sa[uú]de|hospital|uls\b|ars\b|ipo\b|oncolog|cuidados\s+de\s+sa[uú]de|"
    r"centro\s+hospitalar|unidade\s+local\s+de\s+sa[uú]de",
    re.I,
)

ROW_RE = re.compile(
    r'id="[^"]*GvOfertaGestao_ctl(\d+)_btnDetalhes"[^>]*>\s*(OE[^<\s]+)\s*</a>\s*</td>\s*'
    r"<td>(.*?)</td>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*"
    r"<td>(.*?)</td>\s*<td>(.*?)</td>\s*<td[^>]*>(.*?)</td>",
    re.I | re.S,
)


class BepScraper(BaseScraper):
    slug = "bep"
    name = "BEP (Bolsa de Emprego Público)"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.35)
        try:
            listed = self._collect_listings(client)
            jobs: list[JobPayload] = []
            for item in listed:
                detail = self._fetch_detail(client, item)
                if not detail:
                    continue
                jobs.append(detail)
            return jobs
        finally:
            client.close()

    def _collect_listings(self, client: HttpClient) -> list[dict]:
        by_code: dict[str, dict] = {}
        for term in SEARCH_TERMS:
            for row in self._search_term(client, term):
                if not self._is_health(row):
                    continue
                by_code[row["code"]] = row
        return list(by_code.values())

    def _search_term(self, client: HttpClient, term: str, max_pages: int = 10) -> list[dict]:
        html = client.get_text(SEARCH_URL)
        payload = _hidden_fields(html)
        payload["ctl00$ctl00$FormMasterContentPlaceHolder$ContentPlaceHolder1$txtValor"] = (
            term
        )
        payload[
            "ctl00$ctl00$FormMasterContentPlaceHolder$ContentPlaceHolder1$ucSearch"
        ] = "Pesquisar"
        html = client.post_form(SEARCH_URL, payload)
        rows: list[dict] = []
        page = 1
        while page <= max_pages:
            page_rows = _parse_rows(html)
            for row in page_rows:
                row["term"] = term
                row["page"] = page
                rows.append(row)
            pages = sorted({int(x) for x in re.findall(r"Page\$(\d+)", html)})
            nxt = page + 1
            if nxt not in pages:
                break
            payload = _hidden_fields(html)
            payload["__EVENTTARGET"] = (
                "ctl00$ctl00$FormMasterContentPlaceHolder$ContentPlaceHolder1$GvOfertaGestao"
            )
            payload["__EVENTARGUMENT"] = f"Page${nxt}"
            html = client.post_form(SEARCH_URL, payload)
            page = nxt
        return rows

    def _fetch_detail(self, client: HttpClient, item: dict) -> JobPayload | None:
        # Reabrir a pesquisa no termo/página onde a oferta apareceu e abrir o detalhe.
        html = client.get_text(SEARCH_URL)
        payload = _hidden_fields(html)
        payload["ctl00$ctl00$FormMasterContentPlaceHolder$ContentPlaceHolder1$txtValor"] = (
            item["term"]
        )
        payload[
            "ctl00$ctl00$FormMasterContentPlaceHolder$ContentPlaceHolder1$ucSearch"
        ] = "Pesquisar"
        html = client.post_form(SEARCH_URL, payload)

        for page in range(2, int(item.get("page") or 1) + 1):
            payload = _hidden_fields(html)
            payload["__EVENTTARGET"] = (
                "ctl00$ctl00$FormMasterContentPlaceHolder$ContentPlaceHolder1$GvOfertaGestao"
            )
            payload["__EVENTARGUMENT"] = f"Page${page}"
            html = client.post_form(SEARCH_URL, payload)

        # Localizar o ctl atual (a grelha pode mudar).
        ctl = None
        for row in _parse_rows(html):
            if row["code"] == item["code"]:
                ctl = row["ctl"]
                item = {**item, **row}
                break
        if not ctl:
            return self._payload_from_list_only(item)

        payload = _hidden_fields(html)
        payload["__EVENTTARGET"] = (
            "ctl00$ctl00$FormMasterContentPlaceHolder$ContentPlaceHolder1$"
            f"GvOfertaGestao$ctl{ctl}$btnDetalhes"
        )
        payload["__EVENTARGUMENT"] = ""
        response = client.post_form_response(SEARCH_URL, payload)
        labels = _parse_labels(response.text)
        cod = None
        match = re.search(r"CodOferta=(\d+)", str(response.url))
        if match:
            cod = match.group(1)
        application_url = (
            f"{BASE}/pages/oferta/Oferta_Detalhes.aspx?CodOferta={cod}"
            if cod
            else str(response.url)
        )

        categoria = labels.get("Categoria") or item.get("categoria") or "Oferta BEP"
        organismo = (
            labels.get("Órgão/Serviço")
            or labels.get("Orgao/Servico")
            or item.get("organismo")
            or "Administração Pública"
        )
        distrito = labels.get("Distrito") or item.get("distrito") or "Portugal"
        # Distrito por vezes só na listagem.
        if distrito == "Portugal":
            distrito = item.get("distrito") or "Portugal"

        title = categoria
        carreira = labels.get("Carreira") or item.get("carreira")
        if carreira and carreira.lower() not in {"não aplicável", "nao aplicavel"}:
            if carreira.lower() not in title.lower():
                title = f"{categoria} — {carreira}"

        description_parts = [
            labels.get("Caracterização do Posto de Trabalho"),
            labels.get("Descrição da Habilitação Literária"),
            labels.get("Outros Requisitos"),
            labels.get("Envio de candidaturas para"),
        ]
        description = "\n\n".join(p for p in description_parts if p) or (
            f"{title} em {organismo} ({distrito})."
        )
        requirements = labels.get("Outros Requisitos")
        published_at = _iso_date(labels.get("Data Publicitação"))
        expires_at = _iso_date(labels.get("Data Limite") or item.get("data_limite"))
        salary = labels.get("Remuneração")
        contract = labels.get("Vínculo") or item.get("vinculo")

        return JobPayload(
            title=title.strip(),
            company=organismo.strip(),
            location_district=guess_district(distrito),
            location_concelho=None,
            profession=guess_profession(f"{title} {carreira or ''}"),
            specialty=carreira if carreira and "não aplicável" not in carreira.lower() else None,
            sector="publico",
            contract_type=(contract or None),
            description=html_to_text(description),
            requirements=html_to_text(requirements) if requirements else None,
            salary=salary,
            application_url=application_url,
            source=self.slug,
            source_id=item["code"],
            published_at=published_at,
            expires_at=expires_at,
        )

    def _payload_from_list_only(self, item: dict) -> JobPayload:
        title = item.get("categoria") or "Oferta BEP"
        company = item.get("organismo") or "Administração Pública"
        district = guess_district(item.get("distrito"))
        return JobPayload(
            title=title,
            company=company,
            location_district=district,
            location_concelho=None,
            profession=guess_profession(f"{title} {item.get('carreira') or ''}"),
            specialty=item.get("carreira"),
            sector="publico",
            contract_type=item.get("vinculo"),
            description=f"{title} em {company} ({district}). Consultar detalhes no BEP.",
            requirements=None,
            salary=None,
            application_url=SEARCH_URL,
            source=self.slug,
            source_id=item["code"],
            published_at=None,
            expires_at=_iso_date(item.get("data_limite")),
            status="pending_review",
            review_reason="Detalhe BEP indisponível; dados só da listagem.",
        )

    @staticmethod
    def _is_health(row: dict) -> bool:
        blob = " ".join(
            str(row.get(key) or "")
            for key in ("carreira", "categoria", "organismo", "tipo")
        )
        return bool(HEALTH_RE.search(blob))


def _hidden_fields(html: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for match in re.finditer(r"<input([^>]+)>", html, re.I):
        attrs = match.group(1)
        name_match = re.search(r'\bname="([^"]+)"', attrs, re.I)
        if not name_match:
            continue
        name = name_match.group(1)
        if not name.startswith("__"):
            continue
        value_match = re.search(r'\bvalue="([^"]*)"', attrs, re.I)
        fields[name] = unescape(value_match.group(1) if value_match else "")
    return fields


def _parse_rows(html: str) -> list[dict]:
    rows: list[dict] = []
    for match in ROW_RE.finditer(html):
        cells = [
            re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", cell))).strip()
            for cell in match.groups()[2:]
        ]
        rows.append(
            {
                "ctl": match.group(1),
                "code": unescape(match.group(2)).strip(),
                "tipo": cells[0],
                "vinculo": cells[1],
                "carreira": cells[2],
                "categoria": cells[3],
                "distrito": cells[4],
                "organismo": cells[5],
                "habilitacoes": cells[6],
                "data_limite": cells[7],
            }
        )
    return rows


def _parse_labels(html: str) -> dict[str, str]:
    labels: dict[str, str] = {}
    for lab, val in re.findall(
        r'<div[^>]*tabletitle[^>]*>\s*([^:<][^<]*?):\s*</div>\s*<div[^>]*>\s*(.*?)\s*</div>',
        html,
        re.I | re.S,
    ):
        key = re.sub(r"\s+", " ", lab).strip()
        value = re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", val))).strip()
        if key and value:
            labels[key] = value
    return labels


def _iso_date(value: str | None) -> str | None:
    if not value:
        return None
    match = re.search(r"(\d{4}-\d{2}-\d{2})", value)
    if not match:
        return None
    return f"{match.group(1)}T00:00:00+00:00"
