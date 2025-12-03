# 🚀 Azure Deployment - Schnellübersicht

## Was wurde erstellt?

### 1. Infrastructure as Code (Bicep)
✅ **9 Bicep Module** für alle Azure Resources:
- Container Registry (Docker Images)
- PostgreSQL Flexible Server (Database)
- Storage Account (Blob für PDFs)
- Service Bus (Job Queue)
- Key Vault (Secrets Management)
- Log Analytics (Monitoring)
- Container Apps Environment
- Container App (Backend API)
- Automatic Secret Management

### 2. CI/CD Pipeline (GitHub Actions)
✅ **Vollautomatisches Deployment** mit:
- Docker Build & Push zu ACR
- Deploy zu Container Apps
- Database Migrations
- Health Checks & Smoke Tests
- Rollback-Fähigkeit

### 3. Production Environment
✅ **Security & Best Practices**:
- Azure OIDC (keine Secrets in GitHub)
- Key Vault für alle Credentials
- Health Checks (Liveness & Readiness Probes)
- Auto-Scaling (1-5 Replicas)
- SSL/TLS by default
- Audit Logging

### 4. Dokumentation
✅ **Umfassende Guides**:
- `docs/guides/AZURE_DEPLOYMENT.md` (10 Kapitel, 500+ Zeilen)
- `infra/azure/README.md` (Quick Start)
- `.env.production.template` (alle Variables)
- `scripts/deploy-azure.sh` (Automated Setup)

## Geschätzte Kosten

| Resource | Kosten/Monat |
|----------|--------------|
| Container Apps (0.5 vCPU) | €15-30 |
| PostgreSQL (B1ms) | €15-20 |
| Storage + Service Bus | €5 |
| Registry + Key Vault | €5 |
| **TOTAL** | **~€40-60** |

## Deployment in 3 Schritten

### 1. Infrastructure deployen (15 Min)
```bash
./scripts/deploy-azure.sh prod
```

### 2. GitHub Actions konfigurieren (5 Min)
```bash
# Service Principal + Secrets erstellen
# Siehe: docs/guides/AZURE_DEPLOYMENT.md#3-github-actions-setup
```

### 3. Push zu `mvp` Branch (Auto-Deploy)
```bash
git push origin mvp
```

## Nächste Schritte

1. **Jetzt:** Secrets generieren und Infrastructure deployen
2. **Dann:** GitHub Actions mit Azure OIDC verbinden
3. **Zuletzt:** Push triggert automatisches Deployment

## Support

- **Guide:** `docs/guides/AZURE_DEPLOYMENT.md`
- **Troubleshooting:** Siehe Guide Kapitel 6
- **Logs:** `az containerapp logs show --name smartapply-prod-api --resource-group smartapply-prod-rg`

---

**Ready to deploy? Start mit: `./scripts/deploy-azure.sh prod`** 🚀
