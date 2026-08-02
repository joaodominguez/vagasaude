from __future__ import annotations

import re
from html import unescape

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_district, guess_profession, html_to_text

BASE = "https://www.bep.gov.pt"
SEARCH_BASIC = f"{BASE}/pages/oferta/Oferta_Pesquisa_basica.aspx"
SEARCH_ADV = f"{BASE}/pages/oferta/Oferta_Pesquisa.aspx"
# Compat com código antigo / README.
SEARCH_URL = SEARCH_BASIC

# Níveis orgânicos de saúde no BEP (dropNivelOrganico em Oferta_Pesquisa.aspx).
# O assistente assistantOrg.aspx?CodNivelOrganico=29 corresponde ao Ministério da Saúde
# (códigos internos 308 / 470) e secretarias regionais.
HEALTH_NIVEL_ORGANICO = (
    "308",  # Ministério da Saúde
    "470",  # Ministério da Saúde (entrada alternativa)
    "366",  # Secretaria Regional da Saúde (RAA)
    "447",  # Secretaria Regional da Saúde e Desporto (RAA)
    "434",  # Secretaria Regional de Saúde e Proteção Civil (RAM)
)

# Complemento por texto livre (ex.: Escolas Superiores de Saúde fora do MS).
SEARCH_TERMS = [
    "enfermeiro",
    "enfermagem",
    "médico",
    "medico",
    "fisioterapeuta",
    "farmacêutico",
    "farmaceutico",
    "técnico auxiliar de saúde",
    "tecnico auxiliar de saude",
    "técnico superior de saúde",
    "tecnico superior de saude",
    "administrador hospitalar",
    "Unidade Local de Saúde",
    "Escola Superior de Saúde",
    "IPO",
    "diagnóstico e terapêutica",
    "diagnostico e terapeutica",
    "assistente graduado",
]

# Organismos SNS / saúde pública — aceitar ofertas mesmo sem keyword clínica.
SNS_ORG_RE = re.compile(
    r"unidade\s+local\s+de\s+sa[uú]de|"
    r"centro\s+hospitalar|"
    r"instituto\s+portugu[eê]s\s+de\s+oncologia|"
    r"\bipo\b|"
    r"escola\s+superior\s+de\s+sa[uú]de|"
    r"administra[cç][aã]o\s+regional\s+de\s+sa[uú]de|"
    r"administra[cç][aã]o\s+central\s+do\s+sistema\s+de\s+sa[uú]de|"
    r"dire[cç][aã]o[- ]geral\s+da\s+sa[uú]de|"
    r"servi[cç]o\s+de\s+utiliza[cç][aã]o\s+comum\s+dos\s+hospitais|"
    r"infarmed|"
    r"instituto\s+nacional\s+de\s+emerg[eê]ncia|"
    r"\binem\b|"
    r"instituto\s+portugu[eê]s\s+do\s+sangue|"
    r"secretaria\s+regional.*sa[uú]de|"
    r"hospital\b.+\be\.?\s*p\.?\s*e",
    re.I,
)

CLINICAL_ROLE_RE = re.compile(
    r"enferm|m[eé]dic|fisioterap|farmac|diagn[oó]stico|terap[eê]ut|"
    r"nutric|psicolog|ortopt|audiolog|imagiolog|radiolog|cardiopneum|"
    r"anatomia\s+patol|neurofisiolog|higienista|"
    r"auxiliar\s+de\s+sa[uú]de|t[eé]cnico\s+auxiliar\s+de\s+sa[uú]de|"
    r"t[eé]cnico\s+superior\s+de\s+sa[uú]de|"
    r"administrador\s+hospitalar|assistente\s+graduado|"
    r"cuidados\s+de\s+sa[uú]de",
    re.I,
)

ACADEMIC_ROLE_RE = re.compile(r"\bprofessor\b|\binvestigador\b", re.I)
VET_RE = re.compile(r"veterin", re.I)

NON_HEALTH_ORG_RE = re.compile(
    r"junta\s+de\s+freguesia|c[aâ]mara\s+municipal|agrupamento\s+de\s+escolas|"
    r"escola\s+b[aá]sica|escola\s+secund[aá]ria|universidade|faculdade|"
    r"instituto\s+polit[eé]cnico",
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
                if detail:
                    jobs.append(detail)
            return jobs
        finally:
            client.close()

    def _collect_listings(self, client: HttpClient) -> list[dict]:
        by_code: dict[str, dict] = {}

        # 1) Ofertas de organismos do Ministério da Saúde / secretarias regionais.
        for nivel in HEALTH_NIVEL_ORGANICO:
            for row in self._search_nivel(client, nivel):
                if not self._is_health(row):
                    continue
                row["term"] = f"nivel:{nivel}"
                by_code[row["code"]] = row

        # 2) Varredura do catálogo BEP (sem filtro de keywords) + filtro saúde.
        #    Cobre ULS/EPE/IPO que por vezes não vêm no nível orgânico 308/470.
        for row in self._search_catalog(client):
            if not self._is_health(row):
                continue
            row.setdefault("term", "catalog")
            by_code.setdefault(row["code"], row)

        # 3) Complemento por palavras-chave (escolas de saúde, tipologias clínicas).
        for term in SEARCH_TERMS:
            for row in self._search_term(client, term):
                if not self._is_health(row):
                    continue
                row.setdefault("term", term)
                by_code.setdefault(row["code"], row)

        return list(by_code.values())

    def _search_catalog(self, client: HttpClient, max_pages: int = 50) -> list[dict]:
        html = client.get_text(SEARCH_ADV)
        payload = _form_fields(html)
        search_btn = _search_button_name(html)
        if not search_btn:
            return []
        payload[search_btn] = "Pesquisar"
        html = client.post_form(SEARCH_ADV, payload)
        return self._paginate_rows(
            client, SEARCH_ADV, html, term="catalog", max_pages=max_pages
        )

    def _search_nivel(self, client: HttpClient, nivel: str, max_pages: int = 30) -> list[dict]:
        html = client.get_text(SEARCH_ADV)
        payload = _form_fields(html)
        for key in list(payload):
            if key.endswith("dropNivelOrganico"):
                payload[key] = str(nivel)
        search_btn = _search_button_name(html)
        if not search_btn:
            return []
        payload[search_btn] = "Pesquisar"
        html = client.post_form(SEARCH_ADV, payload)
        return self._paginate_rows(client, SEARCH_ADV, html, term=f"nivel:{nivel}", max_pages=max_pages)

    def _search_term(self, client: HttpClient, term: str, max_pages: int = 10) -> list[dict]:
        html = client.get_text(SEARCH_BASIC)
        payload = _hidden_fields(html)
        payload[
            "ctl00$ctl00$FormMasterContentPlaceHolder$ContentPlaceHolder1$txtValor"
        ] = term
        payload[
            "ctl00$ctl00$FormMasterContentPlaceHolder$ContentPlaceHolder1$ucSearch"
        ] = "Pesquisar"
        html = client.post_form(SEARCH_BASIC, payload)
        return self._paginate_rows(client, SEARCH_BASIC, html, term=term, max_pages=max_pages)

    def _paginate_rows(
        self,
        client: HttpClient,
        url: str,
        html: str,
        term: str,
        max_pages: int,
    ) -> list[dict]:
        rows: list[dict] = []
        page = 1
        while page <= max_pages:
            for row in _parse_rows(html):
                row["term"] = term
                row["page"] = page
                rows.append(row)
            nxt = page + 1
            if f"Page${nxt}" not in html:
                break
            payload = _form_fields(html) if url == SEARCH_ADV else _hidden_fields(html)
            payload["__EVENTTARGET"] = _grid_event_target(html)
            payload["__EVENTARGUMENT"] = f"Page${nxt}"
            payload = {
                key: value
                for key, value in payload.items()
                if not key.endswith("ucSearch")
            }
            html = client.post_form(url, payload)
            page = nxt
        return rows

    def _fetch_detail(self, client: HttpClient, item: dict) -> JobPayload | None:
        # Abrir a oferta pelo código OE (pesquisa básica) e fazer postback do detalhe.
        code = item["code"]
        html = client.get_text(SEARCH_BASIC)
        payload = _hidden_fields(html)
        payload[
            "ctl00$ctl00$FormMasterContentPlaceHolder$ContentPlaceHolder1$txtValor"
        ] = code
        payload[
            "ctl00$ctl00$FormMasterContentPlaceHolder$ContentPlaceHolder1$ucSearch"
        ] = "Pesquisar"
        html = client.post_form(SEARCH_BASIC, payload)

        ctl = None
        for row in _parse_rows(html):
            if row["code"] == code:
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
        response = client.post_form_response(SEARCH_BASIC, payload)
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
            specialty=(
                carreira
                if carreira and "não aplicável" not in carreira.lower()
                else None
            ),
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
            application_url=SEARCH_BASIC,
            source=self.slug,
            source_id=item["code"],
            published_at=None,
            expires_at=_iso_date(item.get("data_limite")),
            status="pending_review",
            review_reason="Detalhe BEP indisponível; dados só da listagem.",
        )

    @staticmethod
    def _is_health(row: dict) -> bool:
        organismo = str(row.get("organismo") or "")
        role_blob = " ".join(
            str(row.get(key) or "") for key in ("carreira", "categoria", "tipo")
        )
        blob = f"{role_blob} {organismo}"
        if VET_RE.search(blob):
            return False
        # Professores/investigadores universitários com "saúde/medicina" no nome
        # da faculdade não são vagas SNS operacionais.
        if ACADEMIC_ROLE_RE.search(role_blob) and not re.search(
            r"escola\s+superior\s+de\s+sa[uú]de",
            organismo,
            re.I,
        ):
            return False
        if SNS_ORG_RE.search(organismo):
            return True
        if not CLINICAL_ROLE_RE.search(role_blob):
            return False
        # Evitar Assistente Operacional genérico em juntas/câmaras.
        if NON_HEALTH_ORG_RE.search(organismo):
            return bool(
                re.search(
                    r"enferm|m[eé]dic|fisioterap|farmac|"
                    r"diagn[oó]stico|terap[eê]ut|auxiliar\s+de\s+sa[uú]de|"
                    r"t[eé]cnico\s+auxiliar\s+de\s+sa[uú]de|"
                    r"t[eé]cnico\s+superior\s+de\s+sa[uú]de|"
                    r"administrador\s+hospitalar|assistente\s+graduado",
                    role_blob,
                    re.I,
                )
            )
        return True


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


def _form_fields(html: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for match in re.finditer(r"<input([^>]+)>", html, re.I):
        attrs = match.group(1)
        name_match = re.search(r'\bname="([^"]+)"', attrs, re.I)
        if not name_match:
            continue
        name = name_match.group(1)
        type_match = re.search(r'\btype="([^"]*)"', attrs, re.I)
        input_type = (type_match.group(1) if type_match else "text").lower()
        if input_type in {"submit", "button", "image"}:
            continue
        value_match = re.search(r'\bvalue="([^"]*)"', attrs, re.I)
        fields[name] = unescape(value_match.group(1) if value_match else "")
    for match in re.finditer(
        r'<select[^>]*name="([^"]+)"[^>]*>(.*?)</select>',
        html,
        re.I | re.S,
    ):
        name = match.group(1)
        selected = re.search(
            r'<option[^>]*selected[^>]*value="([^"]*)"',
            match.group(2),
            re.I,
        )
        if not selected:
            selected = re.search(
                r'<option[^>]*value="([^"]*)"',
                match.group(2),
                re.I,
            )
        fields[name] = unescape(selected.group(1) if selected else "0")
    return fields


def _search_button_name(html: str) -> str | None:
    for match in re.finditer(r"<input([^>]+)>", html, re.I):
        attrs = match.group(1)
        name_match = re.search(r'\bname="([^"]+)"', attrs, re.I)
        value_match = re.search(r'\bvalue="([^"]*)"', attrs, re.I)
        if name_match and value_match and value_match.group(1) == "Pesquisar":
            return name_match.group(1)
    return None


def _grid_event_target(html: str) -> str:
    match = re.search(r"doPostBack\('(ctl00\$ctl00\$[^']*GvOferta[^']*)'", html)
    if match:
        return match.group(1)
    return (
        "ctl00$ctl00$FormMasterContentPlaceHolder$ContentPlaceHolder1$GvOfertaGestao"
    )


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
