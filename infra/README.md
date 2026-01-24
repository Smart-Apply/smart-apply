# Smart Apply - Infrastructure Documentation

This directory contains infrastructure-as-code (IaC) for deploying Smart Apply to Azure.

## Deployment Options

### Option 1: Azure VM (Recommended for MVP) 🆕

**Cost:** €78-163/mo (€66-151/mo with reserved instance)

**Pros:**

- ✅ Predictable costs
- ✅ Full SSH access for debugging
- ✅ Simpler architecture (no ACR, no Container Apps)
- ✅ docker-compose for orchestration (API + Frontend)
- ✅ Same cost as Container Apps

**Cons:**

- ⚠️ Manual scaling (resize VM or add load balancer)
- ⚠️ Higher operational maintenance
- ⚠️ No built-in auto-scale

**Files:**

- `azure/main-vm.bicep` - VM infrastructure orchestration
- `azure/main.vm.bicepparam` - VM deployment parameters
- `azure/modules/virtual-machine.bicep` - VM module
- `azure/modules/network-security-group.bicep` - NSG rules
- `azure/modules/virtual-network.bicep` - VNet with subnets
- `azure/modules/public-ip.bicep` - Static public IP
- `azure/modules/rbac-assignments.bicep` - Managed Identity RBAC
- `azure/cloud-init.yaml` - VM initialization script
- `docker-compose.prod.yml` - Production docker-compose config
- `../scripts/deploy-vm.sh` - Automated deployment script

**Documentation:** [VM_DEPLOYMENT.md](./azure/VM_DEPLOYMENT.md)

**Quick Start:**

```bash
# Set environment variables
export SSH_PUBLIC_KEY="$(cat ~/.ssh/id_rsa.pub)"
export POSTGRES_ADMIN_PASSWORD="$(openssl rand -base64 32)"
export JWT_SECRET="$(openssl rand -base64 64)"
export REFRESH_TOKEN_SECRET="$(openssl rand -base64 64)"
export AZURE_OPENAI_API_KEY="your-api-key"

# Deploy everything
./scripts/deploy-vm.sh
```

---

### Option 2: Azure Container Apps (Original)

**Cost:** €85-135/mo

**Pros:**

- ✅ Auto-scale (0-N replicas)
- ✅ Multi-region ready
- ✅ Zero-ops infrastructure (fully managed)
- ✅ Built-in health probes and traffic splitting

**Cons:**

- ⚠️ Higher minimum cost
- ⚠️ Requires Azure Container Registry (€4.25/mo)
- ⚠️ Less control over infrastructure
- ⚠️ No SSH access for debugging

**Files:**

- `azure/main.bicep` - Container Apps orchestration
- `azure/main.bicepparam` - Container Apps parameters
- `azure/modules/container-app.bicep` - Backend API container app
- `azure/modules/container-app-web.bicep` - Frontend container app
- `azure/modules/container-environment.bicep` - Container Apps environment
- `azure/modules/container-registry.bicep` - Azure Container Registry

**Documentation:** [AZURE_DEPLOYMENT.md](../docs/guides/AZURE_DEPLOYMENT.md)

**Quick Start:**

```bash
# Build and push images
docker build -f infra/Dockerfile -t smartapplyacr.azurecr.io/smart-apply-api:latest .
docker push smartapplyacr.azurecr.io/smart-apply-api:latest

# Deploy infrastructure
az deployment sub create \
  --location westeurope \
  --template-file infra/azure/main.bicep \
  --parameters infra/azure/main.bicepparam
```

---

## Shared Azure Resources

Both deployment options use these services:

| Service                        | Purpose                 | Monthly Cost       |
| ------------------------------ | ----------------------- | ------------------ |
| **PostgreSQL Flexible Server** | Application database    | €18                |
| **Storage Account (Blob)**     | PDF document storage    | €2                 |
| **Service Bus**                | Background job queue    | €0.05              |
| **Key Vault**                  | Secrets management      | €0.50              |
| **Azure OpenAI**               | LLM for CV/cover letter | €20-100 (variable) |

**Shared modules:**

- `azure/modules/postgresql.bicep`
- `azure/modules/storage.bicep`
- `azure/modules/service-bus.bicep`
- `azure/modules/key-vault.bicep`
- `azure/modules/key-vault-secrets.bicep`
- `azure/modules/log-analytics.bicep`

---

## Comparison Table

| Feature         | VM Deployment       | Container Apps         |
| --------------- | ------------------- | ---------------------- |
| **Cost (Dev)**  | €78-163/mo          | €85-135/mo             |
| **Cost (Prod)** | €78-163/mo          | €85-135/mo             |
| **Auto-scale**  | ❌ Manual           | ✅ Automatic           |
| **SSH Access**  | ✅ Full access      | ❌ No direct access    |
| **Deployment**  | docker-compose      | Container image push   |
| **Scaling**     | Resize VM (~5min)   | Instant (0-N replicas) |
| **Maintenance** | OS patching, Docker | Fully managed          |
| **Complexity**  | Low-Medium          | Medium-High            |
| **Best for**    | MVP, cost control   | Production, auto-scale |

---

## Migration Path

### Container Apps → VM

1. Export PostgreSQL data
2. Deploy VM infrastructure with `deploy-vm.sh`
3. Restore PostgreSQL data
4. Update DNS to VM IP
5. Decommission Container Apps

### VM → Container Apps

1. Build and push images to ACR
2. Deploy Container Apps infrastructure
3. Update DNS to Container Apps URL
4. Decommission VM

---

## Cost Optimization Tips

### VM Deployment

- ✅ Reserved instance (1-year): **€12/mo savings** (40% off VM)
- ✅ Auto-shutdown dev environment: **€15-20/mo savings** (50% uptime)
- ✅ Use Standard_B1s for low-traffic dev: **€7/mo** (1 vCPU, 1GB RAM)

### Container Apps

- ✅ Scale to zero: **Free when idle** (dev environment)
- ✅ Use Basic tier for dev: **€10-20/mo** (0.25 vCPU minimum)

---

## Support

- **VM Deployment Issues:** See [VM_DEPLOYMENT.md](./azure/VM_DEPLOYMENT.md) troubleshooting
- **Container Apps Issues:** See [AZURE_DEPLOYMENT.md](../docs/guides/AZURE_DEPLOYMENT.md)
- **GitHub Issues:** <https://github.com/Ar1anit/smart-apply/issues>
