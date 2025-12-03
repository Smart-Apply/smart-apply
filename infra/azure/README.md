# 🚀 Azure Deployment - Quick Start

Dieses Verzeichnis enthält die komplette Infrastructure as Code (Bicep) für das Azure Deployment von Smart Apply MVP.

## 📁 Struktur

```
infra/azure/
├── main.bicep              # Haupt-Template (Subscription-Level)
├── main.bicepparam         # Parameter-Datei (Secrets hier eintragen)
└── modules/                # Bicep Module für einzelne Resources
    ├── container-registry.bicep    # Azure Container Registry
    ├── postgresql.bicep            # PostgreSQL Flexible Server
    ├── storage.bicep               # Blob Storage (PDFs)
    ├── service-bus.bicep           # Service Bus (Job Queue)
    ├── key-vault.bicep             # Key Vault (Secrets)
    ├── log-analytics.bicep         # Log Analytics Workspace
    ├── container-environment.bicep # Container Apps Environment
    ├── container-app.bicep         # Backend API Container App
    └── key-vault-secrets.bicep     # Secret Management
```

## 🎯 Quick Start

### Option 1: Automated Script (Empfohlen)

```bash
# Von Project Root
./scripts/deploy-azure.sh prod
```

Das Script:
- ✅ Prüft Voraussetzungen (Azure CLI, Bicep)
- ✅ Generiert sichere Secrets (JWT, PostgreSQL Password)
- ✅ Deployt komplette Infrastructure
- ✅ Speichert Outputs für GitHub Actions Setup

### Option 2: Manuelles Deployment

```bash
# 1. Secrets generieren
POSTGRES_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)
REFRESH_TOKEN_SECRET=$(openssl rand -base64 64)

# 2. main.bicepparam anpassen (Secrets eintragen)
cd infra/azure
nano main.bicepparam

# 3. Deployment starten
az deployment sub create \
  --location westeurope \
  --template-file main.bicep \
  --parameters main.bicepparam \
  --name smartapply-mvp-deployment
```

## 📊 Deployed Resources

Nach dem Deployment hast du:

| Resource | Type | Purpose |
|----------|------|---------|
| **smartapply-prod-rg** | Resource Group | Container für alle Resources |
| **smartapplyprodacr** | Container Registry | Docker Images |
| **smartapply-prod-psql** | PostgreSQL | Datenbank |
| **smartapplyprodst** | Storage Account | PDF Storage |
| **smartapply-prod-sb** | Service Bus | Job Queue |
| **smartapply-prod-kv** | Key Vault | Secrets |
| **smartapply-prod-logs** | Log Analytics | Logging/Monitoring |
| **smartapply-prod-cae** | Container Environment | Container Apps Host |
| **smartapply-prod-api** | Container App | Backend API |

**Geschätzte Kosten:** ~€36-60/Monat (siehe [Deployment Guide](../../docs/guides/AZURE_DEPLOYMENT.md#9-kosten-optimierung-mvp))

## 🔧 Next Steps nach Deployment

### 1. GitHub Actions Setup

```bash
# 1. Service Principal erstellen
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
RESOURCE_GROUP="smartapply-prod-rg"

az ad sp create-for-rbac \
  --name "smartapply-github-actions" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP \
  --sdk-auth

# 2. Federated Credentials konfigurieren
APP_ID=$(az ad sp list --display-name "smartapply-github-actions" --query "[0].appId" -o tsv)

az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "smartapply-mvp-branch",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:YOUR_USERNAME/smart-apply:ref:refs/heads/mvp",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# 3. GitHub Secrets erstellen
gh secret set AZURE_CLIENT_ID --body "xxx"
gh secret set AZURE_TENANT_ID --body "xxx"
gh secret set AZURE_SUBSCRIPTION_ID --body "xxx"
gh secret set AZURE_CONTAINER_REGISTRY --body "smartapplyprodacr"
```

### 2. Initial Docker Image deployen

```bash
# Von Project Root
docker build -f infra/Dockerfile -t smartapply-api:latest --target production .

# Tag für ACR
ACR_NAME="smartapplyprodacr"
docker tag smartapply-api:latest $ACR_NAME.azurecr.io/smart-apply-api:latest

# Login & Push
az acr login --name $ACR_NAME
docker push $ACR_NAME.azurecr.io/smart-apply-api:latest

# Container App updaten
az containerapp update \
  --name smartapply-prod-api \
  --resource-group smartapply-prod-rg \
  --image $ACR_NAME.azurecr.io/smart-apply-api:latest
```

### 3. Database Migrations ausführen

```bash
# Database URL aus Key Vault
DATABASE_URL=$(az keyvault secret show \
  --name database-url \
  --vault-name smartapply-prod-kv \
  --query value -o tsv)

# Migrations + Seed
cd apps/api
DATABASE_URL=$DATABASE_URL npx prisma migrate deploy
DATABASE_URL=$DATABASE_URL npm run prisma:seed
```

### 4. Verify Deployment

```bash
# Get API URL
API_URL=$(az containerapp show \
  --name smartapply-prod-api \
  --resource-group smartapply-prod-rg \
  --query properties.configuration.ingress.fqdn -o tsv)

# Health Check
curl -s "https://$API_URL/api/v1/health" | jq .

# Swagger Docs
open "https://$API_URL/docs"
```

## 📖 Vollständige Dokumentation

Siehe [Azure Deployment Guide](../../docs/guides/AZURE_DEPLOYMENT.md) für:
- Detaillierte Schritt-für-Schritt Anleitung
- Troubleshooting Guide
- Rollback-Verfahren
- Monitoring & Alerts Setup
- Kosten-Optimierung

## 🔐 Sicherheit

**WICHTIG:** Die generierten Secrets (PostgreSQL Password, JWT Secrets) werden:
- ✅ In Azure Key Vault gespeichert
- ✅ Als Container App Secrets referenziert
- ✅ Nie im Code committed

**Nach Deployment:**
- [ ] Secrets-Datei (.azure-secrets-*.tmp) sicher speichern
- [ ] Temporäre Dateien löschen
- [ ] GitHub Secrets verifizieren
- [ ] CORS Origins aktualisieren (nach Frontend Deployment)

## 🆘 Support

Bei Problemen:
1. Siehe [Troubleshooting Section](../../docs/guides/AZURE_DEPLOYMENT.md#6-troubleshooting)
2. Azure Logs prüfen: `az containerapp logs show --name smartapply-prod-api --resource-group smartapply-prod-rg --tail 100`
3. GitHub Issues erstellen mit Logs

---

**Viel Erfolg! 🚀**
