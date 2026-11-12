from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from sources import gu_s4 as G
from sources import _it_pub as P
from jobtype_check import classify

FX = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 11, 12, tzinfo=timezone.utc)


def entries():
    es, issue = G.parse_rss((FX / "gu_s4_rss.xml").read_text(encoding="utf-8"))
    return es, issue


def test_parse_rss():
    es, issue = entries()
    assert issue == (date(2026, 11, 10), 87)
    assert len(es) == 11
    rieti = next(e for e in es if "RIETI" in e.ente)
    assert rieti.kind == "CONCORSO" and rieti.scad == "10 dicembre 2026"
    assert rieti.published == date(2026, 11, 10)
    assert "dirigente medico" in rieti.text and not rieti.text.endswith(")")
    assert any(e.kind == "DIARIO" for e in es) and any(e.kind == "RETTIFICA" for e in es)


def test_parse_issue_html_matches_feed_shape():
    es = G.parse_issue_html((FX / "gu_s4_issue.html").read_text(encoding="utf-8"), date(2026, 11, 10), 87)
    assert len(es) == 5
    rieti = next(e for e in es if "RIETI" in e.ente)
    assert rieti.kind == "CONCORSO" and rieti.scad == "10 dicembre 2026" and rieti.code.startswith("26E")
    assert "chirurgia generale" in rieti.text  # accenti/apostrofi gia' sistemati dal parser


def test_health_filter_and_not_open():
    es, _ = entries()
    stats = {}
    calls = G.build_calls(es, NOW, stats)
    companies = {c.job.company for c in calls}
    assert any("Rieti" in c for c in companies)
    assert any("Viterbo" in c for c in companies)
    assert not any("Varmo" in c or "Pisa" in c or "Perugia" in c or "Ricerche" in c for c in companies)
    assert stats["non_health"] >= 2  # universita', comune, ministero
    assert stats["not_open"] >= 3  # DIARIO, RETTIFICA, AVVISO


def test_job_fields():
    es, _ = entries()
    calls = G.build_calls(es, NOW)
    rieti = next(c.job for c in calls if "Rieti" in c.job.company)
    assert rieti.title == "Concorso pubblico per 1 posto di Dirigente Medico – Chirurgia Generale — ASL Rieti"
    assert rieti.location_district == "Lazio" and rieti.location_concelho == "Rieti"
    assert rieti.profession == "Medicina" and rieti.sector == "pubblico"
    assert rieti.expires_at.startswith("2026-12-10") and rieti.published_at.startswith("2026-11-10")
    assert rieti.application_url == "https://www.gazzettaufficiale.it/eli/id/2026/11/10/" + rieti.source_id.removeprefix("gu-") + "/S4"
    assert "Gazzetta Ufficiale" in rieti.description and len(rieti.description) >= 200
    viterbo = next(c.job for c in calls if "Viterbo" in c.job.company)
    assert viterbo.title.startswith("Concorso pubblico per 4 posti di Dirigente Medico") and viterbo.profession == "Medicina"
    ulss = next(c.job for c in calls if "ULSS" in c.job.title)
    assert ulss.location_district == "Veneto"


def test_estar_goes_to_toscana():
    es, _ = entries()
    estar = next(c.job for c in G.build_calls(es, NOW) if c.job.company.startswith("ESTAR"))
    assert estar.location_district == "Toscana"
    assert estar.title.startswith("Selezione pubblica per Direttore UOC")


def test_expired_is_skipped():
    es, _ = entries()
    stats = {}
    assert G.build_calls(es, datetime(2026, 12, 11, tzinfo=timezone.utc), stats) == []
    assert stats["expired"] >= 5


def test_deadline_estimated_when_stated_as_30_days():
    e = G.Entry("AZIENDA SANITARIA LOCALE DI RIETI", "CONCORSO", None,
                "Concorso pubblico per un posto di infermiere, da presentare entro trenta giorni dalla pubblicazione nella Gazzetta Ufficiale", "26E00001", date(2026, 11, 10), "87")
    call = G.build_call(e, NOW)
    assert call.job.expires_at.startswith("2026-12-10")
    assert "stimata" in call.job.description
    e.text = "Concorso pubblico per un posto di infermiere"
    stats = {}
    assert G.build_call(e, NOW, stats) is None and stats["no_deadline"] == 1


def test_duplicates_dropped_against_inpa_and_veneto_keys():
    es, _ = entries()
    calls = G.build_calls(es, NOW)
    rieti = next(c for c in calls if "Rieti" in c.job.company)
    inpa_key = P.make_key(["ASL Rieti"], "Dirigente Medico", "Chirurgia generale", [1], date(2026, 12, 10))
    kept, dropped = P.drop_duplicates(calls, [inpa_key])
    assert dropped == [rieti] and rieti not in kept
    veneto_key = P.make_key(["Azienda Zero", "Azienda ULSS 7 Pedemontana"], "Dirigente Medico", "Igiene", [1], date(2026, 12, 10), [None, 1])
    ulss = next(c for c in calls if "ULSS" in c.job.title)
    assert not P.keys_match(ulss.key, veneto_key)  # profilo diverso (direttore UOC)


def test_job_types_in_app():
    es, _ = entries()
    calls = G.build_calls(es, NOW)
    result = classify([{"title": c.job.title, "description": c.job.description} for c in calls])
    if result is None:
        pytest.skip("node/typescript non disponibili")
    assert set(result) <= {"concorso", "tempo_determinato"}
    assert result.count("concorso") >= 3
