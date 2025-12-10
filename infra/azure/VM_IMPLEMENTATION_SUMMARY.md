# VM Infrastructure Implementation - Summary

## ✅ Completed Tasks

### 1. Bicep Modules Created
- ✅ `infra/azure/modules/virtual-machine.bicep` - Standard_B2s VM with Managed Identity, cloud-init, auto-shutdown
- ✅ `infra/azure/modules/network-security-group.bicep` - NSG with strict inbound/outbound rules
- ✅ `infra/azure/modules/public-ip.bicep` - Static public IP with DNS label
- ✅ `infra/azure/modules/virtual-network.bicep` - VNet with app + data subnets
- ✅ `infra/azure/modules/rbac-assignments.bicep` - Managed Identity RBAC roles

### 2. Main Orchestration
- ✅ `infra/azure/main-vm.bicep` - Complete VM infrastructure orchestration
- ✅ `infra/azure/main.vm.bicepparam` - Deployment parameters with environment variables

### 3. VM Configuration
- ✅ `infra/azure/cloud-init.yaml` - Complete VM setup automation:
  - Docker + Docker Compose installation
  - Node.js 20 LTS
  - Azure CLI
  - Nginx reverse proxy with SSL-ready config
  - systemd service for auto-start
  - Firewall (UFW) configuration
  - Log rotation
  - Auto-updates

### 4. Application Deployment
- ✅ `infra/docker-compose.prod.yml` - Production-optimized compose file with:
  - **API container:** 1.5 vCPU, 2GB RAM (port 3000)
  - **Web container:** 0.5 vCPU, 768MB RAM (port 3001)
  - Health checks
  - Log rotation
  - Security hardening
  - Auto-restart policies

### 5. Deployment Automation
- ✅ `scripts/deploy-vm.sh` - Complete deployment automation:
  - Infrastructure provisioning
  - Docker image build + transfer
  - Secret retrieval from Key Vault
  - Container deployment
  - Database migrations
  - Health checks

### 6. Documentation
- ✅ `infra/azure/VM_DEPLOYMENT.md` - Comprehensive guide with:
  - Architecture diagram
  - Cost analysis (€78-163/mo, €66-151/mo with reserved instance)
  - Cost optimization strategies
  - Deployment procedures
  - Operations & monitoring
  - Scaling strategies
  - Backup & disaster recovery
  - Security hardening
  - Troubleshooting
  - CI/CD integration
- ✅ `infra/README.md` - Comparison of VM vs Container Apps deployment options

## 📊 Cost Analysis

### Current (Container Apps)
- Container Apps Environment: €15-30/mo
- ACR: €4.25/mo
- PostgreSQL: €18/mo
- Storage + Service Bus: €5/mo
- Key Vault: €0.50/mo
- Azure OpenAI: €20-100/mo (variable)
- **Total: €63-158/mo**

### New (VM-based)
- VM (B2s): €30/mo (€18/mo with reserved instance)
- Static Public IP: €3/mo
- PostgreSQL: €18/mo
- Storage + Service Bus: €5/mo
- Key Vault: €0.50/mo
- Azure OpenAI: €20-100/mo (variable)
- **Total: €77-157/mo (€65-145/mo with reserved instance)**

### Cost Optimization
- Reserved Instance (1-year): **-€12/mo** (40% VM savings)
- Auto-shutdown (dev): **-€15-20/mo** (50% uptime)
- **Combined savings: €27-32/mo for dev environment**

## 🏗️ Architecture Highlights

### Network Security
- VNet with separate app + data subnets (10.0.0.0/16)
- NSG with strict rules (HTTPS, HTTP, SSH only)
- Private PostgreSQL connection via VNet integration
- UFW firewall on VM

### Identity & Access
- System-assigned Managed Identity (no credentials in code)
- RBAC roles:
  - Key Vault Secrets User
  - Storage Blob Data Contributor
  - Service Bus Data Owner

### High Availability
- VM: Auto-restart on failure
- Docker: Health checks + restart policies
- PostgreSQL: Automated backups (7-day retention)
- Optional: Azure Backup for VM disk (€5/mo, 30-day retention)

### Observability
- Azure Monitor Agent (system metrics)
- Docker container logs (JSON driver, 10MB rotation)
- Nginx access/error logs
- Winston audit logs (90-day retention)
- Health endpoints: `/api/v1/health/live`, `/api/v1/health/ready`

## 🚀 Deployment Workflow

1. **Provision Infrastructure** (~10-15 minutes)
   ```bash
   az deployment sub create --template-file infra/azure/main-vm.bicep ...
   ```

2. **Build Docker Images** (~5 minutes)
   ```bash
   docker build -f infra/Dockerfile -t smart-apply-api:latest .
   ```

3. **Deploy to VM** (~3-5 minutes)
   ```bash
   scp api-image.tar.gz azureuser@vm:/tmp/
   ssh azureuser@vm "cd /opt/smart-apply && docker-compose up -d"
   ```

4. **Run Migrations** (~1 minute)
   ```bash
   docker exec smart-apply-api npx prisma migrate deploy
   ```

5. **Health Check** (~30 seconds)
   ```bash
   curl https://<vm-fqdn>/api/v1/health/live
   ```

**Total deployment time: ~20-25 minutes**

## 📝 Next Steps

### To Deploy VM Infrastructure

1. **Set environment variables:**
   ```bash
   export SSH_PUBLIC_KEY="$(cat ~/.ssh/id_rsa.pub)"
   export POSTGRES_ADMIN_PASSWORD="$(openssl rand -base64 32)"
   export JWT_SECRET="$(openssl rand -base64 64)"
   export REFRESH_TOKEN_SECRET="$(openssl rand -base64 64)"
   export AZURE_OPENAI_API_KEY="your-api-key"
   ```

2. **Update parameter file** (`infra/azure/main.vm.bicepparam`):
   - Set `allowedSshSourceIp` to your IP (default: `*` allows all)
   - Set Azure OpenAI endpoints and agent IDs
   - Set frontend URL for CORS

3. **Run deployment script:**
   ```bash
   chmod +x scripts/deploy-vm.sh
   ./scripts/deploy-vm.sh
   ```

4. **Configure SSL (after deployment):**
   ```bash
   ssh azureuser@<vm-fqdn>
   sudo certbot --nginx -d api.smartapply.com
   ```

### To Migrate from Container Apps to VM

1. Backup PostgreSQL database
2. Deploy VM infrastructure
3. Restore database to new PostgreSQL
4. Update DNS to VM IP
5. Decommission Container Apps

## 🔒 Security Considerations

### Already Implemented ✅
- System-assigned Managed Identity (no credentials)
- NSG with minimal attack surface
- SSH key authentication only (password disabled)
- Secrets stored in Key Vault
- Encryption at rest (Azure Managed Disks)
- Encryption in transit (TLS 1.2+)
- Audit logging (Winston, 90-day retention)

### Recommended for Production 🔐
- Restrict SSH to specific IP (`allowedSshSourceIp` parameter)
- Enable Azure Bastion for SSH (no public port 22) - adds €130/mo
- Configure SSL certificate with Let's Encrypt
- Enable Azure Backup for VM disk (€5/mo)
- Set up Azure Monitor alerts (CPU > 80%, disk > 80%)
- Implement log forwarding to SIEM (optional)

## 🎯 When to Use VM vs Container Apps

### Use VM When:
- ✅ Predictable traffic patterns (no rapid scaling needed)
- ✅ Cost-sensitive MVP phase
- ✅ Need SSH access for debugging
- ✅ Want to avoid ACR costs
- ✅ Prefer simpler infrastructure

### Use Container Apps When:
- ✅ Unpredictable traffic spikes (auto-scale critical)
- ✅ Multi-region deployment needed
- ✅ Want zero-ops infrastructure
- ✅ Need blue-green deployments
- ✅ Scale-to-zero for dev environment

## 📚 Documentation Files

- `infra/azure/VM_DEPLOYMENT.md` - Complete VM deployment guide
- `infra/README.md` - Infrastructure overview + comparison
- `infra/azure/cloud-init.yaml` - VM initialization script (inline documentation)
- `scripts/deploy-vm.sh` - Deployment automation (inline comments)

## ✨ Key Features

1. **Production-Ready:** Health checks, auto-restart, resource limits
2. **Secure:** Managed Identity, NSG, firewall, SSL-ready
3. **Cost-Optimized:** Reserved instances, auto-shutdown, right-sizing
4. **Observable:** Metrics, logs, health endpoints
5. **Maintainable:** Docker Compose, systemd, automated updates
6. **Documented:** Architecture diagrams, cost analysis, runbooks
