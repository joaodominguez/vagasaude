from __future__ import annotations

from sources.pandape import PandapeBoardScraper


class HcorScraper(PandapeBoardScraper):
    """HCor — Hospital do Coração (Pandapé / InfoJobs).

    Usa a base Pandapé multi-página (antes só lia a página 1 → ≤20 vagas).
    `hcoracao.pandape…` faz 301 para `hcor.pandape…`, por isso o tenant é `hcor`.

    source_id mantém o formato legado (só o ID numérico Pandapé, sem prefixo)
    para não mudar IDs já ingeridos nem provocar soft-expire em massa.
    """

    slug = "hcor"
    name = "HCor — Hospital do Coração"
    company = "HCor — Hospital do Coração"
    sector = "ipss"  # Associação Beneficente Síria → Filantrópico
    filter_mode = "hospital"  # = looks_like_hospital_employer_job (política anterior)
    source_id_style = "bare"
    BOARDS = [("hcor", "HCor — Hospital do Coração", "ipss")]
