from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class JobPayload:
    title: str
    company: str
    location_district: str
    location_concelho: str | None
    profession: str
    specialty: str | None
    sector: str  # publico | privado | ipss
    contract_type: str | None
    description: str
    requirements: str | None
    salary: str | None
    application_url: str
    source: str
    source_id: str
    published_at: str | None
    expires_at: str | None = None
    status: str = "published"
    review_reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class BaseScraper:
    slug: str
    name: str

    def fetch(self) -> list[JobPayload]:
        raise NotImplementedError
