# Modelo de Dados — VagaSaude.pt

Documento de apoio ao [`PLANO.md`](./PLANO.md). Inclui schema Prisma, SQL
equivalente, índices e queries de exemplo.

---

## 1. Schema Prisma (proposta)

`packages/database/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Sector {
  publico
  privado
  ipss
}

model Job {
  id                String    @id @default(uuid()) @db.Uuid
  title             String
  company           String
  locationDistrict  String    @map("location_district")
  locationConcelho  String?   @map("location_concelho")
  profession        String
  specialty         String?
  sector            Sector
  contractType      String?   @map("contract_type")
  description       String
  requirements      String?
  salary            String?
  applicationUrl    String    @map("application_url")
  source            String
  sourceId          String    @map("source_id")
  dedupeHash        String    @map("dedupe_hash")
  publishedAt       DateTime? @map("published_at")
  expiresAt         DateTime? @map("expires_at")
  isActive          Boolean   @default(true) @map("is_active")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  @@unique([source, sourceId])
  @@index([dedupeHash])
  @@index([isActive, locationDistrict, profession, sector])
  @@index([publishedAt])
  @@map("jobs")
}

model Profession {
  id        Int      @id @default(autoincrement())
  slug      String   @unique
  name      String
  createdAt DateTime @default(now()) @map("created_at")

  @@map("professions")
}

model District {
  id        Int        @id @default(autoincrement())
  slug      String     @unique
  name      String
  concelhos Concelho[]

  @@map("districts")
}

model Concelho {
  id         Int      @id @default(autoincrement())
  slug       String   @unique
  name       String
  district   District @relation(fields: [districtId], references: [id])
  districtId Int      @map("district_id")

  @@map("concelhos")
}

model User {
  id           String     @id @default(uuid()) @db.Uuid
  email        String     @unique
  isConfirmed  Boolean    @default(false) @map("is_confirmed")
  createdAt    DateTime   @default(now()) @map("created_at")
  alerts       JobAlert[]

  @@map("users")
}

model JobAlert {
  id           String    @id @default(uuid()) @db.Uuid
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId       String    @map("user_id") @db.Uuid
  profession   String?
  district     String?
  sector       Sector?
  contractType String?   @map("contract_type")
  keyword      String?
  frequency    String    @default("daily") // daily | instant
  isActive     Boolean   @default(true) @map("is_active")
  lastSentAt   DateTime? @map("last_sent_at")
  createdAt    DateTime  @default(now()) @map("created_at")

  @@index([isActive])
  @@map("job_alerts")
}

model Source {
  id          Int       @id @default(autoincrement())
  slug        String    @unique
  name        String
  baseUrl     String    @map("base_url")
  isActive    Boolean   @default(true) @map("is_active")
  lastRunAt   DateTime? @map("last_run_at")
  lastStatus  String?   @map("last_status") // ok | error
  lastError   String?   @map("last_error")

  @@map("sources")
}

model AlertDelivery {
  id        String   @id @default(uuid()) @db.Uuid
  alertId   String   @map("alert_id") @db.Uuid
  jobId     String   @map("job_id") @db.Uuid
  sentAt    DateTime @default(now()) @map("sent_at")

  @@unique([alertId, jobId])
  @@map("alert_deliveries")
}
```

---

## 2. Extensões e índices SQL úteis

```sql
-- Pesquisa aproximada e dedup por similaridade
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice trigram para pesquisa de texto no título/empresa
CREATE INDEX jobs_title_trgm ON jobs USING gin (title gin_trgm_ops);
CREATE INDEX jobs_company_trgm ON jobs USING gin (company gin_trgm_ops);
```

---

## 3. Deduplicação

`dedupe_hash` é gerado no ingest do scraper:

```
dedupe_hash = sha256( normalizar(title) + "|" + normalizar(company) + "|" + normalizar(location_district) )
```

Onde `normalizar()`: minúsculas, remoção de acentos, colapso de espaços,
remoção de pontuação. Estratégia:

1. **Exata por fonte:** `@@unique([source, sourceId])` evita reingerir a mesma
   vaga da mesma fonte.
2. **Cruzada entre fontes:** antes de inserir, procurar `dedupe_hash` igual;
   se existir, não duplicar (ou juntar `application_url`s).
3. **Aproximada:** para casos de títulos ligeiramente diferentes, usar
   `similarity()` do `pg_trgm` acima de um limiar (ex.: 0.6).

---

## 4. Queries de exemplo

### Listagem com filtros (paginada)

```sql
SELECT id, title, company, location_district, profession, sector,
       contract_type, published_at
FROM jobs
WHERE is_active = true
  AND (COALESCE($1, location_district) = location_district)   -- distrito
  AND (COALESCE($2, profession) = profession)                 -- profissão
  AND (COALESCE($3, sector) = sector)                         -- setor
  AND ($4::text IS NULL OR title ILIKE '%' || $4 || '%')      -- keyword
ORDER BY published_at DESC NULLS LAST
LIMIT $5 OFFSET $6;
```

Equivalente Prisma:

```ts
const jobs = await prisma.job.findMany({
  where: {
    isActive: true,
    ...(district && { locationDistrict: district }),
    ...(profession && { profession }),
    ...(sector && { sector }),
    ...(keyword && { title: { contains: keyword, mode: "insensitive" } }),
  },
  orderBy: { publishedAt: "desc" },
  take: pageSize,
  skip: (page - 1) * pageSize,
});
```

### Contagem por distrito (para facetas/filtros)

```sql
SELECT location_district, COUNT(*) AS total
FROM jobs
WHERE is_active = true
GROUP BY location_district
ORDER BY total DESC;
```

### Vagas novas para um alerta (para o job de emails)

```sql
SELECT j.*
FROM jobs j
JOIN job_alerts a ON a.id = $1
LEFT JOIN alert_deliveries d ON d.alert_id = a.id AND d.job_id = j.id
WHERE j.is_active = true
  AND d.id IS NULL                                   -- ainda não enviada
  AND j.created_at > COALESCE(a.last_sent_at, 'epoch')
  AND (a.district   IS NULL OR a.district   = j.location_district)
  AND (a.profession IS NULL OR a.profession = j.profession)
  AND (a.sector     IS NULL OR a.sector     = j.sector)
ORDER BY j.published_at DESC;
```

### Marcar vagas expiradas

```sql
UPDATE jobs
SET is_active = false, updated_at = now()
WHERE is_active = true
  AND expires_at IS NOT NULL
  AND expires_at < now();
```

---

## 5. Seed inicial

- **Distritos + concelhos** de Portugal continental + ilhas.
- **Profissões** normalizadas: Enfermagem, Medicina, Fisioterapia, TDT,
  Auxiliar de Ação Médica, Farmácia, Psicologia, Nutrição, etc.
- **Fontes** (`sources`): BEP, CUF, Luz Saúde, Lusíadas, Trofa Saúde,
  José de Mello, Net-Empregos, Indeed.
