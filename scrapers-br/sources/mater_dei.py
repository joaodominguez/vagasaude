from __future__ import annotations

from typing import Any

from common.http import HttpClient
from sources.pandape import PandapeBoardScraper

TENANT = "hospitalmaterdei"


class MaterDeiScraper(PandapeBoardScraper):
    """Rede Mater Dei de Saúde — board Pandapé `hospitalmaterdei`.

    Out 2026: o portal JobConvo antigo (app.jobconvo.com/…/hospital-mater-dei)
    ficou vazio ("Nenhuma vaga aberta") e o scraper devolvia 0 com status ok.
    As vagas (~240: BH, Betim, Nova Lima, Uberlândia, Salvador, Feira de
    Santana, Goiânia) estão agora em https://hospitalmaterdei.pandape.infojobs.com.br/.
    materdei.com.br está atrás de Cloudflare (403 também no VPS).

    source_id = "hospitalmaterdei-<id>" (IDs JobConvo antigos já expiraram).
    """

    slug = "mater_dei"
    name = "Rede Mater Dei de Saúde"
    company = "Rede Mater Dei de Saúde"
    sector = "privado"
    filter_mode = "hospital"  # = looks_like_hospital_employer_job (política anterior)
    source_id_style = "tenant"
    BOARDS = [(TENANT, "Rede Mater Dei de Saúde", "privado")]

    def _fetch_listing(
        self, client: HttpClient, tenant: str
    ) -> tuple[list[dict[str, Any]], int | None]:
        items, total = super()._fetch_listing(client, tenant)
        # Board de ~240 vagas: 0 cartões = layout mudou / board migrou de novo.
        # Levantar (não devolver [] em silêncio) → a base marca o board em erro
        # e, sendo o único, a corrida falha de forma visível.
        if not items:
            raise RuntimeError(
                f"Pandapé {tenant}: 0 vagas na listagem (total={total}); "
                "layout alterado ou Mater Dei mudou de ATS"
            )
        return items, total
