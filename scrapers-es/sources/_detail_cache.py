"""Caché de detalles de ofertas (descripción, fecha) entre ejecuciones.

Los listados de DomusVi / SuccessFactors no traen descripción: hay que abrir cada
oferta. Para no repetir siempre las mismas peticiones (y dejar sin descripción
las que quedan fuera del tope por ejecución), los detalles ya descargados se
reutilizan y el tope solo cuenta las ofertas nuevas.

Ruta: $ES_DETAIL_CACHE_DIR/<nombre>_details.json (en el servidor, la carpeta de
datos, que sobrevive a los despliegues de los scrapers); por defecto
scrapers-es/.cache/. Solo se guardan las ofertas vistas en la última ejecución.
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path


def _cache_dir() -> Path:
    env = os.environ.get("ES_DETAIL_CACHE_DIR")
    if env:
        return Path(env)
    return Path(__file__).resolve().parent.parent / ".cache"


class DetailCache:
    def __init__(self, name: str):
        self.path = _cache_dir() / f"{name}_details.json"
        self.data: dict[str, dict] = {}
        self.seen: set[str] = set()
        try:
            loaded = json.loads(self.path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                self.data = loaded
        except (OSError, ValueError):
            self.data = {}

    def get(self, key: str) -> dict | None:
        self.seen.add(key)
        value = self.data.get(key)
        return value if isinstance(value, dict) else None

    def set(self, key: str, value: dict) -> None:
        self.seen.add(key)
        self.data[key] = value

    def save(self, prune: bool = True) -> None:
        """Escritura atómica. Con prune, descarta ofertas que ya no aparecen
        (solo si el listado se leyó completo; si no, conserva todo)."""
        data = {k: v for k, v in self.data.items() if k in self.seen} if prune else self.data
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=self.path.parent, prefix=self.path.name, suffix=".tmp")
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(data, fh, ensure_ascii=False)
            os.chmod(tmp, 0o664)
            os.replace(tmp, self.path)
        except OSError:
            pass
