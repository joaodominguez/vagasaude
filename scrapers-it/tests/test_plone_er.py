from datetime import datetime, timezone

from sources import plone_er as R

NOW = datetime(2026, 11, 13, 10, 0, tzinfo=timezone.utc)
ENT = R.ENTITIES[0]  # AUSL Ferrara


def item(**over):
    base = {
        "@id": "https://www.ausl.fe.it/it/azienda/bandi-di-concorso/concorso-infermieri",
        "UID": "abc123",
        "title": "Concorso pubblico per 5 posti di Collaboratore professionale sanitario - Infermiere",
        "description": "Bando per titoli ed esami a tempo indeterminato.",
        "bando_state": ["open"],
        "scadenza_bando": "2026-12-01T23:59:00+01:00",
        "apertura_bando": "2026-11-01T00:00:00+01:00",
        "tipologia_bando_label": "Concorsi",
        "parent": {"title": "Bandi di concorso"},
    }
    base.update(over)
    return base


def detail():
    return {
        "a_chi_si_rivolge": {
            "blocks": {"b1": {"@type": "slate", "value": [{"type": "p", "children": [{"text": "Possono partecipare i candidati in possesso della laurea in infermieristica e iscritti all'albo OPI."}]}]}},
            "blocks_layout": {"items": ["b1"]},
        },
        "come_partecipare": {
            "blocks": {"b2": {"@type": "slate", "value": [{"type": "p", "children": [{"text": "Domanda online entro la scadenza indicata, con SPID."}]}]}},
            "blocks_layout": {"items": ["b2"]},
        },
    }


def test_skip_reasons():
    assert R.skip_reason(item(bando_state=["closed"]), NOW) == "closed"
    assert R.skip_reason(item(scadenza_bando="2026-11-01T00:00:00+01:00"), NOW) == "expired"
    assert R.skip_reason(item(title="Avviso di selezione interna per incarichi di funzione"), NOW) == "not_recruitment"
    assert R.skip_reason(item(), NOW) is None


def test_build_call_open_health_call():
    call = R.build_call(item(), ENT, detail(), NOW)
    assert call is not None
    job = call.job
    assert job.company == "Azienda USL di Ferrara"
    assert job.location_district == "Emilia-Romagna" and job.location_concelho == "Ferrara"
    assert job.profession == "Infermieristica"
    assert job.title.lower().startswith("concorso")
    assert job.expires_at.startswith("2026-12-01")
    assert job.source == "ausl-ferrara" and job.source_id == "ausl-ferrara-abc123"
    assert len(job.description) >= 200 and "OPI" in job.description


def test_key_only_mode_and_registry():
    assert R.build_call(item(), ENT, None, NOW) is not None  # chiavi per il dedupe senza dettaglio
    slugs = {c.slug for c in R.SCRAPER_CLASSES}
    assert slugs == {"ausl-ferrara", "ausl-romagna", "ausl-modena"}
    assert "www.ospfe.it" not in {e.host for e in R.ENTITIES}  # robots Disallow: /*?
