#!/bin/bash
#
# Azure Deployment Quick Start Script
# This script automates the initial Azure infrastructure provisioning
#
# Usage: ./deploy-azure.sh [environment]
# Example: ./deploy-azure.sh prod

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

log_success() {
    echo -e "${GREEN}✅ ${NC}$1"
}

log_warning() {
    echo -e "${YELLOW}⚠️  ${NC}$1"
}

log_error() {
    echo -e "${RED}❌ ${NC}$1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI not found. Please install: https://docs.microsoft.com/cli/azure/install-azure-cli"
        exit 1
    fi
    log_success "Azure CLI installed: $(az version --query '"azure-cli"' -o tsv)"
    
    # Check Bicep CLI
    if ! az bicep version &> /dev/null; then
        log_warning "Bicep CLI not found. Installing..."
        az bicep install
    fi
    log_success "Bicep CLI installed: $(az bicep version)"
    
    # Check logged in
    if ! az account show &> /dev/null; then
        log_error "Not logged in to Azure. Run: az login"
        exit 1
    fi
    log_success "Logged in to Azure"
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        log_success "Docker installed: $(docker --version)"
    else
        log_warning "Docker not found (optional for local testing)"
    fi
}

# Generate secrets
generate_secrets() {
    log_info "Generating secure secrets..."
    
    POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    REFRESH_TOKEN_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    
    log_success "Secrets generated successfully"
    
    # Save to temporary file
    SECRETS_FILE=".azure-secrets-$(date +%s).tmp"
    cat > "$SECRETS_FILE" <<EOF
# Azure Deployment Secrets - $(date)
# IMPORTANT: Store these securely (e.g., 1Password, LastPass) and delete this file!

POSTGRES_PASSWORD="$POSTGRES_PASSWORD"
JWT_SECRET="$JWT_SECRET"
REFRESH_TOKEN_SECRET="$REFRESH_TOKEN_SECRET"
EOF
    
    log_warning "Secrets saved to: $SECRETS_FILE"
    log_warning "IMPORTANT: Store these securely and delete the file after deployment!"
}

# Deploy infrastructure
deploy_infrastructure() {
    local environment=$1
    local location=${2:-"westeurope"}
    
    log_info "Deploying infrastructure to Azure..."
    log_info "Environment: $environment"
    log_info "Location: $location"
    
    # Navigate to infra directory
    cd infra/azure
    
    # Validate Bicep template
    log_info "Validating Bicep template..."
    az bicep build --file main.bicep
    log_success "Bicep template validated"
    
    # Update parameters file with generated secrets
    log_info "Updating parameters file..."
    cat > "main.${environment}.bicepparam" <<EOF
using './main.bicep'

param environment = '$environment'
param location = '$location'
param appName = 'smartapply'

// Database credentials
param postgresAdminUsername = 'sqladmin'
param postgresAdminPassword = '$POSTGRES_PASSWORD'

// Security secrets
param jwtSecret = '$JWT_SECRET'
param refreshTokenSecret = '$REFRESH_TOKEN_SECRET'

// Frontend URL (update after frontend deployment)
param frontendUrl = 'https://smartapply.vercel.app'

// Azure OpenAI (optional)
param openAiDeploymentName = 'gpt-4o'
param enableAzureOpenAI = false
EOF
    
    # Deploy to Azure
    log_info "Starting Azure deployment (this takes 10-15 minutes)..."
    DEPLOYMENT_NAME="smartapply-${environment}-$(date +%Y%m%d-%H%M%S)"
    
    az deployment sub create \
        --location "$location" \
        --template-file main.bicep \
        --parameters "main.${environment}.bicepparam" \
        --name "$DEPLOYMENT_NAME" \
        --output table
    
    log_success "Infrastructure deployed successfully!"
    
    # Get deployment outputs
    log_info "Retrieving deployment outputs..."
    
    RESOURCE_GROUP=$(az deployment sub show \
        --name "$DEPLOYMENT_NAME" \
        --query properties.outputs.resourceGroupName.value -o tsv)
    
    ACR_NAME=$(az deployment sub show \
        --name "$DEPLOYMENT_NAME" \
        --query properties.outputs.containerRegistryName.value -o tsv)
    
    API_URL=$(az deployment sub show \
        --name "$DEPLOYMENT_NAME" \
        --query properties.outputs.apiUrl.value -o tsv)
    
    KEY_VAULT_NAME=$(az deployment sub show \
        --name "$DEPLOYMENT_NAME" \
        --query properties.outputs.keyVaultUri.value -o tsv | sed 's|https://||;s|/||;s|.vault.azure.net||')
    
    # Print summary
    echo ""
    log_success "==================================================="
    log_success "   DEPLOYMENT SUCCESSFUL! 🚀"
    log_success "==================================================="
    echo ""
    log_info "Resource Group: $RESOURCE_GROUP"
    log_info "Container Registry: $ACR_NAME"
    log_info "Key Vault: $KEY_VAULT_NAME"
    log_info "API URL: $API_URL (after first deployment)"
    echo ""
    
    # Save outputs to file
    OUTPUTS_FILE="../../.azure-outputs-${environment}.txt"
    cat > "$OUTPUTS_FILE" <<EOF
# Azure Deployment Outputs - $(date)

RESOURCE_GROUP=$RESOURCE_GROUP
ACR_NAME=$ACR_NAME
KEY_VAULT_NAME=$KEY_VAULT_NAME
API_URL=$API_URL
DEPLOYMENT_NAME=$DEPLOYMENT_NAME

# To deploy the application:
# 1. Set up GitHub Actions secrets (see docs/guides/AZURE_DEPLOYMENT.md)
# 2. Push to '$environment' branch
# 3. Monitor deployment: https://github.com/YOUR_USERNAME/smart-apply/actions
EOF
    
    log_success "Outputs saved to: $OUTPUTS_FILE"
    
    # Return to root
    cd ../..
}

# Create GitHub Actions secrets helper
create_github_secrets_script() {
    local environment=$1
    
    log_info "Creating GitHub secrets helper script..."
    
    cat > ".github-secrets-${environment}.sh" <<'EOF'
#!/bin/bash
# GitHub Secrets Setup Script
# Run this after creating Azure Service Principal

# Replace these values:
AZURE_CLIENT_ID="YOUR_CLIENT_ID"
AZURE_TENANT_ID="YOUR_TENANT_ID"
AZURE_SUBSCRIPTION_ID="YOUR_SUBSCRIPTION_ID"
AZURE_CONTAINER_REGISTRY="smartapplyprodacr"  # Without .azurecr.io

# Set secrets using GitHub CLI
gh secret set AZURE_CLIENT_ID --body "$AZURE_CLIENT_ID"
gh secret set AZURE_TENANT_ID --body "$AZURE_TENANT_ID"
gh secret set AZURE_SUBSCRIPTION_ID --body "$AZURE_SUBSCRIPTION_ID"
gh secret set AZURE_CONTAINER_REGISTRY --body "$AZURE_CONTAINER_REGISTRY"

echo "✅ GitHub secrets configured!"
EOF
    
    chmod +x ".github-secrets-${environment}.sh"
    log_success "GitHub secrets helper created: .github-secrets-${environment}.sh"
}

# Main execution
main() {
    local environment=${1:-"prod"}
    local location=${2:-"westeurope"}
    
    echo ""
    log_info "==================================================="
    log_info "   Smart Apply - Azure Deployment"
    log_info "==================================================="
    echo ""
    
    # Confirm with user
    log_warning "This will deploy infrastructure to Azure."
    log_warning "Environment: $environment"
    log_warning "Location: $location"
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Deployment cancelled"
        exit 1
    fi
    
    # Execute steps
    check_prerequisites
    generate_secrets
    deploy_infrastructure "$environment" "$location"
    create_github_secrets_script "$environment"
    
    echo ""
    log_success "==================================================="
    log_success "   NEXT STEPS"
    log_success "==================================================="
    echo ""
    log_info "1. Store secrets securely (see .azure-secrets-*.tmp)"
    log_info "2. Create Azure Service Principal for GitHub Actions:"
    log_info "   See: docs/guides/AZURE_DEPLOYMENT.md#step-31"
    echo ""
    log_info "3. Configure GitHub secrets:"
    log_info "   Edit and run: .github-secrets-${environment}.sh"
    echo ""
    log_info "4. Push to '$environment' branch to trigger deployment:"
    log_info "   git push origin $environment"
    echo ""
    log_info "Full guide: docs/guides/AZURE_DEPLOYMENT.md"
    echo ""
}

# Run main function
main "$@"
