import json
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from sources import inpa as I
from sources import _it_pub as P
from jobtype_check import classify

FX = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 11, 12, tzinfo=timezone.utc)
ID = "c5eea00402d6401abe9ac5415a12fefa"


def detail():
    return I.parse_detail((FX / "inpa_detail_infermiere.html").read_text(encoding="utf-8"), ID)


def test_parse_sitemap():
    entries = I.parse_sitemap((FX / "inpa_sitemap.xml").read_text(encoding="utf-8"))
    assert len(entries) == 4
    assert entries[0] == ("cbee86f168964c0c83e045a300b9b95a", "2026-11-11T23:01:00Z")


def test_parse_detail_fields():
    d = detail()
    assert d["stato"] == "Aperto"
    assert d["ente di riferimento"] == "Asst Fatebenefratelli Sacco"
    assert d["area geografica"] == "Lombardia"
    assert d["numero di posti"] == "20"
    assert d["data chiusura candidature"].startswith("11 Dicembre 2026")
    assert d["attachments"][0][1].startswith("https://portale.inpa.gov.it/api/media/")


def test_health_job_fields():
    d = detail()
    assert I.classify_detail(d, NOW) == ("keep", None)
    job = I.build_call(d, NOW).job
    assert job.title == "Concorso pubblico per 20 posti di Infermiere — ASST Fatebenefratelli Sacco"
    assert job.company == "ASST Fatebenefratelli Sacco"
    assert job.location_district == "Lombardia" and job.profession == "Infermieristica" and job.sector == "pubblico"
    assert job.expires_at.startswith("2026-12-11") and job.published_at.startswith("2026-11-11")
    assert job.application_url == f"https://www.inpa.gov.it/bandi-e-avvisi/dettaglio-bando-avviso/?concorso_id={ID}"
    assert job.source == "inpa" and job.source_id == f"inpa-{ID}"
    assert "Posti: 20" in job.description and "11 dicembre 2026" in job.description and len(job.description) >= 200


def test_expired_not_open_and_non_health():
    d = detail()
    d["data chiusura candidature"] = "1 Novembre 2026 16:00"
    assert I.classify_detail(d, NOW)[0] == "expired"
    d = detail()
    d["stato"] = "Chiuso"
    assert I.classify_detail(d, NOW)[0] == "not_open"
    comune = detail()
    comune.update({"ente di riferimento": "Comune di Varmo", "title": "COMUNE DI VARMO – Concorso per un posto di istruttore tecnico",
                   "descrizione": "Concorso pubblico per un posto di istruttore tecnico, area dei funzionari"})
    assert I.classify_detail(comune, NOW)[0] == "non_health"
    sociale = detail()
    sociale.update({"ente di riferimento": "Comune di Lodi", "title": "COMUNE DI LODI – Concorso per un posto di assistente sociale", "descrizione": "Concorso per un posto di assistente sociale"})
    assert I.classify_detail(sociale, NOW)[0] == "non_health"


def test_health_by_profile_at_non_health_ente():
    d = detail()
    d.update({"ente di riferimento": "Comune di Lodi", "title": "COMUNE DI LODI – Concorso pubblico per un posto di infermiere", "descrizione": "Concorso pubblico per un posto di infermiere presso la residenza comunale"})
    assert I.classify_detail(d, NOW)[0] == "keep"
    d["ente di riferimento"] = "Università degli Studi di Pavia"
    d["title"] = "UNIVERSITA – Procedura per ricercatore a tempo determinato, settore medicina"
    d["descrizione"] = "Procedura per ricercatore a tempo determinato, settore medicina"
    assert I.classify_detail(d, NOW)[0] == "non_health"


def test_oiv_and_research_notices_skipped():
    d = detail()
    d["descrizione"] = "Avviso pubblico per l'individuazione di n. 3 componenti dell'Organismo indipendente di valutazione"
    assert I.classify_detail(d, NOW)[0] == "not_open"


def test_job_type_in_app():
    job = I.build_call(detail(), NOW).job
    result = classify([{"title": job.title, "description": job.description}])
    if result is None:
        pytest.skip("node/typescript non disponibili")
    assert result == ["concorso"]


def test_dedupe_against_veneto_key_and_priority():
    call = I.build_call(detail(), NOW)
    veneto = P.make_key(["Azienda Zero", "ASST Fatebenefratelli Sacco"], "Infermiere", None, [20], date(2026, 12, 11), [None, 20])
    kept, dropped = P.drop_duplicates([call], [veneto])
    assert dropped == [call] and kept == []
    unrelated = P.make_key(["Azienda ULSS 6 Euganea"], "Infermiere", None, [20], date(2026, 12, 11))
    assert P.drop_duplicates([call], [unrelated])[0] == [call]


class FakeClient:
    def __init__(self, pages):
        self.pages, self.calls = pages, []

    def get_text(self, url):
        self.calls.append(url)
        return self.pages[url]


def test_cache_avoids_refetching_and_limits_fetches(tmp_path):
    sitemap = (FX / "inpa_sitemap.xml").read_text(encoding="utf-8")
    ids = [i for i, _ in I.parse_sitemap(sitemap)]
    html = (FX / "inpa_detail_infermiere.html").read_text(encoding="utf-8")
    pages = {I.SITEMAP: sitemap, **{I.DETAIL.format(id=i): html for i in ids}}
    cache = {}
    client = FakeClient(pages)
    calls, complete = I.collect_calls(client, NOW, {}, max_fetch=2, cache=cache, save=False)
    assert not complete and len(calls) == 2  # 2 pagine lette, 2 restano
    assert len(client.calls) == 1 + 2
    client2 = FakeClient(pages)
    calls, complete = I.collect_calls(client2, NOW, {}, max_fetch=10, cache=cache, save=False)
    assert complete and len(calls) == 4
    assert len(client2.calls) == 1 + 2  # solo le 2 mancanti
    path = tmp_path / "c.json"
    I.save_cache(cache, path)
    assert set(I.load_cache(path)) == set(ids)
