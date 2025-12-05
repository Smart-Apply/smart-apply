# GitHub Actions Workflows

## Overview

This repository uses GitHub Actions for CI/CD to deploy the Smart Apply application to Azure Container Apps.

## Workflows

### 1. `deploy-all.yml` - Main Deployment Workflow (Recommended)

**Purpose:** Intelligently deploys both backend and frontend based on file changes.

**Triggers:**
- Push to `mvp` branch (auto-detects changes)
- Pull requests to `mvp` branch (for validation)
- Manual dispatch with options to deploy backend/frontend separately

**Features:**
- 🔍 **Smart Change Detection:** Only deploys what changed
- 🚀 **Parallel Deployment:** Backend and frontend deploy independently
- 🏥 **Health Checks:** Validates deployments automatically
- 📊 **Deployment Summary:** Creates detailed summary with URLs

**Usage:**
```bash
# Automatic: Just push to mvp branch
git push origin mvp

# Manual: Use GitHub UI
# Go to Actions → Deploy Backend & Frontend → Run workflow
```

### 2. `azure-deploy.yml` - Backend Only Deployment

**Purpose:** Deploys only the backend API to Azure Container Apps.

**Triggers:**
- Push to `mvp` with changes to:
  - `apps/api/**`
  - `infra/**`
  - `package.json`
- Manual dispatch

**Steps:**
1. Build backend Docker image
2. Push to Azure Container Registry
3. Deploy to Container Apps (smartapply-dev-api)
4. Run database migrations
5. Health checks

### 3. `azure-deploy-frontend.yml` - Frontend Only Deployment

**Purpose:** Deploys only the frontend web app to Azure Container Apps.

**Triggers:**
- Push to `mvp` with changes to:
  - `apps/web/**`
  - `infra/Dockerfile.web`
  - `package.json`
- Manual dispatch

**Steps:**
1. Build frontend Docker image
2. Push to Azure Container Registry
3. Deploy to Container Apps (smartapply-dev-web)
4. Health checks

## Required Secrets

Configure these in GitHub Settings → Secrets and variables → Actions:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `AZURE_CLIENT_ID` | Azure Service Principal Client ID | `12345678-1234-...` |
| `AZURE_TENANT_ID` | Azure AD Tenant ID | `87654321-4321-...` |
| `AZURE_SUBSCRIPTION_ID` | Azure Subscription ID | `abcdef12-3456-...` |
| `AZURE_CONTAINER_REGISTRY` | ACR name (without .azurecr.io) | `smartapplydevacr` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Backend    │  │   Frontend   │  │    Infra     │     │
│  │  apps/api/   │  │  apps/web/   │  │   infra/     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│              GitHub Actions (OIDC Auth)                      │
│                                                              │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │  Build Backend  │         │  Build Frontend │           │
│  │  Docker Image   │         │  Docker Image   │           │
│  └────────┬────────┘         └────────┬────────┘           │
│           │                           │                     │
│           └───────────┬───────────────┘                     │
│                       ▼                                     │
│           ┌───────────────────────┐                        │
│           │  Azure Container      │                        │
│           │  Registry (ACR)       │                        │
│           └───────────┬───────────┘                        │
│                       │                                     │
└───────────────────────┼─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   Azure Resources                            │
│                                                              │
│  ┌─────────────────────────────────────────────────┐       │
│  │      Container Apps Environment                  │       │
│  │                                                  │       │
│  │  ┌──────────────────┐  ┌──────────────────┐    │       │
│  │  │ smartapply-dev-  │  │ smartapply-dev-  │    │       │
│  │  │      api         │  │      web         │    │       │
│  │  │  (Backend API)   │  │  (Frontend)      │    │       │
│  │  └──────────────────┘  └──────────────────┘    │       │
│  └─────────────────────────────────────────────────┘       │
│                                                              │
│  PostgreSQL | Storage | Service Bus | Key Vault             │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Process

### Backend Deployment
1. **Build:** Docker image built from `infra/Dockerfile`
2. **Push:** Image tagged with commit SHA + `latest`
3. **Deploy:** Container App updated with new image
4. **Migrate:** Prisma migrations applied to database
5. **Health Check:** Validates `/api/v1/health/live` and `/api/v1/health/ready`

### Frontend Deployment
1. **Build:** Docker image built from `infra/Dockerfile.web`
2. **Push:** Image tagged with commit SHA + `latest`
3. **Deploy:** Container App updated with new image
4. **Health Check:** Validates HTTP 200 response

## Manual Deployment

### Deploy Everything
```bash
# Via GitHub CLI
gh workflow run deploy-all.yml

# Via GitHub UI
Actions → Deploy Backend & Frontend → Run workflow
```

### Deploy Backend Only
```bash
gh workflow run azure-deploy.yml
```

### Deploy Frontend Only
```bash
gh workflow run azure-deploy-frontend.yml
```

## Monitoring Deployments

### View Logs in GitHub Actions
1. Go to Actions tab
2. Click on workflow run
3. Click on specific job to see logs

### View Container App Logs
```bash
# Backend logs
az containerapp logs show \
  --name smartapply-dev-api \
  --resource-group smartapply-dev-rg \
  --follow

# Frontend logs
az containerapp logs show \
  --name smartapply-dev-web \
  --resource-group smartapply-dev-rg \
  --follow
```

## Troubleshooting

### Deployment Fails

1. **Check GitHub Actions logs:**
   - Look for error messages in failed steps
   - Common issues: Docker build errors, ACR auth failures

2. **Verify Azure resources:**
   ```bash
   # Check Container App status
   az containerapp show \
     --name smartapply-dev-api \
     --resource-group smartapply-dev-rg \
     --query "properties.{status:runningStatus,health:latestRevisionName}"
   ```

3. **Check secrets:**
   - Ensure all required secrets are configured
   - Verify OIDC federation is set up correctly

### Health Checks Fail

1. **Check application logs:**
   ```bash
   az containerapp logs show \
     --name smartapply-dev-api \
     --resource-group smartapply-dev-rg \
     --tail 100
   ```

2. **Test endpoints manually:**
   ```bash
   curl https://smartapply-dev-api.ashycliff-786e35b4.northeurope.azurecontainerapps.io/api/v1/health/live
   ```

### Database Migration Fails

1. **Check Key Vault access:**
   ```bash
   az keyvault secret show \
     --name database-url \
     --vault-name smartapply-dev-vault
   ```

2. **Run migrations manually:**
   ```bash
   cd apps/api
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```

## Best Practices

1. **Always test locally first:**
   ```bash
   # Build Docker images locally
   docker build -t test-api -f infra/Dockerfile .
   docker build -t test-web -f infra/Dockerfile.web .
   ```

2. **Use pull requests:**
   - Create PR to `mvp` branch
   - Review workflow run results
   - Merge only if all checks pass

3. **Monitor deployments:**
   - Check GitHub Actions summary
   - Verify application URLs
   - Test critical user flows

4. **Rollback if needed:**
   ```bash
   # List revisions
   az containerapp revision list \
     --name smartapply-dev-api \
     --resource-group smartapply-dev-rg
   
   # Activate previous revision
   az containerapp revision activate \
     --name smartapply-dev-api \
     --resource-group smartapply-dev-rg \
     --revision <previous-revision-name>
   ```

## URLs

After successful deployment:

- **Frontend:** https://smartapply-dev-web.ashycliff-786e35b4.northeurope.azurecontainerapps.io
- **Backend API:** https://smartapply-dev-api.ashycliff-786e35b4.northeurope.azurecontainerapps.io
- **Swagger Docs:** https://smartapply-dev-api.ashycliff-786e35b4.northeurope.azurecontainerapps.io/docs

## Further Reading

- [Azure Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [OIDC Authentication with Azure](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-azure)
