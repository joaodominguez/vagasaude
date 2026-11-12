from datetime import date

import pytest

from sources import _it_pub as P
from jobtype_check import classify


def test_dates_and_numbers():
    assert P.parse_it_date("3 Dicembre 2026") == date(2026, 12, 3)
    assert P.parse_it_date("07 Dicembre 2026  23:59") == date(2026, 12, 7)
    assert P.parse_it_date("scad. 10 dicembre 2026") == date(2026, 12, 10)
    assert P.parse_it_date("") is None
    assert P.posts_from("per n. 15 posti, a tempo pieno") == 15
    assert P.posts_from("copertura di un posto di dirigente") == 1
    assert P.posts_from("copertura di ventidue posti di infermiere") == 22
    assert P.posts_from("quattro posti") == 4
    assert P.posts_from("a trecento posti di magistrato") == 300
    assert P.posts_from("concorsi per dirigente medico") is None


@pytest.mark.parametrize(
    "text,profile,discipline",
    [
        ("Concorso pubblico, per titoli ed esami, per la copertura di un posto di dirigente medico, disciplina di chirurgia generale, a tempo pieno ed indeterminato, per il DIPS.",
         "Dirigente Medico", "Chirurgia Generale"),
        ("Concorso pubblico, per titoli ed esami, per n. 9 posti, a tempo pieno, indeterminato ed a rapporto esclusivo, di Dirigente Medico – disciplina Cure Palliative.",
         "Dirigente Medico", "Cure Palliative"),
        ("Concorso pubblico, per titoli ed esami, per la copertura di ventidue posti di infermiere, area dei professionisti della salute e dei funzionari.",
         "Infermiere", None),
        ("Concorso, per titoli ed esami, per 8 posti di Collaboratore Professionale Sanitario – Infermiere, a tempo indeterminato",
         "Collaboratore Professionale Sanitario – Infermiere", None),
        ("QUALIFICA PROFESSIONALE DI INFERMIERE O DI OPERATORE SOCIO SANITARIO CONSEGUITA ALL'ESTERO REGOLATA DA SPECIFICHE DIRETTIVE",
         "Infermiere o Operatore Socio Sanitario", None),
        ("Concorso pubblico per la copertura di un posto di dirigente medico, varie discipline ed aree, a tempo indeterminato", "Dirigente Medico", None),
    ],
)
def test_profile_and_discipline(text, profile, discipline):
    assert P.extract_profile(text) == profile
    assert P.extract_discipline(text) == discipline


def test_direttore_uoc_profile():
    text = "Conferimento dell'incarico quinquennale di direttore dell'unita' operativa complessa Servizio igiene e sanita' pubblica del Dipartimento di prevenzione, disciplina di igiene"
    assert P.extract_profile(text).startswith("Direttore UOC Servizio igiene")


def test_health_filters():
    assert P.is_health_ente("AZIENDA UNITA' SANITARIA LOCALE DI RIETI")
    assert P.is_health_ente("A.O. Universitaria Integrata Verona")
    assert P.is_health_ente("ESTAR")
    assert P.is_health_ente("Azienda ULSS n. 6 Euganea")
    assert P.is_health_ente("FONDAZIONE IRCCS SAN GERARDO DEI TINTORI DI MONZA")
    assert not P.is_health_ente("COMUNE DI VARMO")
    assert not P.is_health_ente("UNIVERSITA' DI PISA")
    assert not P.is_health_ente("MINISTERO DELLA GIUSTIZIA")
    assert P.is_academic_ente("UNIVERSITA' DI PISA")
    assert not P.is_academic_ente("AZIENDA OSPEDALIERO-UNIVERSITARIA SANT'ANDREA DI ROMA")
    assert P.is_health_profile("posto di infermiere")
    assert P.is_health_profile("Dirigente Veterinario")
    assert not P.is_health_profile("posto di assistente sociale")
    assert P.is_not_open_call("Diario delle prove d'esame del concorso pubblico")
    assert P.is_not_open_call("Approvazione atti della procedura di selezione")
    assert not P.is_not_open_call("Concorso pubblico per un posto di infermiere")
    assert P.is_not_job("Avviso per l'individuazione di componenti dell'Organismo indipendente di valutazione")


def test_ente_short_and_names():
    assert P.short_ente("AZIENDA SOCIO SANITARIA TERRITORIALE DI CREMONA") == "ASST Cremona"
    assert P.short_ente("Azienda ULSS n. 6 Euganea") == "ULSS 6 Euganea"
    assert P.short_ente("AZIENDA UNITA' LOCALE SOCIO-SANITARIA N. 7 PEDEMONTANA") == "ULSS 7 Pedemontana"
    assert P.nice_ente("AZIENDA UNITA' SANITARIA LOCALE DI RIETI") == "Azienda Unità Sanitaria Locale di Rieti"


def test_ente_key_matching():
    k = P.ente_key
    assert P.ente_match(k("Azienda ULSS n. 6 Euganea"), k("AZIENDA UNITA' LOCALE SOCIO-SANITARIA N. 6 EUGANEA - PADOVA"))
    assert P.ente_match(k("ASST di Cremona"), k("AZIENDA SOCIO SANITARIA TERRITORIALE DI CREMONA"))
    assert P.ente_match(k("ASL Rieti"), k("AZIENDA SANITARIA LOCALE DI RIETI"))
    assert P.ente_match(k("AOU Sant'Andrea"), k("AZIENDA OSPEDALIERO-UNIVERSITARIA SANT'ANDREA DI ROMA"))
    assert not P.ente_match(k("ASL Rieti"), k("ASL Viterbo"))
    assert not P.ente_match(k("Azienda ULSS n. 6 Euganea"), k("Azienda ULSS n. 7 Pedemontana"))
    assert not P.ente_match(k("ASST di Cremona"), k("ASST di Mantova"))


def _key(ente, profile, disc, posts, deadline, ente_posts=None):
    return P.make_key(ente if isinstance(ente, list) else [ente], profile, disc, posts, deadline, ente_posts)


def test_keys_match_same_call_across_sources():
    d = date(2026, 12, 10)
    gu = _key("AZIENDA SANITARIA LOCALE DI RIETI", "Dirigente Medico", "Chirurgia Generale", [1], d)
    inpa = _key("ASL Rieti", "Dirigente Medico", "Chirurgia generale", [1], d)
    assert P.keys_match(gu, inpa)
    # stessa scadenza, posti non dichiarati da un lato
    assert P.keys_match(gu, _key("ASL Rieti", "Dirigente Medico", "Chirurgia Generale", [None], d))
    # stessi posti, scadenza diversa: sempre lo stesso bando (la scadenza puo' essere ricalcolata)
    assert P.keys_match(gu, _key("ASL Rieti", "Dirigente Medico", "Chirurgia Generale", [1], date(2026, 12, 20)))


def test_keys_do_not_match_different_calls():
    d = date(2026, 12, 10)
    base = _key("ASL Rieti", "Dirigente Medico", "Chirurgia Generale", [1], d)
    assert not P.keys_match(base, _key("ASL Rieti", "Dirigente Medico", "Cardiologia", [1], d))
    assert not P.keys_match(base, _key("ASL Viterbo", "Dirigente Medico", "Chirurgia Generale", [1], d))
    assert not P.keys_match(base, _key("ASL Rieti", "Infermiere", None, [1], d))
    # posti e scadenza diversi
    assert not P.keys_match(base, _key("ASL Rieti", "Dirigente Medico", "Chirurgia Generale", [3], date(2027, 1, 10)))
    # senza disciplina da un lato servono posti E scadenza
    assert not P.keys_match(base, _key("ASL Rieti", "Dirigente Medico", None, [3], d))
    assert P.keys_match(base, _key("ASL Rieti", "Dirigente Medico", None, [1], d))


def test_aggregate_call_matches_single_ente_item():
    veneto = _key(
        ["Azienda Zero", "Azienda ULSS 6 Euganea", "Azienda ULSS 7 Pedemontana"], "Dirigente Medico", "Neurologia", [15], date(2026, 12, 3), [None, 1, 3]
    )
    gu = _key("AZIENDA ULSS N. 7 PEDEMONTANA", "Dirigente Medico", "Neurologia", [3], date(2026, 12, 10))
    assert P.keys_match(veneto, gu)  # 3 posti = quelli di ULSS 7 nel bando aggregato
    other = _key("AZIENDA ULSS N. 5 POLESANA", "Dirigente Medico", "Neurologia", [3], date(2026, 12, 10))
    assert not P.keys_match(veneto, other)


def test_drop_duplicates_prefers_higher_priority():
    d = date(2026, 12, 10)

    class J:  # JobPayload minimo
        pass

    low = [P.Call(J(), _key("ASL Rieti", "Dirigente Medico", "Chirurgia Generale", [1], d)),
           P.Call(J(), _key("ASL Viterbo", "Infermiere", None, [22], d))]
    higher = [_key("AUSL Rieti", "Dirigente Medico", "Chirurgia generale", [1], d)]
    kept, dropped = P.drop_duplicates(low, higher)
    assert len(kept) == 1 and len(dropped) == 1
    assert kept[0] is low[1]


def test_title_maps_to_each_job_type_in_the_app():
    cases = [
        (P.build_title(P.KIND_CONCORSO, "Dirigente Medico", "Cardiologia", "ULSS 6 Euganea", 3), "concorso"),
        (P.build_title(P.KIND_TEMPO_DET, "Infermiere", None, "AOU Verona", None), "tempo_determinato"),
        (P.build_title(P.KIND_MOBILITA, "Tecnico di Radiologia", None, "ASL Roma 2", None), "mobilita"),
        (P.build_title(P.KIND_INCARICO, "Medici", None, "Azienda Zero Veneto", None), "incarico"),
        (P.build_title(P.KIND_SELEZIONE, "Direttore UOC Oculistica", None, "ESTAR", None), "concorso"),
    ]
    assert cases[0][0] == "Concorso pubblico per 3 posti di Dirigente Medico – Cardiologia — ULSS 6 Euganea"
    result = classify([{"title": t} for t, _ in cases])
    if result is None:
        pytest.skip("node/typescript non disponibili: impossibile eseguire job-type.ts")
    assert result == [expected for _, expected in cases]


def test_kinds_classification():
    assert P.classify_kind("Concorso pubblico, per titoli ed esami") == P.KIND_CONCORSO
    assert P.classify_kind("Avviso pubblico per mobilità volontaria") == P.KIND_MOBILITA
    assert P.classify_kind("Avviso pubblico a tempo determinato per infermieri") == P.KIND_TEMPO_DET
    assert P.classify_kind("Avviso per incarichi libero-professionali") == P.KIND_INCARICO
    assert P.classify_kind("Conferimento incarico di direzione") == P.KIND_SELEZIONE
