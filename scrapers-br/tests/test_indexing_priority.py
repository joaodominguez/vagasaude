"""Fila da Indexing API BR: prioridade das vagas novas e regra das 72 h."""
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
    base = dict(clinical=True, siblings=1, sourceCount=50, expiresAt=None,
                firstSeenAt=iso(-0.2), publishedAt=iso(-0.2))
    base.update(kw)
    return base


def test_clinical_unique_new_long_lived_comes_first():
    best = job(expiresAt=iso(20))
    worse = [
        job(clinical=False),                      # administrativa
        job(siblings=40, sourceCount=900),        # 40 gémeas, fonte grande
        job(expiresAt=iso(4)),                    # vida curta
        job(firstSeenAt=iso(-30), publishedAt=iso(-30)),  # antiga
    ]
    for item in worse:
        assert ix.priority(best, NOW) > ix.priority(item, NOW)


def test_no_deadline_assumes_thirty_days():
    assert ix.priority(job(expiresAt=None), NOW) == ix.priority(job(expiresAt=iso(30)), NOW)


def test_under_72h_is_not_eligible():
    assert not ix.eligible(job(expiresAt=iso(2.9)), NOW)
    assert not ix.eligible(job(expiresAt=iso(-3)), NOW)   # prazo já passado
    assert ix.eligible(job(expiresAt=iso(3.1)), NOW)
    assert ix.eligible(job(expiresAt=None), NOW)


def test_meta_url_next_to_sitemap():
    assert ix.meta_url_for("http://127.0.0.1:3011/sitemap/jobs.xml") == "http://127.0.0.1:3011/sitemap/jobs-meta.json"
