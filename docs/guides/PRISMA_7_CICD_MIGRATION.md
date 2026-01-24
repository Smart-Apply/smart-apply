# CI/CD Migration für Prisma 7.3.0

## ✅ Durchgeführte Änderungen

### 1. Dockerfile Updates (infra/Dockerfile)

**Node.js Version:**

- ❌ Alt: `node:20-alpine`
- ✅ Neu: `node:24-alpine` (alle 3 Stages)
- **Grund:** Prisma 7.3.0 erfordert Node.js >= 20.19 (wir nutzen 24.13.0 LTS)

**Prisma Configuration:**

- ✅ `prisma.config.ts` wird jetzt in allen Stages kopiert
- ✅ Kopiert BEFORE `npm install` (erforderlich für Prisma 7 Generierung)

**Prisma Client Location:**

- ❌ Alt: `node_modules/.prisma/client`
- ✅ Neu: `apps/api/src/generated/prisma`
- **Änderung im Dockerfile:**

  ```dockerfile
  # Alt:
  COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

  # Neu:
  COPY --from=builder /app/apps/api/src/generated ./apps/api/src/generated
  ```

**Runtime Files:**

- ✅ `prisma.config.ts` wird nach Production kopiert
- ✅ Schema bleibt für Migrations erhalten

### 2. GitHub Actions (deploy-vm.yml)

**Status:** ✅ Keine Änderungen erforderlich

- Docker Build nutzt automatisch das aktualisierte Dockerfile
- Node.js Version ist im Container, nicht im Runner
- Cache bleibt funktional

### 3. Environment Variables

**Erforderlich in Production:**

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
```

**Optional (für Connection Pooling):**

```bash
# Wird automatisch aus DATABASE_URL gelesen
# Kann in prisma.config.ts angepasst werden
```

## 🔍 Wichtige Hinweise

### Prisma Generate während Docker Build

Die Generierung erfolgt automatisch via `postinstall` Hook:

```json
{
  "scripts": {
    "postinstall": "npx prisma generate --schema=./prisma/schema.prisma || true"
  }
}
```

**Wichtig:**

- `prisma.config.ts` MUSS vorhanden sein
- `schema.prisma` darf KEINE `url` im datasource haben
- Output-Pfad muss in `schema.prisma` definiert sein:

  ```prisma
  generator client {
    provider = "prisma-client"
    output   = "../src/generated/prisma"
  }
  ```

### Seed Scripts in Production

Seed Scripts werden kompiliert und kopiert:

```dockerfile
COPY --from=builder /app/apps/api/prisma/dist ./apps/api/prisma/dist
```

**Import-Pfade in Seeds müssen angepasst sein:**

```typescript
// Alt:
import { PrismaClient } from '@prisma/client';

// Neu:
import { PrismaClient } from '../src/generated/prisma/client';
```

## 🧪 Testing der Pipeline

### Lokal testen (vor Push)

```bash
# 1. Docker Build testen
cd /Users/arian/VS-Projects/smart-apply
docker build -f infra/Dockerfile -t smartapply-api:test .

# 2. Container starten (mit DB)
docker-compose up -d db
docker run --rm \
  --network smart-apply_default \
  -e DATABASE_URL="postgresql://postgres:postgres@db:5432/smartapply" \
  -p 3000:3000 \
  smartapply-api:test

# 3. Migrations testen
docker exec -it <container-id> npx prisma migrate deploy

# 4. Seed testen
docker exec -it <container-id> npm run prisma:seed
```

### Nach Deployment prüfen

```bash
# SSH auf VM
ssh azureuser@smartapplymvp.swedencentral.cloudapp.azure.com

# Logs prüfen
cd /home/azureuser/smart-apply
docker-compose logs api

# Prisma Client prüfen
docker exec smart-apply-api-1 ls -la /app/apps/api/src/generated/prisma
```

## 📋 Deployment Checklist

- [x] Dockerfile auf Node 24 aktualisiert
- [x] prisma.config.ts wird kopiert
- [x] Generierte Client Location angepasst
- [x] Seed Script Imports aktualisiert
- [ ] **TODO:** Ersten Deploy testen
- [ ] **TODO:** Migrations auf Production ausführen
- [ ] **TODO:** Seeds auf Production ausführen

## 🚨 Breaking Changes für Production

**Beim ersten Deploy nach Prisma 7 Update:**

1. **Container wird neu gebaut** (größerer Download wegen Node 24)
2. **Prisma Client wird an neuer Location generiert**
3. **Kein Downtime bei korrekter Konfiguration**
4. **DATABASE_URL muss verfügbar sein**

**Rollback-Plan (falls Probleme):**

```bash
# Auf letztes funktionierendes Image zurück
docker-compose pull api:previous-tag
docker-compose up -d api
```

## 📊 Performance Impact

**Build Time:**

- Erwartete Änderung: +5-10% (Node 24 größeres Base Image)
- Kompensiert durch: Besseres Layer Caching

**Runtime:**

- 🚀 **Query Performance: +3x schneller** (Prisma 7)
- 📦 **Bundle Size: -90%** (neue Client Architektur)
- 💾 **Memory: ähnlich** (Connection Pooling optimiert)

## 🔗 Weitere Informationen

- [Prisma 7 Migration Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-to-prisma-7)
- [Prisma Config File](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/prisma-config-file)
- [Driver Adapters](https://www.prisma.io/docs/orm/overview/databases/database-drivers)
