"""Fila da Indexing API IT: prioridade das vagas novas e regra das 72 h."""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

import indexing_notify as ix  # noqa: E402

NOW = datetime(2026, 11, 20, 12, 0, tzinfo=timezone.utc)


def iso(delta_days: float) -> str:
    return (NOW + timedelta(days=delta_days)).isoformat()


def job(**kw):
    base = dict(clinical=True, agency=False, sector="Pubblico", source="ausl-modena", siblings=1, sourceCount=50,
                expiresAt=None, firstSeenAt=iso(-0.2), publishedAt=iso(-0.2))
    base.update(kw)
    return base


def test_public_direct_unique_comes_before_aggregators_and_private():
    direct = job(expiresAt=iso(20))
    for other in (job(source="inpa", sourceCount=300, expiresAt=iso(20)),
                  job(sector="Privato", source="humanitas", expiresAt=None),
                  job(clinical=False, expiresAt=iso(20), siblings=30)):
        assert ix.priority(direct, NOW) > ix.priority(other, NOW)


def test_agency_goes_last_among_comparable():
    randstad = job(sector="Privato", source="randstad", agency=True, siblings=1, sourceCount=290)
    private = job(sector="Privato", source="humanitas", sourceCount=90)
    assert ix.priority(private, NOW) > ix.priority(randstad, NOW)


def test_longer_lifetime_and_recency_win():
    assert ix.priority(job(expiresAt=iso(25)), NOW) > ix.priority(job(expiresAt=iso(5)), NOW)
    assert ix.priority(job(), NOW) > ix.priority(job(firstSeenAt=iso(-30), publishedAt=iso(-30)), NOW)


def test_under_72h_is_not_eligible():
    assert not ix.eligible(job(expiresAt=iso(2.9)), NOW)
    assert not ix.eligible(job(expiresAt=iso(-3)), NOW)
    assert ix.eligible(job(expiresAt=iso(3.1)), NOW)
    assert ix.eligible(job(expiresAt=None), NOW)


def test_meta_url_next_to_sitemap():
    assert ix.meta_url_for("http://127.0.0.1:3014/sitemap/jobs.xml") == "http://127.0.0.1:3014/sitemap/jobs-meta.json"
