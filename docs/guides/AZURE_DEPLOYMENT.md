# 🚀 Azure Deployment Guide - Smart Apply MVP

## Inhaltsverzeichnis

1. [Voraussetzungen](#1-voraussetzungen)
2. [Azure Resources provisionieren](#2-azure-resources-provisionieren)
3. [GitHub Actions Setup](#3-github-actions-setup)
4. [Environment Variables konfigurieren](#4-environment-variables-konfigurieren)
5. [Deployment durchführen](#5-deployment-durchführen)
6. [Troubleshooting](#6-troubleshooting)
7. [Rollback-Verfahren](#7-rollback-verfahren)

---

## 1. Voraussetzungen

### Installierte Tools

- [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli) (v2.50+)
- [Bicep CLI](https://learn.microsoft.com/azure/azure-resource-manager/bicep/install) (v0.20+)
- [Docker](https://docs.docker.com/get-docker/) (für lokale Tests)
- [GitHub CLI](https://cli.github.com/) (optional, für Secrets Management)

### Azure Subscription

```bash
# Login zu Azure
az login

# Subscription anzeigen
az account show

# Subscription setzen (falls mehrere vorhanden)
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

### GitHub Repository

- Fork oder Clone von `smart-apply`
- Admin-Rechte für Secrets/Actions Configuration

---

## 2. Azure Resources provisionieren

### Schritt 2.1: Secrets generieren

**WICHTIG:** Generiere starke Secrets BEVOR du die Infrastructure deployst!

```bash
# PostgreSQL Admin Password (32 Zeichen)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
echo "PostgreSQL Password: $POSTGRES_PASSWORD"

# JWT Secret (64 Zeichen)
JWT_SECRET=$(openssl rand -base64 64)
echo "JWT Secret: $JWT_SECRET"

# Refresh Token Secret (64 Zeichen)
REFRESH_TOKEN_SECRET=$(openssl rand -base64 64)
echo "Refresh Token Secret: $REFRESH_TOKEN_SECRET"

# WICHTIG: Speichere diese Werte sicher (z.B. in 1Password, LastPass)
```

### Schritt 2.2: Bicep Parameter anpassen

Bearbeite `infra/azure/main.bicepparam`:

```bicep
using './main.bicep'

param environment = 'prod'
param location = 'westeurope'
param appName = 'smartapply'

// PostgreSQL Credentials
param postgresAdminUsername = 'sqladmin'
param postgresAdminPassword = 'PASTE_YOUR_POSTGRES_PASSWORD_HERE'

// Security Secrets
param jwtSecret = 'PASTE_YOUR_JWT_SECRET_HERE'
param refreshTokenSecret = 'PASTE_YOUR_REFRESH_TOKEN_SECRET_HERE'

// Frontend URL (update nach Vercel Deployment)
param frontendUrl = 'https://smartapply.vercel.app'

// Azure OpenAI (optional)
param openAiDeploymentName = 'gpt-4o'
param enableAzureOpenAI = false  // Set to true if you provision Azure OpenAI
```

### Schritt 2.3: Infrastructure deployen

```bash
# Navigiere zu infra/azure
cd infra/azure

# Validate Bicep template (optional aber empfohlen)
az bicep build --file main.bicep

# Deploy to Azure (subscription-level deployment)
az deployment sub create \
  --location westeurope \
  --template-file main.bicep \
  --parameters main.bicepparam \
  --name smartapply-mvp-deployment

# Dies dauert ca. 10-15 Minuten ⏱️
```

### Schritt 2.4: Deployment-Outputs abrufen

```bash
# Resource Group Name
RESOURCE_GROUP=$(az deployment sub show \
  --name smartapply-mvp-deployment \
  --query properties.outputs.resourceGroupName.value -o tsv)

echo "Resource Group: $RESOURCE_GROUP"

# Container Registry Name
ACR_NAME=$(az deployment sub show \
  --name smartapply-mvp-deployment \
  --query properties.outputs.containerRegistryName.value -o tsv)

echo "Container Registry: $ACR_NAME"

# Weitere Outputs anzeigen
az deployment sub show \
  --name smartapply-mvp-deployment \
  --query properties.outputs
```

---

## 3. GitHub Actions Setup

### Schritt 3.1: Azure Service Principal erstellen (OIDC)

**Empfohlen:** Verwende Federated Credentials (OIDC) statt Secrets für sichere Auth.

```bash
# Subscription ID abrufen
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Service Principal erstellen
az ad sp create-for-rbac \
  --name "smartapply-github-actions" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP \
  --sdk-auth

# Output speichern! Format:
# {
#   "clientId": "xxx",
#   "clientSecret": "xxx",
#   "subscriptionId": "xxx",
#   "tenantId": "xxx",
#   ...
# }
```

### Schritt 3.2: Federated Credential konfigurieren

```bash
# App ID des Service Principal abrufen
APP_ID=$(az ad sp list --display-name "smartapply-github-actions" --query "[0].appId" -o tsv)

# Federated Credential erstellen (für mvp branch)
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "smartapply-mvp-branch",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:YOUR_GITHUB_USERNAME/smart-apply:ref:refs/heads/mvp",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# Für main branch (optional)
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "smartapply-main-branch",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:YOUR_GITHUB_USERNAME/smart-apply:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

### Schritt 3.3: GitHub Secrets erstellen

### Option A: Via GitHub UI

1. Gehe zu `Settings > Secrets and variables > Actions > New repository secret`
2. Erstelle folgende Secrets:

| Secret Name                | Value               | Quelle                             |
| -------------------------- | ------------------- | ---------------------------------- |
| `AZURE_CLIENT_ID`          | `xxx-xxx-xxx`       | Service Principal `clientId`       |
| `AZURE_TENANT_ID`          | `xxx-xxx-xxx`       | Service Principal `tenantId`       |
| `AZURE_SUBSCRIPTION_ID`    | `xxx-xxx-xxx`       | Service Principal `subscriptionId` |
| `AZURE_CONTAINER_REGISTRY` | `smartapplyprodacr` | Ohne `.azurecr.io`                 |

### Option B: Via GitHub CLI

```bash
gh secret set AZURE_CLIENT_ID --body "xxx-xxx-xxx"
gh secret set AZURE_TENANT_ID --body "xxx-xxx-xxx"
gh secret set AZURE_SUBSCRIPTION_ID --body "xxx-xxx-xxx"
gh secret set AZURE_CONTAINER_REGISTRY --body "smartapplyprodacr"
```

### Schritt 3.4: Service Principal Berechtigungen erweitern

```bash
# ACR Push/Pull Berechtigung (für Docker Images)
az role assignment create \
  --assignee $APP_ID \
  --role "AcrPush" \
  --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.ContainerRegistry/registries/$ACR_NAME

# Key Vault Secrets Reader (für Migrations-Job)
KV_NAME="smartapply-prod-kv"
az role assignment create \
  --assignee $APP_ID \
  --role "Key Vault Secrets User" \
  --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.KeyVault/vaults/$KV_NAME
```

---

## 4. Environment Variables konfigurieren

### Schritt 4.1: Secrets in Key Vault abrufen

Die Bicep-Deployment hat bereits alle Secrets in Key Vault gespeichert. Verifiziere:

```bash
# Liste alle Secrets
az keyvault secret list --vault-name smartapply-prod-kv --query "[].name" -o table

# Erwartete Secrets:
# - jwt-secret
# - refresh-token-secret
# - postgres-admin-password
# - database-url
# - storage-connection-string
# - service-bus-connection-string
```

### Schritt 4.2: Container App Environment Variables (Optional)

Alle Secrets werden automatisch aus Key Vault geladen. Falls du manuelle Updates brauchst:

```bash
# Example: CORS Origins aktualisieren
az containerapp update \
  --name smartapply-prod-api \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars "CORS_ORIGINS=https://smartapply.vercel.app,https://www.smartapply.com"
```

---

## 5. Deployment durchführen

### Schritt 5.1: Initial Deployment (manuell)

**Erste Deployment vor GitHub Actions:**

```bash
# 1. Docker Image bauen
cd /path/to/smart-apply
docker build -f infra/Dockerfile -t smartapply-api:latest --target production .

# 2. Image taggen für ACR
docker tag smartapply-api:latest $ACR_NAME.azurecr.io/smart-apply-api:latest

# 3. Login zu ACR
az acr login --name $ACR_NAME

# 4. Push zu ACR
docker push $ACR_NAME.azurecr.io/smart-apply-api:latest

# 5. Container App updaten
az containerapp update \
  --name smartapply-prod-api \
  --resource-group $RESOURCE_GROUP \
  --image $ACR_NAME.azurecr.io/smart-apply-api:latest
```

### Schritt 5.2: Prisma Migrations ausführen

```bash
# 1. Database URL aus Key Vault holen
DATABASE_URL=$(az keyvault secret show \
  --name database-url \
  --vault-name smartapply-prod-kv \
  --query value -o tsv)

# 2. Navigiere zu apps/api
cd apps/api

# 3. Dependencies installieren (falls noch nicht geschehen)
npm ci

# 4. Migrations ausführen
DATABASE_URL=$DATABASE_URL npx prisma migrate deploy

# 5. Optional: Seed data (Demo-User, Templates)
DATABASE_URL=$DATABASE_URL npm run prisma:seed
```

### Schritt 5.3: Deployment via GitHub Actions

Nach initialem Setup erfolgen alle weiteren Deployments automatisch:

```bash
# Push zu mvp branch triggert Deployment
git checkout mvp
git add .
git commit -m "feat: add Azure deployment configuration"
git push origin mvp

# GitHub Actions wird automatisch getriggert:
# 1. Build Docker Image
# 2. Push to ACR
# 3. Deploy to Container Apps
# 4. Run Migrations
# 5. Smoke Tests
```

**Monitor Deployment:**

- GitHub Actions: `https://github.com/YOUR_USERNAME/smart-apply/actions`
- Azure Portal: Container Apps > Revisions

---

## 6. Troubleshooting

### Problem 1: Container App startet nicht

**Symptome:** Health Checks schlagen fehl, App ist nicht erreichbar

**Diagnose:**

```bash
# Logs abrufen (letzte 100 Zeilen)
az containerapp logs show \
  --name smartapply-prod-api \
  --resource-group $RESOURCE_GROUP \
  --tail 100 \
  --follow

# Revision Status prüfen
az containerapp revision list \
  --name smartapply-prod-api \
  --resource-group $RESOURCE_GROUP \
  --query "[].{Name:name, Active:properties.active, Health:properties.healthState}" -o table
```

**Häufige Ursachen:**

- ❌ Falsche `DATABASE_URL` (SSL-Mode fehlt: `?sslmode=require`)
- ❌ Chromium nicht gefunden (Dockerfile prüfen)
- ❌ Port 3000 nicht exposed
- ❌ Secrets nicht richtig gesetzt

**Fix:**

```bash
# Environment Variables prüfen
az containerapp show \
  --name smartapply-prod-api \
  --resource-group $RESOURCE_GROUP \
  --query "properties.template.containers[0].env" -o table
```

### Problem 2: Database Migrations schlagen fehl

**Symptome:** Migration Job failed in GitHub Actions

**Diagnose:**

```bash
# Test Database Connection
DATABASE_URL=$(az keyvault secret show \
  --name database-url \
  --vault-name smartapply-prod-kv \
  --query value -o tsv)

# Prisma introspect (prüft Connection)
cd apps/api
DATABASE_URL=$DATABASE_URL npx prisma db pull --force
```

**Häufige Ursachen:**

- ❌ PostgreSQL Firewall blockiert GitHub Actions Runner
- ❌ SSL-Mode nicht konfiguriert
- ❌ Admin-Credentials falsch

**Fix:**

```bash
# Firewall Rule für GitHub Actions hinzufügen (temporär)
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name smartapply-prod-psql \
  --rule-name AllowGitHubActions \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 255.255.255.255
```

### Problem 3: Azure OpenAI API Fehler

**Symptome:** LLM-Provider fails, Applications stuck in GENERATING

**Diagnose:**

```bash
# Test Azure OpenAI Endpoint (manuell)
curl -X POST "https://YOUR_RESOURCE.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-08-01-preview" \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Test"}],
    "max_tokens": 10
  }'
```

**Fix:**

```bash
# Fallback to Mock Provider (für Testing)
az containerapp update \
  --name smartapply-prod-api \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars "LLM_PROVIDER=mock"
```

### Problem 4: CORS Errors im Frontend

**Symptome:** Frontend kann API nicht erreichen, CORS Errors in Browser Console

**Fix:**

```bash
# CORS Origins aktualisieren
az containerapp update \
  --name smartapply-prod-api \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars "CORS_ORIGINS=https://smartapply.vercel.app,https://www.smartapply.com,https://smartapply-YOUR_USERNAME.vercel.app"

# Restart Container App
az containerapp revision restart \
  --name smartapply-prod-api \
  --resource-group $RESOURCE_GROUP
```

---

## 7. Rollback-Verfahren

### Schritt 7.1: Rollback zu vorheriger Revision (Container App)

```bash
# Liste alle Revisions (neueste zuerst)
az containerapp revision list \
  --name smartapply-prod-api \
  --resource-group $RESOURCE_GROUP \
  --query "[].{Name:name, Created:properties.createdTime, Active:properties.active, Traffic:properties.trafficWeight}" -o table

# Rollback zu spezifischer Revision
PREVIOUS_REVISION="smartapply-prod-api--abc123"  # Aus obiger Liste
az containerapp revision activate \
  --name smartapply-prod-api \
  --resource-group $RESOURCE_GROUP \
  --revision $PREVIOUS_REVISION

# Traffic auf alte Revision umleiten (100%)
az containerapp ingress traffic set \
  --name smartapply-prod-api \
  --resource-group $RESOURCE_GROUP \
  --revision-weight $PREVIOUS_REVISION=100
```

### Schritt 7.2: Rollback Database Migrations (KRITISCH!)

**ACHTUNG:** Database Rollbacks sind komplex! Nur in Notfall verwenden.

```bash
# Option 1: Restore von Backup (empfohlen)
az postgres flexible-server backup restore \
  --resource-group $RESOURCE_GROUP \
  --name smartapply-prod-psql \
  --source-server smartapply-prod-psql \
  --restore-time "2025-12-03T12:00:00Z"  # ISO 8601 format

# Option 2: Manual Migration Rollback (Prisma)
cd apps/api
DATABASE_URL=$DATABASE_URL npx prisma migrate resolve --rolled-back "20241203_migration_name"
```

### Schritt 7.3: Blue-Green Deployment (zukünftig)

Für zero-downtime deployments:

```bicep
// In container-app.bicep, change:
activeRevisionsMode: 'Multiple'  // Instead of 'Single'
```

```bash
# Deploy neue Version als "green"
az containerapp revision copy \
  --name smartapply-prod-api \
  --resource-group $RESOURCE_GROUP \
  --image $ACR_NAME.azurecr.io/smart-apply-api:v2.0.0

# Test "green" environment (0% traffic)
# ... smoke tests ...

# Gradually shift traffic (canary)
az containerapp ingress traffic set \
  --name smartapply-prod-api \
  --resource-group $RESOURCE_GROUP \
  --revision-weight blue=80 green=20

# Full cutover if successful
az containerapp ingress traffic set \
  --name smartapply-prod-api \
  --resource-group $RESOURCE_GROUP \
  --revision-weight green=100
```

---

## 8. Monitoring & Observability

### Schritt 8.1: Application Insights konfigurieren

```bash
# Application Insights erstellen (optional)
az monitor app-insights component create \
  --app smartapply-prod-insights \
  --location westeurope \
  --resource-group $RESOURCE_GROUP \
  --application-type web

# Connection String abrufen
APPINSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show \
  --app smartapply-prod-insights \
  --resource-group $RESOURCE_GROUP \
  --query connectionString -o tsv)

# Container App aktualisieren
az containerapp update \
  --name smartapply-prod-api \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars "APPINSIGHTS_CONNECTION_STRING=$APPINSIGHTS_CONNECTION_STRING"
```

### Schritt 8.2: Alerts einrichten

```bash
# Alert für Container App Down (Health Check failures)
az monitor metrics alert create \
  --name "smartapply-api-down" \
  --resource-group $RESOURCE_GROUP \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.App/containerApps/smartapply-prod-api \
  --condition "avg Percentage CPU > 90" \
  --description "API CPU usage critical" \
  --evaluation-frequency 1m \
  --window-size 5m \
  --severity 2
```

### Schritt 8.3: Log Analytics Queries

```kusto
// Container App Logs (Kusto Query Language)
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == "smartapply-prod-api"
| where TimeGenerated > ago(1h)
| project TimeGenerated, Log_s
| order by TimeGenerated desc
| take 100

// Health Check Failures
ContainerAppSystemLogs_CL
| where ContainerAppName_s == "smartapply-prod-api"
| where Log_s contains "health check failed"
| summarize count() by bin(TimeGenerated, 5m)
```

---

## 9. Kosten-Optimierung (MVP)

### Aktuelle Ressourcen-Kosten (ca. Schätzung)

| Resource            | SKU            | Kosten/Monat (€)  |
| ------------------- | -------------- | ----------------- |
| Container Apps      | 0.5 vCPU, 1 GB | ~€15-30           |
| PostgreSQL Flexible | B1ms (1 vCore) | ~€15-20           |
| Storage Account     | Standard LRS   | ~€1-5             |
| Service Bus         | Basic          | ~€0.05            |
| Container Registry  | Basic          | ~€4.25            |
| Key Vault           | Standard       | ~€0.50            |
| **TOTAL**           |                | **~€36-60/Monat** |

**Tipps zur Kostenreduktion:**

- 🔄 Scale to Zero: Container Apps können auf 0 Replicas runterskalieren
- 🛑 Dev/Test Umgebungen nachts ausschalten
- 📦 ACR Image Retention Policy (30 Tage)
- 🗄️ PostgreSQL: Burstable Tier ausreichend für MVP

---

## 10. Next Steps nach Deployment

### ✅ Produktionsbereitschaft Checklist

- [ ] **Security:**
  - [ ] Azure Front Door + WAF (DDoS Protection)
  - [ ] Private Endpoints für PostgreSQL + Storage
  - [ ] Managed Identity statt Connection Strings
  - [ ] Azure Key Vault References in Container Apps
- [ ] **Monitoring:**
  - [ ] Application Insights Dashboards
  - [ ] Alerts für kritische Metriken (CPU, Memory, Errors)
  - [ ] Uptime Monitoring (Azure Monitor / Pingdom)
- [ ] **Performance:**
  - [ ] CDN für Frontend (Azure CDN / Vercel Edge)
  - [ ] Redis Cache (Azure Cache for Redis)
  - [ ] Database Query Optimization
- [ ] **Backup & DR:**
  - [ ] Automated Database Backups (täglich)
  - [ ] Geo-Replication für Storage
  - [ ] Disaster Recovery Plan dokumentieren

---

## Support & Kontakt

- **Dokumentation:** `/docs/` Ordner
- **Issues:** GitHub Issues
- **Azure Support:** [Azure Portal > Help + Support](https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade)

---

Viel Erfolg beim Deployment! 🚀
