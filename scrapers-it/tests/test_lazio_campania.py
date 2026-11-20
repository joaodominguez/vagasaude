"""Leitores a medida de Lazio e Campania (lote 1 da fase 2): ASL Roma 1/2/3/5, ASL Napoli 3 Sud, AORN dei Colli + graduatorie."""
import json
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from sources import _it_pub as P
from sources import aorn_colli as C
from sources import asl_napoli3sud as N
from sources import asl_roma1 as R1
from sources import asl_roma2 as R2
from sources import asl_roma3 as R3
from sources import asl_roma5 as R5
from sources import regional
from sources._it_regional import Item, Source, build_call, get_retry, gu_deadline, skip_reason
from jobtype_check import classify

FIX = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 11, 20, 12, 0, tzinfo=timezone.utc)


def read(name):
    return (FIX / name).read_text(encoding="utf-8")


def built(items, src):
    stats = {}
    calls = [c for c in (build_call(i, src, NOW, stats) for i in items) if c]
    return calls, stats


# --- Roma 1 ---------------------------------------------------------------------------------------------------------

def test_roma1_lista_texto_livre():
    items = R1.parse_list(read("asl_roma1_list.html"))
    assert len(items) >= 5
    ostetrica = next(i for i in items if "Ostetrica" in i.title)
    assert ostetrica.published == date(2026, 11, 19)
    # sem scadenza: 30 dias depois do extracto na G.U. («G.U. n. 88 del 13.11.2026»)
    assert ostetrica.deadline == date(2026, 12, 13)
    assert ostetrica.url.endswith("BANDO_BURL_OSTETRICHE.pdf")
    interno = next(i for i in items if "Odontoiatria" in i.title)
    assert interno.deadline == date(2026, 11, 24)
    calls, stats = built(items, R1.SRC)
    assert stats.get("internal", 0) >= 3  # avvisi internos para specialistas ambulatoriais: excluidos
    assert [c.job.title for c in calls] == ["Concorso pubblico per 28 posti di Ostetrica — ASL Roma 1"]
    job = calls[0].job
    assert job.location_district == "Lazio" and job.profession == "Ostetricia" and job.sector == "pubblico"
    assert job.company == "Azienda Sanitaria Locale Roma 1" and job.expires_at.startswith("2026-12-13")


def test_roma1_estrutura_mudada_levanta_erro():
    with pytest.raises(RuntimeError):
        R1.parse_list("<html><body>nada</body></html>")


# --- Roma 2 ---------------------------------------------------------------------------------------------------------

def test_roma2_tabela():
    rows = R2.parse_page(read("asl_roma2_list.html"))
    assert len(rows) == 10
    first, in_corso = rows[0]
    assert in_corso and first.deadline == date(2026, 11, 30) and first.published == date(2026, 11, 10)
    assert first.url.endswith("allegato.php?id=3519")
    calls, stats = built([i for i, _ in rows], R2.SRC)
    titles = [c.job.title for c in calls]
    assert titles[0] == "Avviso a tempo determinato per 4 posti de Tecnico di Fisiopatologia Cardiovascolare — ASL Roma 2".replace(" de ", " di ")
    assert any("Medicina Interna" in t for t in titles)  # «medicina interna» nao e «selezione interna»
    j = calls[0].job
    assert j.contract_type == "Tempo determinato"  # «a tempo determinato ... nelle more della procedura a tempo indeterminato»
    assert j.profession == "Tecnici sanitari"
    assert stats["expired"] >= 6


def test_roma2_sem_tabela_levanta_erro():
    with pytest.raises(RuntimeError):
        R2.parse_page("<html>login</html>")


# --- Roma 3 ---------------------------------------------------------------------------------------------------------

def test_roma3_api_wordpress():
    items = R3.parse_posts(json.loads(read("asl_roma3_comunicato.json")))
    assert items
    vet = next(i for i in items if "Veterinari" in i.title)
    assert vet.deadline == date(2026, 11, 28) and vet.published == date(2026, 11, 18)  # «Invio domande dal 19.11.2026 al 28.11.2026»
    conc = [i for i in items if i.title.lower().startswith("concorso")]
    assert conc and all(c.deadline == date(2026, 10, 15) for c in conc)  # GURI 15.09.2026 + 30 dias
    calls, stats = built(items, R3.SRC)
    assert [c.job.title for c in calls] == ["Incarico libero-professionale per Veterinari — ASL Roma 3"]
    assert stats["internal"] >= 1 and stats["expired"] >= 2


# --- Roma 5 ---------------------------------------------------------------------------------------------------------

def test_roma5_sitemap_e_detalhe():
    entries = R5.parse_sitemap(read("asl_roma5_sitemap.xml"))
    assert len(entries) == 6 and entries[0][1] == "2021-09-21"
    item = R5.parse_detail(read("asl_roma5_detail.html"), "https://www.aslroma5.it/bandi_di_concorso/x/")
    assert item.deadline == date(2026, 11, 2) and item.published == date(2026, 10, 5)
    assert item.title.endswith("assistente amministrativo") and "ASL ROMA 5" not in item.title
    assert skip_reason(item, NOW) == "expired"


# --- Napoli 3 Sud ---------------------------------------------------------------------------------------------------

def test_napoli_tabela_fases_e_graduatorie():
    items = N.parse_rows(read("asl_napoli3sud_list.html"))
    assert len(items) >= 10
    stats = {}
    filtered = N._filter(items, stats)
    assert stats["stage"] >= 3  # «... ELENCO CANDIDATI AMMESSI», «Sospensione...»: ja nao sao bandos abertos
    calls, st = built(filtered, N.SRC)
    titles = [c.job.title for c in calls]
    assert "Concorso pubblico per 6 posti di Dirigente Medico – Patologia Clinica — ASL Napoli 3 Sud" in titles
    grads = [c for c in calls if c.job.title.startswith("Graduatoria")]
    assert len(grads) == 1 and grads[0].job.title == "Graduatoria per Dirigente Medico – Cardiologia — ASL Napoli 3 Sud"
    g = grads[0].job
    assert g.expires_at is None and g.published_at.startswith("2026-06-08") and g.location_district == "Campania"
    assert "Offerte Sanità non pubblica nomi né punteggi" in g.description
    assert g.application_url.startswith("https://www.aslnapoli3sud.it/concorsi?")
    assert st.get("non_health", 0) >= 1  # «ELENCO IDONEI OPERATORE TECNICO...»: nao e saude


def test_napoli_estrutura_mudada():
    with pytest.raises(RuntimeError):
        N.parse_rows("<html><table></table></html>")


# --- AORN dei Colli -------------------------------------------------------------------------------------------------

def test_colli_cartoes():
    items = C.parse_cards(read("aorn_colli_list.html"))
    assert len(items) == 5
    conc = next(i for i in items if i.title.startswith("Concorso"))
    assert conc.deadline is not None and "Dirigente Medico" in conc.title  # «Dir. Med.» expandido
    calls, stats = built(items, C.SRC)
    assert calls and all(c.job.location_district == "Campania" for c in calls)
    assert all("tutor" not in c.job.title.lower() for c in calls)  # tutor clinico universitario: fora
    assert stats.get("internal", 0) >= 1


# --- graduatorie: regra do classificador -----------------------------------------------------------------------------

@pytest.mark.parametrize("title,expected", [
    ("GRADUATORIA CONCORSO PUBBLICO DIRIGENTE MEDICO DISCIPLINA CARDIOLOGIA", True),
    ("Graduatoria definitiva Avviso pubblico a tempo determinato Infermiere", True),
    ("Elenco idonei Collaboratore Professionale Sanitario Infermiere", True),
    ("Approvazione graduatoria finale concorso OSS", True),
    ("CONCORSO PUBBLICO PER N. 20 POSTI DI INFERMIERE E POI IL RISULTATO FINALE DELLA GRADUATORIA", False),  # palavra fora dos primeiros 70 car.
    ("AVVISO PER LA FORMAZIONE DELLA GRADUATORIA AZIENDALE DI DISPONIBILITA'", False),
    ("Rettifica graduatorie Avviso interno di interpello", False),
    ("DOMANDA PER L'INSERIMENTO NELLA GRADUATORIA AZIENDALE", False),
    ("Avviso pubblico per titoli e colloquio, a tempo determinato, Infermiere", False),
])
def test_is_graduatoria_act(title, expected):
    assert P.is_graduatoria_act(title) is expected


def test_graduatoria_sem_data_recente_ou_sem_saude_nao_entra():
    src = Source(slug="x", label="x", owner="Azienda Sanitaria Locale X", owner_short="ASL X", region="Lazio", city="Roma", portal="x")
    old = Item(ident="1", title="Graduatoria concorso Infermiere", url="https://e/x.pdf", deadline=None, published=date(2025, 6, 1))
    assert skip_reason(old, NOW) == "grad_old"
    nodate = Item(ident="2", title="Graduatoria concorso Infermiere", url="https://e/x.pdf", deadline=None)
    assert skip_reason(nodate, NOW) == "grad_old"
    nonhealth = Item(ident="3", title="Graduatoria concorso Coadiutore Amministrativo", url="https://e/x.pdf", deadline=None, published=date(2026, 10, 1))
    assert skip_reason(nonhealth, NOW) == "non_health"
    ok = Item(ident="4", title="Graduatoria finale concorso pubblico Infermiere", url="https://e/x.pdf", deadline=None, published=date(2026, 10, 1))
    call = build_call(ok, src, NOW)
    assert call.job.title == "Graduatoria per Infermiere — ASL X" and call.job.expires_at is None
    assert call.job.profession == "Infermieristica" and "finale" not in call.job.title.lower()


def test_classificador_ts_deteta_graduatoria_e_nao_confunde():
    jobs = [
        {"title": "Graduatoria per Dirigente Medico – Cardiologia — ASL Napoli 3 Sud", "description": "x"},
        {"title": "Graduatoria per Infermiere — ASL Roma 3", "description": "x"},
        {"title": "Avviso a tempo determinato per 4 posti di Tecnico di Fisiopatologia Cardiovascolare — ASL Roma 2", "description": "x"},
        {"title": "Concorso pubblico per 6 posti di Dirigente Medico – Patologia Clinica — ASL Napoli 3 Sud", "description": "x"},
    ]
    kinds = classify(jobs)
    if kinds is None:
        pytest.skip("node/typescript indisponivel")
    assert kinds == ["graduatoria", "graduatoria", "tempo_determinato", "concorso"]


# --- infra ---------------------------------------------------------------------------------------------------------

def test_gu_deadline():
    assert gu_deadline("GU n. 88 del 13.11.2026") == date(2026, 12, 13)
    assert gu_deadline("GURI n. 71 del 15/09/2026") == date(2026, 10, 15)
    assert gu_deadline("sem datas") is None


def test_get_retry_5xx_e_403(monkeypatch):
    import httpx

    class FakeClient:
        def __init__(self, codes):
            self.codes = list(codes)
            self.calls = 0

        def get_text(self, url):
            self.calls += 1
            code = self.codes.pop(0)
            if code == 200:
                return "ok"
            req = httpx.Request("GET", url)
            raise httpx.HTTPStatusError("x", request=req, response=httpx.Response(code, request=req))

    monkeypatch.setattr("sources._it_regional.time.sleep", lambda s: None)
    c = FakeClient([503, 502, 200])
    assert get_retry(c, "https://e/") == "ok" and c.calls == 3
    c = FakeClient([403, 200])
    with pytest.raises(httpx.HTTPStatusError):
        get_retry(c, "https://e/")  # 403 (WAF): nao se insiste nem se contorna
    assert c.calls == 1
    c = FakeClient([500, 500, 500])
    with pytest.raises(httpx.HTTPStatusError):
        get_retry(c, "https://e/")
    assert c.calls == 3


def test_chaves_de_dedupe_registadas_para_inpa_e_gu():
    mods = {m.__name__.rsplit(".", 1)[-1] for m in regional.MODULES}
    assert {"asl_roma1", "asl_roma2", "asl_roma3", "asl_roma5", "asl_napoli3sud", "aorn_colli"} <= mods


def test_lote_incompleto_nao_expira(monkeypatch):
    """Erro num detalhe -> last_listings_complete False -> run.py nao pede expireMissing."""
    from sources._it_regional import RegionalScraper

    class Mod:
        _CACHE: dict = {}

        @staticmethod
        def collect_calls(client, stats=None, **kw):
            stats["errors"] = 1
            return []

    class S(RegionalScraper):
        slug = "x"
        name = "x"
        module = Mod

    s = S()
    s.fetch()
    assert s.last_listings_complete is False
