# 🚀 Docker Optimization - Quick Reference

## Neue Image-Größen (Erwartet)

``` plain
API:  3.51 GB → 800 MB  (77% ↓)
Web:  238 MB → 150 MB   (37% ↓)
```

## Schnellstart

### 1️⃣ Beide Images bauen

```bash
cd /Users/arian/VS-Projects/smart-apply
./scripts/build-optimized.sh all
```

### 2️⃣ Zu ACR pushen

```bash
# Login
az acr login --name smartapplydevacr

# Build + Push
./scripts/build-optimized.sh all
# (Skript fragt am Ende nach Push)
```

### 3️⃣ Container Apps aktualisieren

```bash
# API
az containerapp update \
  --name smart-apply-api \
  --resource-group smart-apply-dev-rg \
  --image smartapplydevacr.azurecr.io/smart-apply-api:latest

# Web
az containerapp update \
  --name smart-apply-web \
  --resource-group smart-apply-dev-rg \
  --image smartapplydevacr.azurecr.io/smart-apply-web:latest
```

## Key Changes

### ✅ Dockerfile (`infra/Dockerfile`)

- Workspace-specific deps: `npm ci --workspace=apps/api --omit=dev`
- Layer optimization: Dependencies → Source Code → Build
- Minimal Prisma: Nur `.prisma` und `@prisma` Ordner kopiert
- Dumb-init für proper signal handling

### ✅ Dockerfile.web (`infra/Dockerfile.web`)

- Next.js Standalone Build (automatisch minimal node_modules)
- Dumb-init für graceful shutdown
- Cache cleaning nach npm ci

### ✅ .dockerignore (`infra/.dockerignore`)

- Excludiert: node_modules, uploads, storage, logs, .git
- Build-Context: 5 GB → 50 MB

### ✅ Build-Skript (`scripts/build-optimized.sh`)

- BuildKit aktiviert (parallele Builds)
- Cache-from ACR (schnellere Builds)
- Metriken (Größe, Build-Zeit)
- Interaktiver Push-Prompt

## Troubleshooting

### Build fehlschlägt

```bash
# Check Docker BuildKit
export DOCKER_BUILDKIT=1

# Check .dockerignore
ls -la infra/.dockerignore

# Lokaler npm test
npm ci --workspace=apps/api --legacy-peer-deps
```

### Image zu groß

```bash
# Check einzelne Layers
docker history smartapplydevacr.azurecr.io/smart-apply-api:latest

# Check was im Image ist
docker run --rm -it smartapplydevacr.azurecr.io/smart-apply-api:latest sh
> du -sh /app/*
```

### Prisma nicht gefunden

```bash
# Check ob Prisma Client existiert
docker run --rm smartapplydevacr.azurecr.io/smart-apply-api:latest \
  ls -la /app/node_modules/.prisma
```

## Verification nach Deploy

```bash
# 1. Check Image-Größen in ACR
az acr repository show \
  --name smartapplydevacr \
  --image smart-apply-api:latest \
  --query "imageSize" -o tsv

# 2. Check Container App Health
az containerapp show \
  --name smart-apply-api \
  --resource-group smart-apply-dev-rg \
  --query "properties.runningStatus" -o tsv

# 3. Check Logs
az containerapp logs show \
  --name smart-apply-api \
  --resource-group smart-apply-dev-rg \
  --follow

# 4. Test Health Endpoint
curl https://smart-apply-api.azurecontainerapps.io/health
```

## Expected Benefits

| Metrik          | Vorher    | Nachher | Δ        |
| --------------- | --------- | ------- | -------- |
| **Total Size**  | 3.75 GB   | 950 MB  | **-75%** |
| **Build Time**  | 11-14 min | 6-7 min | **-50%** |
| **Deploy Time** | 7-9 min   | 3-4 min | **-60%** |
| **Pull Time**   | 4-5 min   | 1-2 min | **-65%** |
| **ACR Storage** | 3.7 GB/m  | 1 GB/m  | **-73%** |

## Files Changed

- ✅ `infra/Dockerfile` (optimiert)
- ✅ `infra/Dockerfile.web` (optimiert)
- ✅ `infra/.dockerignore` (neu)
- ✅ `scripts/build-optimized.sh` (neu)
- ✅ `docs/guides/DOCKER_OPTIMIZATION.md` (neu)

## Next Steps

1. [ ] Test local build: `./scripts/build-optimized.sh all`
2. [ ] Push to ACR
3. [ ] Update Container Apps
4. [ ] Verify sizes & logs
5. [ ] Monitor for 24h
6. [ ] Update CI/CD pipeline to use new Dockerfiles

---

**Full Documentation:** `docs/guides/DOCKER_OPTIMIZATION.md`
