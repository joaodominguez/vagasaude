from datetime import date, datetime, timezone
from pathlib import Path

from sources import _it_pub as P
from sources import ares_sardegna as A
from sources import arcs_fvg as C
from sources import estar_toscana as E
from sources._it_regional import build_call, skip_reason

FIX = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 11, 20, 12, 0, tzinfo=timezone.utc)


def read(name):
    return (FIX / name).read_text(encoding="utf-8")


def test_ares_list_and_detail():
    items = A.parse_list(read("ares_list.html"))
    assert len(items) == 2
    it = items[1]
    assert it.deadline == date(2026, 12, 16) and it.published == date(2026, 11, 16)
    assert it.entes == ["ASL Sassari"] and it.city == "Sassari"
    assert not it.title.endswith("03102")  # codice di protocollo tolto
    body, docs = A.parse_detail(read("ares_detail.html"))
    assert "Endocrinologia" in body
    it.body, it.docs = body, docs
    call = build_call(it, A.SRC, NOW)
    job = call.job
    assert job.source == "ares-sardegna" and job.location_district == "Sardegna"
    assert job.profession == "Medicina" and job.title.startswith("Mobilità per Dirigente Medico")
    assert job.expires_at.startswith("2026-12-16")
    assert job.sector == "pubblico"


def test_ares_clean_title_direttore_sc():
    t = A.clean_title("Pubblica selezione di Direttore di Struttura Complessa, per la Direzione della S.C.Neurologia del P.O. Sirai della Asl n. 7 del Sulcis Iglesiente 267", ["Asl Sulcis"])
    assert t == "Selezione pubblica per Direttore UOC Neurologia"


def test_estar_list():
    items = E.parse_list(read("estar_list.html"), "concorso")
    assert len(items) == 5
    by = {i.ident: i for i in items}
    assert by["107-2026-con"].deadline == date(2026, 12, 3)
    assert by["107-2026-con"].published == date(2026, 11, 3)
    assert by["107-2026-con"].extra and by["107-2026-con"].extra[0].startswith("Codice ESTAR: 107/2026/CON")
    careggi = by["104-2026-st"]
    assert careggi.entes == ["Azienda Ospedaliero-Universitaria Careggi"] and careggi.city == "Firenze"
    # stabilizzazioni = solo personale precario interno: scartate
    assert skip_reason(careggi, NOW) == "not_recruitment"
    call = build_call(by["107-2026-con"], E.SRC, NOW, with_detail=False)
    assert call and call.job.location_district == "Toscana" and call.job.profession == "Medicina"
    assert "Scadenza ore" not in call.job.title


def test_arcs_list():
    items = C.parse_list(read("arcs_list.html"))
    assert len(items) == 4
    assert items[0].deadline == date(2027, 6, 30) and items[0].published == date(2026, 10, 28)
    calls = [build_call(i, C.SRC, NOW, with_detail=False) for i in items]
    assert [bool(c) for c in calls] == [True, True, True, False]  # 4.a = comitato etico (non sanitaria/lavoro)
    assert calls[1].job.title.startswith("Mobilità per 1 posto di Infermiere")
    assert calls[0].job.location_district == "Friuli-Venezia Giulia"


def test_dedupe_key_matches_inpa_style_key_for_same_call():
    items = A.parse_list(read("ares_list.html"))
    a = build_call(items[1], A.SRC, NOW, with_detail=False).key
    other = P.make_key(["ASL Sassari"], "Dirigente Medico", "Endocrinologia", [1], date(2026, 12, 16))
    assert P.keys_match(a, other)
