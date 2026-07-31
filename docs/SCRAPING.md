# Scraping & Ingestão de Dados — VagaSaude.pt

Documento de apoio ao [`PLANO.md`](./PLANO.md). Descreve a estratégia de
scraping, arquitetura dos scrapers, normalização, deduplicação e boas práticas
legais.

---

## 1. Princípios

1. **Legalidade primeiro.** Respeitar `robots.txt` e os Termos de Serviço de
   cada fonte. Preferir sempre feeds/APIs oficiais (RSS, JSON, endpoints de
   emprego) quando existirem.
2. **Reencaminhar, não substituir.** O VagaSaude guarda a `application_url`
   original e envia o candidato para a fonte. Não intercetamos candidaturas.
3. **Ser bom cidadão.** Rate limiting, user-agent identificável
   (`VagaSaudeBot/1.0 (+https://vagasaude.pt/bot)`), horários de menor carga.
4. **Parcerias.** Onde possível, contactar as fontes para acesso a feed oficial.

---

## 2. Arquitetura dos scrapers

```
scrapers/
├── run.py                 # orquestrador (--schedule ou --once --source bep)
├── common/
│   ├── http.py            # cliente HTTP/Playwright, rate limit, retries
│   ├── normalize.py       # normalização de campos + dedupe_hash
│   ├── api_client.py      # POST /api/ingest (autenticado) para a app Next.js
│   └── models.py          # dataclass JobPayload
├── sources/
│   ├── base.py            # BaseScraper (interface comum)
│   ├── bep.py
│   ├── cuf.py
│   ├── luz_saude.py
│   ├── lusiadas.py
│   ├── net_empregos.py
│   └── indeed.py
├── requirements.txt
└── Dockerfile
```

### Interface comum (`base.py`)

```python
from dataclasses import dataclass
from typing import Iterator

@dataclass
class JobPayload:
    title: str
    company: str
    location_district: str
    location_concelho: str | None
    profession: str
    specialty: str | None
    sector: str            # publico | privado | ipss
    contract_type: str | None
    description: str
    requirements: str | None
    salary: str | None
    application_url: str
    source: str
    source_id: str
    published_at: str | None
    expires_at: str | None

class BaseScraper:
    slug: str
    def fetch(self) -> Iterator[JobPayload]:
        raise NotImplementedError
```

Cada fonte implementa `fetch()`. O orquestrador percorre as fontes ativas,
recolhe os `JobPayload`, normaliza, calcula `dedupe_hash` e envia para a app
via `POST /api/ingest` (ou escreve diretamente na BD).

---

## 3. Normalização + dedup

```python
# common/normalize.py
import hashlib, re, unicodedata

def norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode()   # remove acentos
    text = re.sub(r"[^a-zA-Z0-9\s]", "", text).lower()
    return re.sub(r"\s+", " ", text).strip()

def dedupe_hash(title: str, company: str, district: str) -> str:
    key = f"{norm(title)}|{norm(company)}|{norm(district)}"
    return hashlib.sha256(key.encode()).hexdigest()
```

Regras de deduplicação em [`MODELO-DADOS.md`](./MODELO-DADOS.md) (exata por
fonte, cruzada por hash, aproximada por `pg_trgm`).

---

## 4. Ingestão via API interna

Endpoint autenticado `POST /api/ingest` (Bearer `SCRAPER_API_TOKEN`) recebe um
lote de vagas e faz `upsert`:

```jsonc
// corpo do pedido
{
  "source": "bep",
  "jobs": [
    {
      "title": "Enfermeiro(a) — Serviço de Urgência",
      "company": "Centro Hospitalar Universitário de São João",
      "location_district": "Porto",
      "sector": "publico",
      "application_url": "https://www.bep.gov.pt/...",
      "source_id": "bep-123456",
      "published_at": "2026-07-30T00:00:00Z"
      // ...restantes campos
    }
  ]
}
```

A app calcula/valida, faz `upsert` por `(source, source_id)`, verifica
`dedupe_hash`, e marca `is_active`. Vantagem de usar a API (em vez de escrever
direto na BD): validação, tipos e uma única fonte de verdade.

---

## 5. Agendamento

- **Opção A (interno):** `run.py --schedule` usa `APScheduler` para correr cada
  fonte num intervalo (ex.: BEP de 6h em 6h; portais privados 1x/dia).
- **Opção B (cron do host):** entradas cron chamam
  `docker compose run --rm scraper python run.py --once --source bep`.

Após cada execução, atualizar `sources.last_run_at`, `last_status`, `last_error`
para monitorização.

---

## 6. Resiliência

- **Retries** com backoff exponencial em erros de rede.
- **Timeouts** por página.
- **Deteção de mudança de layout:** se uma fonte devolver 0 vagas quando
  costumava devolver muitas, marcar `last_status = error` e alertar.
- **Playwright** só quando necessário (páginas com JS); preferir HTTP simples
  + parsing quando a fonte é estática (mais rápido e leve).

---

## 7. Expiração e limpeza

- Vagas não vistas em N execuções consecutivas de uma fonte podem ser marcadas
  `is_active = false` (provavelmente removidas na fonte).
- Vagas com `expires_at` no passado → `is_active = false` (ver SQL em
  [`MODELO-DADOS.md`](./MODELO-DADOS.md)).
