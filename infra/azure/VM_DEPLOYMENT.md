# Smart Apply - Azure VM Deployment Guide

## Overview

This document describes the VM-based deployment architecture for Smart Apply MVP, optimized for cost efficiency and operational simplicity.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Azure Virtual Network (10.0.0.0/16)                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ Application Subnet (10.0.1.0/24)                                ││
│  │                                                                  ││
│  │  ┌───────────────────────────────────────────────────────────┐ ││
│  │  │ VM: smartapply-dev-vm (Standard_B2s)                      │ ││
│  │  │ - Public IP: <fqdn>.westeurope.cloudapp.azure.com        │ ││
│  │  │ - Ubuntu 22.04 LTS                                        │ ││
│  │  │ - System-assigned Managed Identity                        │ ││
│  │  │                                                            │ ││
│  │  │ Components:                                                │ ││
│  │  │ ┌────────────────────────────────────────────────────────┐│ ││
│  │  │ │ Nginx (Reverse Proxy + SSL)                            ││ ││
│  │  │ │ - Port 80 → HTTP (Let's Encrypt)                       ││ ││
│  │  │ │ - Port 443 → HTTPS                                      ││ ││
│  │  │ │ - Proxies to Docker containers                          ││ ││
│  │  │ └────────────────────────────────────────────────────────┘│ ││
│  │  │                                                            │ ││
│  │  │ ┌────────────────────────────────────────────────────────┐│ ││
│  │  │ │ Docker Compose                                          ││ ││
│  │  │ │ ┌──────────────────────────────────────────────────┐  ││ ││
│  │  │ │ │ Container: smart-apply-api                        │  ││ ││
│  │  │ │ │ - NestJS + Prisma                                 │  ││ ││
│  │  │ │ │ - Puppeteer/Chromium (PDF generation)            │  ││ ││
│  │  │ │ │ - Port 3000 (internal)                            │  ││ ││
│  │  │ │ │ - CPU: 1.5 vCPU, RAM: 2GB                        │  ││ ││
│  │  │ │ └──────────────────────────────────────────────────┘  ││ ││
│  │  │ │ ┌──────────────────────────────────────────────────┐  ││ ││
│  │  │ │ │ Container: smart-apply-web                        │  ││ ││
│  │  │ │ │ - Next.js 16 (React 19)                           │  ││ ││
│  │  │ │ │ - Port 3001 → 3000 (internal)                     │  ││ ││
│  │  │ │ │ - CPU: 0.5 vCPU, RAM: 768MB                       │  ││ ││
│  │  │ │ └──────────────────────────────────────────────────┘  ││ ││
│  │  │ └────────────────────────────────────────────────────────┘│ ││
│  │  │                                                            │ ││
│  │  │ Volumes:                                                   │ ││
│  │  │ - /opt/smart-apply/logs → Winston audit logs              │ ││
│  │  │ - /opt/smart-apply/uploads → Temporary file uploads       │ ││
│  │  └───────────────────────────────────────────────────────────┘ ││
│  │                                                                  ││
│  │  Network Security Group:                                        ││
│  │  - Inbound: 443 (HTTPS), 80 (HTTP), 22 (SSH - restricted)      ││
│  │  - Outbound: 5432 (PostgreSQL), 443/80 (Azure services)        ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ Data Subnet (10.0.2.0/24)                                       ││
│  │                                                                  ││
│  │  ┌─────────────────────────────────────────────────────────┐   ││
│  │  │ Azure Database for PostgreSQL - Flexible Server         │   ││
│  │  │ - Standard_B1ms (1 vCore, 2GB RAM)                      │   ││
│  │  │ - VNet integration (private connection)                 │   ││
│  │  │ - Automated backups (7-day retention)                   │   ││
│  │  └─────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  External Azure Services (HTTPS connections):                        │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ • Azure Blob Storage (PDF document storage)                     ││
│  │ • Azure Service Bus (background job queue)                      ││
│  │ • Azure Key Vault (secrets management via Managed Identity)     ││
│  │ • Azure OpenAI (LLM for CV/cover letter generation)             ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

## Cost Analysis

### Monthly Costs (EUR)

| Service | SKU/Tier | Monthly Cost | Annual Reserved | Notes |
|---------|----------|--------------|-----------------|-------|
| **Virtual Machine** | Standard_B2s | €30.00 | €18.00 (-40%) | 2 vCPU, 4GB RAM, burstable |
| **Static Public IP** | Standard | €3.00 | €3.00 | DNS-enabled IP |
| **PostgreSQL** | Standard_B1ms | €18.00 | €18.00 | 1 vCore, 2GB RAM |
| **Storage (Blob)** | Standard_LRS | €2.00 | €2.00 | ~50GB PDFs |
| **Service Bus** | Basic | €0.05 | €0.05 | Job queue |
| **Key Vault** | Standard | €0.50 | €0.50 | Secret storage |
| **Azure OpenAI** | Pay-per-token | €20-100 | €20-100 | Variable usage |
| **Network Egress** | Standard | €5-10 | €5-10 | First 100GB free |
| **TOTAL (Dev)** | | **€78-163/mo** | **€66-151/mo** | With reserved VM |
| **TOTAL (Prod)** | | **€78-163/mo** | **€66-151/mo** | Same as dev |

### Cost Optimization Strategies

1. **Reserved Instance (1-year commitment)**
   - B2s VM: €30/mo → **€18/mo** (40% savings = €12/mo)
   - Annual savings: €144

2. **Auto-shutdown (Dev environment)**
   - Shut down nights + weekends (50% uptime)
   - Savings: **€15-20/mo** on VM costs
   - Note: Does not reduce storage/PostgreSQL costs

3. **Combined Savings (Reserved + Auto-shutdown)**
   - Dev environment: **€46-76/mo** (€27-37/mo savings)
   - Prod environment: **€66-151/mo** (reserved instance only)

### Cost Comparison: VM vs Container Apps

| Architecture | Monthly Cost | Pros | Cons |
|--------------|--------------|------|------|
| **VM (B2s)** | €78-163 | • Predictable costs<br>• Full SSH access<br>• Simpler architecture<br>• No ACR costs | • Manual scaling<br>• Higher maintenance<br>• No auto-scale |
| **Container Apps** | €85-135 | • Auto-scale<br>• Multi-region ready<br>• Zero-ops infrastructure | • Higher minimum cost<br>• ACR required (€4.25/mo)<br>• Less control |

**Recommendation:** VM for MVP (similar cost, more control), migrate to Container Apps if auto-scale is needed.

## Prerequisites

1. **Azure CLI** (logged in with contributor role)
2. **Docker** (for building images)
3. **SSH key pair** (for VM access)
4. **Environment variables** (see [VM_DEPLOYMENT_ENV_VARS.md](../../docs/guides/VM_DEPLOYMENT_ENV_VARS.md) for details):
   
   **Option A: Use helper script (recommended):**
   ```bash
   # Automatically loads variables from apps/api/.env
   source ./scripts/set-deployment-env.sh
   ```
   
   **Option B: Manual setup:**
   ```bash
   export SSH_PUBLIC_KEY="$(cat ~/.ssh/id_rsa.pub)"
   export POSTGRES_ADMIN_PASSWORD="$(openssl rand -base64 32)"
   export JWT_SECRET="$(openssl rand -base64 64)"
   export REFRESH_TOKEN_SECRET="$(openssl rand -base64 64)"
   export AZURE_OPENAI_API_KEY="your-api-key"
   ```
   export AZURE_OPENAI_API_KEY="your-api-key"
   ```

## Deployment

### Option 1: Automated Deployment Script

```bash
# Full deployment (provision + build + deploy + migrate)
./scripts/deploy-vm.sh

# Provision infrastructure only
PROVISION_INFRA=true BUILD_IMAGES=false DEPLOY_APP=false ./scripts/deploy-vm.sh

# Deploy application only (skip infrastructure)
PROVISION_INFRA=false BUILD_IMAGES=true DEPLOY_APP=true ./scripts/deploy-vm.sh
```

### Option 2: Manual Step-by-Step

#### Step 1: Provision Infrastructure

```bash
cd infra/azure

# Update parameters in main.vm.bicepparam
# - Set sshPublicKey
# - Set PostgreSQL password
# - Set JWT secrets
# - Set Azure OpenAI credentials

# Deploy
az deployment sub create \
  --name "smartapply-vm-$(date +%Y%m%d-%H%M%S)" \
  --location westeurope \
  --template-file main-vm.bicep \
  --parameters main.vm.bicepparam

# Get outputs
az deployment sub show \
  --name "smartapply-vm-$(date +%Y%m%d-%H%M%S)" \
  --query properties.outputs
```

#### Step 2: Build Docker Images

```bash
cd /path/to/smart-apply

# Build API image
docker build -f infra/Dockerfile -t smart-apply-api:latest .

# Export for transfer
docker save smart-apply-api:latest | gzip > api-image.tar.gz
```

#### Step 3: Deploy to VM

```bash
# Get VM FQDN
VM_FQDN=$(az network public-ip show \
  -g smartapply-dev-rg \
  -n smartapply-dev-ip \
  --query dnsSettings.fqdn -o tsv)

# Transfer image
scp api-image.tar.gz azureuser@$VM_FQDN:/tmp/

# Transfer docker-compose config
scp infra/docker-compose.prod.yml azureuser@$VM_FQDN:/opt/smart-apply/docker-compose.yml

# SSH to VM and deploy
ssh azureuser@$VM_FQDN

# On VM:
cd /opt/smart-apply

# Update secrets from Key Vault
export VAULT_NAME="smartapply-dev-kv"
sudo -E /opt/smart-apply/scripts/update-secrets.sh

# Load and start containers
docker load < /tmp/api-image.tar.gz
docker-compose down
docker-compose up -d

# Run migrations
docker exec smart-apply-api npx prisma migrate deploy
```

#### Step 4: Configure SSL (Let's Encrypt)

```bash
# SSH to VM
ssh azureuser@$VM_FQDN

# Install SSL certificate
sudo certbot --nginx -d api.smartapply.com --non-interactive --agree-tos -m admin@smartapply.com

# Test auto-renewal
sudo certbot renew --dry-run
```

## Operations

### Monitoring

#### System Metrics (Azure Monitor)
- CPU utilization
- Memory usage
- Disk I/O
- Network traffic

#### Application Logs
```bash
# SSH to VM
ssh azureuser@$VM_FQDN

# View container logs
docker logs smart-apply-api -f

# View Nginx logs
sudo tail -f /var/log/nginx/smart-apply-access.log
sudo tail -f /var/log/nginx/smart-apply-error.log

# View audit logs (Winston)
sudo tail -f /opt/smart-apply/logs/combined.log
sudo tail -f /opt/smart-apply/logs/security.log
```

#### Health Checks
```bash
# API health
curl https://api.smartapply.com/api/v1/health/live
curl https://api.smartapply.com/api/v1/health/ready

# Container status
ssh azureuser@$VM_FQDN docker ps

# System resources
ssh azureuser@$VM_FQDN 'df -h && free -h && uptime'
```

### Scaling

#### Vertical Scaling (Resize VM)
```bash
# Stop VM
az vm deallocate -g smartapply-dev-rg -n smartapply-dev-vm

# Resize to D2s_v5 (2 vCPU, 8GB RAM)
az vm resize -g smartapply-dev-rg -n smartapply-dev-vm --size Standard_D2s_v5

# Start VM
az vm start -g smartapply-dev-rg -n smartapply-dev-vm

# Downtime: ~5 minutes
```

#### Horizontal Scaling (Add VMs)
- Deploy second VM with same configuration
- Add Azure Load Balancer (€15/mo)
- Update Nginx on both VMs to health-check enabled
- Update DNS to load balancer IP

### Backup & Disaster Recovery

#### Automated Backups
- **PostgreSQL:** Automated daily backups (7-day retention, included in price)
- **VM Disk:** Azure Backup (optional, €5/mo for 30-day retention)
- **Application Code:** Git repository (source of truth)

#### Backup Script
```bash
# Enable Azure Backup for VM
az backup protection enable-for-vm \
  --resource-group smartapply-dev-rg \
  --vault-name smartapply-backup-vault \
  --vm smartapply-dev-vm \
  --policy-name DefaultPolicy
```

#### Recovery Procedure
```bash
# 1. Restore VM from backup (RTO: ~20 minutes)
az backup restore restore-disks \
  --resource-group smartapply-dev-rg \
  --vault-name smartapply-backup-vault \
  --container-name smartapply-dev-vm \
  --item-name smartapply-dev-vm \
  --restore-to-staging-storage-account smartapplystorage

# 2. Create new VM from restored disk
az vm create \
  --resource-group smartapply-dev-rg \
  --name smartapply-dev-vm-restored \
  --attach-os-disk <restored-disk-id>

# 3. Re-assign public IP and update DNS
```

### Maintenance

#### OS Updates (Automatic)
- Configured in cloud-init: `unattended-upgrades`
- Security patches applied automatically
- VM reboots only if required (controlled by patch settings)

#### Application Updates
```bash
# Build new image locally
docker build -f infra/Dockerfile -t smart-apply-api:v1.2.0 .

# Export and transfer
docker save smart-apply-api:v1.2.0 | gzip > api-image.tar.gz
scp api-image.tar.gz azureuser@$VM_FQDN:/tmp/

# Deploy (zero-downtime with health checks)
ssh azureuser@$VM_FQDN << 'EOF'
  cd /opt/smart-apply
  docker load < /tmp/api-image.tar.gz
  docker-compose up -d --no-deps api
  docker exec smart-apply-api npx prisma migrate deploy
EOF
```

#### Rollback Procedure
```bash
# SSH to VM
ssh azureuser@$VM_FQDN

# View available images
docker images | grep smart-apply-api

# Rollback to previous version
export DOCKER_IMAGE_API=smart-apply-api:v1.1.0
docker-compose up -d --no-deps api
```

## Security

### Network Security
- **NSG Rules:** Restrictive inbound (443, 80, 22), allow Azure services outbound
- **SSH Access:** Public key authentication only (password disabled)
- **HTTPS:** Let's Encrypt SSL certificates (auto-renewed)
- **Firewall:** UFW enabled (default deny, allow 22/80/443)

### Identity & Access
- **Managed Identity:** VM uses system-assigned identity (no credentials in code)
- **RBAC:**
  - Key Vault Secrets User (read secrets)
  - Storage Blob Data Contributor (read/write PDFs)
  - Service Bus Data Owner (send/receive messages)

### Secrets Management
- **Storage:** Azure Key Vault (geo-replicated, audit logs)
- **Retrieval:** Managed Identity via Azure CLI (`az keyvault secret show`)
- **Rotation:** Manual (update Key Vault → run `update-secrets.sh`)

### Compliance
- **Encryption at rest:** Azure Managed Disks (enabled by default)
- **Encryption in transit:** TLS 1.2+ (Nginx + Azure services)
- **Audit logging:** Winston logs (90-day retention, `/opt/smart-apply/logs/security.log`)
- **PII handling:** No PII in logs (sanitized by Winston transport)

## Troubleshooting

### Container Won't Start
```bash
# Check container logs
docker logs smart-apply-api

# Check environment variables
docker exec smart-apply-api env | grep DATABASE_URL

# Verify database connection
docker exec smart-apply-api npx prisma db pull
```

### High CPU/Memory Usage
```bash
# Check resource usage
docker stats

# Check Chromium processes
docker exec smart-apply-api ps aux | grep chromium

# Restart container (clears Chromium orphans)
docker-compose restart api
```

### SSL Certificate Issues
```bash
# Renew certificate manually
sudo certbot renew --force-renewal

# Check certificate expiry
sudo certbot certificates

# Test Nginx config
sudo nginx -t
sudo systemctl reload nginx
```

### Database Connection Errors
```bash
# Check PostgreSQL firewall rules
az postgres flexible-server firewall-rule list \
  -g smartapply-dev-rg \
  -n smartapply-dev-postgres

# Add VM subnet to firewall
az postgres flexible-server firewall-rule create \
  -g smartapply-dev-rg \
  -n smartapply-dev-postgres \
  --rule-name allow-vm-subnet \
  --start-ip-address 10.0.1.0 \
  --end-ip-address 10.0.1.255
```

## CI/CD Integration

### GitHub Actions Workflow

See `.github/workflows/deploy-azure-vm.yml` for automated deployment:

1. Build Docker images in GitHub Actions runner
2. Save images as tar.gz artifacts
3. Transfer to VM via SSH (using GitHub Secrets for SSH key)
4. Load images and restart containers
5. Run migrations
6. Health check
7. Notify deployment status (Slack/Teams/Email)

### Required Secrets
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (OIDC auth)
- `VM_SSH_PRIVATE_KEY` (for SCP/SSH deployment)
- `VM_FQDN` (e.g., smartapply-dev-vm.westeurope.cloudapp.azure.com)
- `KEY_VAULT_NAME` (e.g., smartapply-dev-kv)

## Migration from Container Apps

If migrating from existing Container Apps deployment:

1. **Export Data:**
   ```bash
   # Backup PostgreSQL database
   pg_dump -h <container-apps-postgres> -U admin -d smartapply > backup.sql
   ```

2. **Provision VM Infrastructure:**
   ```bash
   ./scripts/deploy-vm.sh
   ```

3. **Restore Data:**
   ```bash
   # Import to new PostgreSQL
   psql -h <vm-postgres> -U smartapply_admin -d smartapply < backup.sql
   ```

4. **Update DNS:**
   ```bash
   # Point api.smartapply.com to VM IP
   # Wait for TTL propagation (~1 hour)
   ```

5. **Decommission Container Apps:**
   ```bash
   az containerapp delete -g smartapply-prod-rg -n smartapply-prod-api
   az acr delete -g smartapply-prod-rg -n smartapplyacr
   ```

## Support

For issues or questions:
- **GitHub Issues:** https://github.com/Ar1anit/smart-apply/issues
- **Deployment Logs:** `/opt/smart-apply/logs/combined.log`
- **Azure Support:** Create support ticket in Azure Portal
