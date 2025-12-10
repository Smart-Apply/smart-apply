# VM Deployment - Environment Variables Reference

This document lists all environment variables used in the VM deployment process and how to set them.

## Quick Start

### Option 1: Use the Helper Script (Recommended)

The easiest way to set all required environment variables from your `.env` file:

```bash
# Source the environment setup script
source ./scripts/set-deployment-env.sh

# Run deployment
./scripts/deploy-vm.sh
```

This script will:
- ✅ Load your SSH public key automatically
- ✅ Extract Azure OpenAI settings from `apps/api/.env`
- ✅ Extract Azure AI Foundry agent IDs from `apps/api/.env`
- ✅ Generate secure passwords for PostgreSQL
- ✅ Use existing JWT secrets or generate new ones

### Option 2: Manual Setup

Set each variable manually before deployment:

```bash
# Required Variables
export SSH_PUBLIC_KEY="$(cat ~/.ssh/id_rsa.pub)"
export POSTGRES_ADMIN_PASSWORD="$(openssl rand -base64 32)"
export JWT_SECRET="W6RmiuFMO31zEsEnb3sAV11YidxuResbW9RgcoJZVbril8M91cya5u/xeo9I5QnnbTt82oCwkXT8AaMJu7D3Dg=="
export REFRESH_TOKEN_SECRET="$(openssl rand -base64 64)"
export AZURE_OPENAI_API_KEY="BYYHbmL2SsdfPRXnnHA2VuKW8GymK3nEcAZrqIiL3eRlqfndij7TJQQJ99BKACYeBjFXJ3w3AAAAACOGzQKD"

# Optional (have defaults)
export POSTGRES_ADMIN_USERNAME="smartapply_admin"
export AZURE_OPENAI_ENDPOINT="https://smart-apply-test-ai.services.ai.azure.com/"
export AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4.1"
export AZURE_OPENAI_API_VERSION="2024-10-21"
export PROJECT_ENDPOINT="https://smart-apply-test-ai.services.ai.azure.com/api/projects/smartApplytest"
export CV_WRITER_AGENT_ID="asst_ZLNYVwISUTw93NA2Yq53ZW1G"
export CL_WRITER_AGENT_ID="asst_wXDlhHUsjgnaF6MPOsoSPoCy"
export ATS_AGENT_ID="asst_Jn2tlDlX3ZhzVIQhhw5Qa57W"

# Deploy
./scripts/deploy-vm.sh
```

## Environment Variables Reference

### Required Variables

These MUST be set before deployment:

| Variable | Description | How to Generate | Example |
|----------|-------------|-----------------|---------|
| `SSH_PUBLIC_KEY` | Your SSH public key for VM access | `cat ~/.ssh/id_rsa.pub` | `ssh-rsa AAAAB3NzaC1...` |
| `POSTGRES_ADMIN_PASSWORD` | PostgreSQL admin password | `openssl rand -base64 32` | `8kJ9mL3...` |
| `JWT_SECRET` | JWT secret for access tokens | Use existing from `.env` or `openssl rand -base64 64` | `W6RmiuFMO31z...` |
| `REFRESH_TOKEN_SECRET` | JWT secret for refresh tokens | `openssl rand -base64 64` | `xK8jL9...` |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | From Azure Portal or `.env` | `BYYHbmL2Ss...` |

### Optional Variables (Have Defaults)

These have sensible defaults but can be overridden:

| Variable | Default | Description | Source |
|----------|---------|-------------|--------|
| `POSTGRES_ADMIN_USERNAME` | `smartapply_admin` | PostgreSQL admin username | N/A |
| `AZURE_OPENAI_ENDPOINT` | From `.env` | Azure OpenAI endpoint URL | `apps/api/.env` |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | `gpt-4.1` | Azure OpenAI model deployment | `apps/api/.env` |
| `AZURE_OPENAI_API_VERSION` | `2024-10-21` | Azure OpenAI API version | `apps/api/.env` |
| `PROJECT_ENDPOINT` | From `.env` | Azure AI Foundry project endpoint | `apps/api/.env` |
| `CV_WRITER_AGENT_ID` | From `.env` | CV Writer agent ID | `apps/api/.env` |
| `CL_WRITER_AGENT_ID` | From `.env` | Cover Letter Writer agent ID | `apps/api/.env` |
| `ATS_AGENT_ID` | From `.env` | ATS Optimizer agent ID | `apps/api/.env` |

### Deployment Configuration Variables

These control the deployment behavior:

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `dev` | Environment name (dev, staging, prod) |
| `RESOURCE_GROUP` | `smartapply-{env}-rg` | Azure resource group name |
| `LOCATION` | `westeurope` | Azure region |
| `VM_NAME` | `smartapply-{env}-vm` | Virtual machine name |
| `VM_USER` | `azureuser` | VM admin username |
| `PROVISION_INFRA` | `true` | Whether to provision infrastructure |
| `BUILD_IMAGES` | `true` | Whether to build Docker images |
| `DEPLOY_APP` | `true` | Whether to deploy application |
| `RUN_MIGRATIONS` | `true` | Whether to run database migrations |

## Validation

The deployment script automatically validates:

1. ✅ **All required variables are set** - Script exits with error if any missing
2. ✅ **SSH key format** - Validates `ssh-rsa` or `ssh-ed25519` prefix
3. ✅ **Secret strength** - Ensures JWT secrets are at least 32 characters
4. ✅ **Tool availability** - Checks for Azure CLI, Docker, SSH, SCP

## Security Best Practices

### DO ✅

- **Use the helper script** - Automatically loads values from `.env`
- **Generate strong secrets** - Use `openssl rand -base64 64` for JWT secrets
- **Rotate secrets regularly** - Update PostgreSQL password every 90 days
- **Use SSH key authentication** - Never use password authentication
- **Store secrets in Key Vault** - After deployment, secrets are stored in Azure Key Vault

### DON'T ❌

- **Don't commit secrets to Git** - `.env` is in `.gitignore`
- **Don't reuse passwords** - Generate unique password for PostgreSQL
- **Don't use weak secrets** - Minimum 32 characters for JWT secrets
- **Don't share SSH keys** - Each developer should have their own key

## Troubleshooting

### "Missing required environment variables"

```bash
# Check which variables are missing
./scripts/deploy-vm.sh

# Use helper script to set all at once
source ./scripts/set-deployment-env.sh
```

### "SSH_PUBLIC_KEY does not appear to be a valid SSH public key"

```bash
# Generate new SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Export public key
export SSH_PUBLIC_KEY="$(cat ~/.ssh/id_ed25519.pub)"
```

### "JWT_SECRET is too short"

```bash
# Generate strong JWT secret (64 characters)
export JWT_SECRET="$(openssl rand -base64 64)"
export REFRESH_TOKEN_SECRET="$(openssl rand -base64 64)"
```

### "Azure OpenAI API key not found"

```bash
# Get from Azure Portal or use existing from .env
export AZURE_OPENAI_API_KEY="your-api-key-from-azure-portal"

# Or extract from .env
export AZURE_OPENAI_API_KEY=$(grep "^AZURE_OPENAI_API_KEY=" apps/api/.env | cut -d '=' -f2-)
```

## Example: Full Deployment

```bash
# Step 1: Set all environment variables
source ./scripts/set-deployment-env.sh

# Step 2: Verify variables are set
echo "SSH Key: ${SSH_PUBLIC_KEY:0:20}..."
echo "Postgres Password: ${POSTGRES_ADMIN_PASSWORD:0:10}..."
echo "JWT Secret: ${JWT_SECRET:0:20}..."
echo "Azure OpenAI: ${AZURE_OPENAI_ENDPOINT}"

# Step 3: Run deployment
./scripts/deploy-vm.sh

# Step 4: After deployment, configure SSL
VM_FQDN=$(az network public-ip show -g smartapply-dev-rg -n smartapply-dev-vm-ip --query dnsSettings.fqdn -o tsv)
ssh azureuser@$VM_FQDN
sudo certbot --nginx -d yourdomain.com
```

## Additional Resources

- **Main Deployment Guide:** [infra/azure/VM_DEPLOYMENT.md](../infra/azure/VM_DEPLOYMENT.md)
- **Infrastructure Overview:** [infra/README.md](../infra/README.md)
- **Bicep Parameters:** [infra/azure/main.vm.bicepparam](../infra/azure/main.vm.bicepparam)
- **Docker Compose:** [infra/docker-compose.prod.yml](../infra/docker-compose.prod.yml)
