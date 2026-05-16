# Docker Image Optimization Guide

> **⚠️ Status (May 2026): Historical — superseded by Fly.io + Cloudflare Workers + pnpm.**
>
> This document was written when both API and Web were containerised and
> deployed via `docker-compose` on an Azure VM, and when the repo used npm
> Workspaces. The current production setup deploys:
>
> - **API** → Fly.io. See [`infra/Dockerfile`](../../infra/Dockerfile) for
>   the current multi-stage build using **pnpm 9 + `pnpm deploy --prod`**.
>   Image size is now ~750 MB (Chromium dominates).
> - **Web** → Cloudflare Workers via `@opennextjs/cloudflare` (no Docker
>   image at all).
>
> Replace any `npm ci --workspace=… --legacy-peer-deps` snippets below with
> `pnpm install --frozen-lockfile --filter @smart-apply/api...` when reading
> for context. The npm commands are kept as-is for the historical narrative
> only.
>
> Keep this doc only as reference for the multi-stage / cache-mount
> patterns we still use in `infra/Dockerfile`.

## Problem

Die aktuellen Container-Images sind zu groß und verursachen lange Deploy-Zeiten:

- **API Image**: 3.51 GB
- **Web Image**: 238 MB

## Lösung

Optimierte Dockerfiles mit DevOps Best Practices für drastische Größenreduktion:

- **API Image**: ~3.51 GB → **~800 MB** (77% Reduktion)
- **Web Image**: ~238 MB → **~150 MB** (37% Reduktion)

---

## 🎯 Angewendete Best Practices

### 1. Multi-Stage Builds (Separierte Build- und Runtime-Stages)

**Problem vorher:** Alle Build-Dependencies (TypeScript, Webpack, etc.) waren im Production-Image enthalten.

**Lösung:**

```dockerfile
# Build Stage - enthält alle Dev-Dependencies
FROM node:20-alpine AS builder
RUN npm ci  # Installiert alles

# Production Stage - nur Runtime-Dependencies
FROM node:20-alpine AS production
COPY --from=builder /app/dist ./dist  # Nur kompilierter Code
```

**Vorteil:** Build-Tools (~1-2 GB) werden nicht ins finale Image kopiert.

---

### 2. Workspace-spezifische Dependencies (`--workspace` flag)

**Problem vorher:** `npm ci` installierte ALLE Workspace-Pakete (API + Web + Tooling).

**Lösung:**

```dockerfile
# Nur API-Dependencies installieren
RUN npm ci --workspace=apps/api --omit=dev --legacy-peer-deps && \
    npm cache clean --force
```

**Vorteil:**

- Keine Frontend-Dependencies im Backend-Image
- `--omit=dev` entfernt Dev-Dependencies (TypeScript, ESLint, etc.)
- `npm cache clean --force` reduziert Image-Größe um ~200-300 MB

---

### 3. Layer Caching & Optimierung

**Problem vorher:** Source-Code wurde vor Dependencies kopiert → Cache-Invalidierung bei jedem Code-Change.

**Lösung:**

```dockerfile
# Erst Dependencies (ändert sich selten)
COPY package*.json ./
RUN npm ci

# Dann Source-Code (ändert sich oft)
COPY apps/api ./apps/api
RUN npm run build
```

**Vorteil:** Dependencies werden nur neu installiert, wenn `package.json` sich ändert.

---

### 4. Minimale Prisma Client Integration

**Problem vorher:** Prisma Client wurde 2x generiert und komplett kopiert.

**Lösung:**

```dockerfile
# Nur Prisma Client kopieren, nicht das gesamte node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
```

**Vorteil:** ~100-200 MB Einsparung durch gezieltes Kopieren.

---

### 5. .dockerignore für Build-Context

**Problem vorher:** Gesamter Workspace (inkl. `node_modules`, `uploads/`, `.git`) wurde an Docker Daemon gesendet.

**Lösung:** `.dockerignore` excludiert:

``` plain
node_modules
uploads/
storage/
dist/
.next/
logs/
.git/
```

**Vorteil:**

- Build-Context: ~5 GB → ~50 MB (100x schneller Upload)
- Keine sensitive Dateien im Image

---

### 6. Alpine Linux Base Image

**Bereits implementiert, aber optimiert:**

```dockerfile
FROM node:20-alpine  # ~50 MB statt node:20 (~900 MB)
```

**Vorteil:** Minimales Linux-System mit nur notwendigen Packages.

---

### 7. Dumb-Init für Signal Handling

**Neu hinzugefügt:**

```dockerfile
RUN apk add --no-cache dumb-init
CMD ["dumb-init", "node", "dist/apps/api/main"]
```

**Vorteil:**

- Proper PID 1 Process (korrekte Signal-Weiterleitung)
- Graceful Shutdown bei Container-Stop
- Verhindert Zombie-Prozesse

---

### 8. Security: Non-Root User

**Bereits implementiert, behalten:**

```dockerfile
RUN adduser -S nestjs -u 1001
USER nestjs
```

**Vorteil:** Container läuft nicht als Root (Defense in Depth).

---

### 9. BuildKit Optimierungen

**Im Build-Skript aktiviert:**

```bash
export DOCKER_BUILDKIT=1
export BUILDKIT_INLINE_CACHE=1

docker build \
    --cache-from "${API_IMAGE}:latest" \
    --build-arg BUILDKIT_INLINE_CACHE=1
```

**Vorteil:**

- Parallele Stage-Builds
- Remote Cache Layers von ACR
- ~30-50% schnellere Builds

---

## 📊 Erwartete Verbesserungen

### API Image

| Metrik          | Vorher    | Nachher  | Verbesserung |
| --------------- | --------- | -------- | ------------ |
| **Größe**       | 3.51 GB   | ~800 MB  | **-77%**     |
| **Build-Zeit**  | ~8-10 min | ~4-5 min | **-50%**     |
| **Deploy-Zeit** | ~5-7 min  | ~2-3 min | **-60%**     |
| **Pull-Zeit**   | ~3-4 min  | ~1 min   | **-70%**     |

### Web Image

| Metrik          | Vorher   | Nachher | Verbesserung |
| --------------- | -------- | ------- | ------------ |
| **Größe**       | 238 MB   | ~150 MB | **-37%**     |
| **Build-Zeit**  | ~3-4 min | ~2 min  | **-40%**     |
| **Deploy-Zeit** | ~2 min   | ~1 min  | **-50%**     |

### Gesamtkosten (Azure)

- **ACR Storage:** ~3.7 GB/month → ~1 GB/month (**-73%**)
- **Container Apps Pull:** ~30% schnellere Cold Starts
- **CI/CD Pipeline:** ~40% kürzere Build-Zeit = **weniger Compute-Minutes**

---

## 🚀 Usage

### 1. Lokal testen

```bash
# Einzelnes Image bauen
./scripts/build-optimized.sh api
./scripts/build-optimized.sh web

# Beide Images bauen
./scripts/build-optimized.sh all
```

### 2. Zu ACR pushen

```bash
# Login zu ACR
az acr login --name smartapplydevacr

# Bauen und pushen
BUILD_TAG=v1.0.0 ./scripts/build-optimized.sh all

# Interaktiver Prompt fragt nach Push
```

### 3. In Container Apps deployen

```bash
# Update Container App mit neuem Image
az containerapp update \
  --name smart-apply-api \
  --resource-group smart-apply-dev-rg \
  --image smartapplydevacr.azurecr.io/smart-apply-api:latest

az containerapp update \
  --name smart-apply-web \
  --resource-group smart-apply-dev-rg \
  --image smartapplydevacr.azurecr.io/smart-apply-web:latest
```

---

## 🔍 Troubleshooting

### "npm ci failed" Error

**Ursache:** Workspace-Dependencies nicht gefunden.

**Lösung:**

```bash
# Lokal testen
cd /Users/arian/VS-Projects/smart-apply
npm ci --workspace=apps/api --legacy-peer-deps
```

### Image größer als erwartet

**Ursache:** .dockerignore nicht im richtigen Verzeichnis.

**Check:**

```bash
# .dockerignore muss neben Dockerfile sein
ls -la infra/.dockerignore
```

### Prisma Client nicht gefunden

**Ursache:** Prisma Schema-Pfad falsch.

**Lösung:** Schema muss in Builder-Stage generiert und kopiert werden:

```dockerfile
RUN npx prisma generate --schema=./apps/api/prisma/schema.prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
```

---

## 📝 Checkliste für Production

- [ ] **.dockerignore** erstellt und getestet
- [ ] **Build-Skript** ausführbar (`chmod +x scripts/build-optimized.sh`)
- [ ] **Lokaler Build** erfolgreich (`./scripts/build-optimized.sh all`)
- [ ] **Images zu ACR gepusht** (`docker push`)
- [ ] **Container Apps aktualisiert** (`az containerapp update`)
- [ ] **Health Checks** nach Deploy prüfen (`/health` Endpoint)
- [ ] **Logs** auf Fehler überprüfen (`az containerapp logs`)
- [ ] **Image-Größen** in ACR verifizieren (`az acr repository show`)

---

## 🔐 Security Notes

### Vulnerabilities in node:20-alpine

Die Lint-Warnings zu "2 high vulnerabilities" beziehen sich auf bekannte CVEs im Base Image:

- **CVE-2024-XXXX** (OpenSSL) - Fixed in node:20.11+
- **CVE-2024-YYYY** (Alpine) - Fixed in alpine:3.19+

**Mitigation:**

1. Regelmäßige Updates: `docker pull node:20-alpine`
2. Alternative: `node:20-alpine3.19` (pinned version)
3. Security Scanning: Azure Defender for Container Registries

**Risk Assessment:** LOW (keine kritischen CVEs, nur in Build-Stages)

---

## 📚 Weitere Optimierungen (Optional)

### 1. Multi-Architecture Builds

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --push \
  -t smartapplydevacr.azurecr.io/smart-apply-api:latest \
  -f infra/Dockerfile .
```

### 2. Distroless Images (experimental)

```dockerfile
FROM gcr.io/distroless/nodejs20-debian12:latest
# Noch kleiner (~50 MB), aber komplexer Setup
```

### 3. Layer Caching mit GitHub Actions

```yaml
- name: Build with cache
  uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

---

## 📞 Support

Bei Fragen oder Problemen:

1. Check Logs: `docker logs <container-id>`
2. Inspect Image: `docker history <image-name>`
3. Compare Sizes: `docker images | grep smart-apply`

**Kontakt:** DevOps Team
