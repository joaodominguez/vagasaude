from datetime import datetime, timezone
from pathlib import Path

import pytest

from sources import veneto_concorsi as V
from sources import _it_pub as P
from jobtype_check import classify

FX = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 11, 12, tzinfo=timezone.utc)


def detail(i):
    return V.parse_detail((FX / f"veneto_detail_{i}.html").read_text(encoding="utf-8"), str(i))


def test_parse_list_returns_open_ids():
    assert V.parse_list((FX / "veneto_list_open.html").read_text(encoding="utf-8")) == ["915", "914", "913", "846", "304"]


def test_parse_detail_fields():
    d = detail(915)
    assert d["stato"] == "Aperto"
    assert d["data scadenza"] == "3 Dicembre 2026"
    assert len(d["entes"]) == 9
    assert d["entes"][0] == ("Azienda ULSS 1 Dolomiti", 5)
    assert sum(n for _, n in d["entes"]) == 15
    assert d["attachments"][0][0] == "bando"
    assert "concorso_apridoc" in d["attachments"][0][1]


def test_aggregate_concorso_job():
    stats = {}
    call = V.build_call(detail(915), NOW, stats)
    job = call.job
    assert job.title == "Concorso pubblico per 15 posti di Dirigente Medico – Neurologia — Azienda Zero Veneto"
    assert job.company == "Azienda Zero — Regione Veneto"
    assert job.location_district == "Veneto" and job.location_concelho == "Padova"
    assert job.profession == "Medicina" and job.sector == "pubblico"
    assert job.contract_type == "Tempo indeterminato"
    assert job.expires_at.startswith("2026-12-03") and job.published_at.startswith("2026-11-04")
    assert job.source == "veneto-concorsi" and job.source_id == "veneto-915"
    assert job.application_url.endswith("action=trasparenza.concorso&id=915")
    assert "Azienda ULSS 6 Euganea: 1 posto" in job.description and "3 dicembre 2026" in job.description
    assert len(job.description) >= 200
    assert call.key.disc == P.stems("Neurologia")


def test_standing_notices():
    tempo = V.build_call(detail(846), NOW).job
    assert tempo.title.startswith("Avviso a tempo determinato per Medici")
    lp = V.build_call(detail(304), NOW).job
    assert lp.title.startswith("Incarico libero-professionale per")
    assert lp.contract_type == "Libero professionale"
    assert lp.location_concelho == "Venezia"


def test_expired_and_closed_are_skipped():
    d = detail(915)
    d["data scadenza"] = "1 Novembre 2026"
    stats = {}
    assert V.build_call(d, NOW, stats) is None and stats["expired"] == 1
    d = detail(915)
    d["stato"] = "Scaduto"
    assert V.build_call(d, NOW, {}) is None


def test_non_health_is_skipped():
    d = detail(915)
    d["entes"] = [("Tribunale per i Minorenni di Venezia", None)]
    d["title"] = "Concorso pubblico per n. 2 posti di cancelliere"
    stats = {}
    assert V.build_call(d, NOW, stats) is None and stats["non_health"] == 1


def test_job_types_in_app():
    titles = [V.build_call(detail(i), NOW).job.title for i in (915, 846, 304)]
    result = classify([{"title": t} for t in titles])
    if result is None:
        pytest.skip("node/typescript non disponibili")
    assert result == ["concorso", "tempo_determinato", "incarico"]
