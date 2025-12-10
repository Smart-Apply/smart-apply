#!/bin/bash
# ================================================================
# Smart Apply - VM Deployment Script
# ================================================================
# Deploys application to Azure VM:
# 1. Provision infrastructure (Bicep)
# 2. Build Docker images
# 3. Transfer to VM
# 4. Start containers
# 5. Run migrations
# 6. Health check
# ================================================================
#
# Required Environment Variables:
# --------------------------------
# SSH_PUBLIC_KEY              - Your SSH public key (e.g., $(cat ~/.ssh/id_rsa.pub))
# POSTGRES_ADMIN_PASSWORD     - PostgreSQL admin password (generate: openssl rand -base64 32)
# JWT_SECRET                  - JWT secret for access tokens (generate: openssl rand -base64 64)
# REFRESH_TOKEN_SECRET        - JWT secret for refresh tokens (generate: openssl rand -base64 64)
# AZURE_OPENAI_API_KEY        - Azure OpenAI API key
#
# Optional Environment Variables (have defaults from .env):
# ---------------------------------------------------------
# POSTGRES_ADMIN_USERNAME     - PostgreSQL admin username (default: smartapply_admin)
# AZURE_OPENAI_ENDPOINT       - Azure OpenAI endpoint URL
# AZURE_OPENAI_DEPLOYMENT_NAME - Azure OpenAI deployment/model name
# AZURE_OPENAI_API_VERSION    - Azure OpenAI API version
# PROJECT_ENDPOINT            - Azure AI Foundry project endpoint
# CV_WRITER_AGENT_ID          - CV Writer agent ID
# CL_WRITER_AGENT_ID          - Cover Letter Writer agent ID
# ATS_AGENT_ID                - ATS Optimizer agent ID
# ================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ================================================================
# Configuration
# ================================================================

ENVIRONMENT="${ENVIRONMENT:-dev}"
RESOURCE_GROUP="${RESOURCE_GROUP:-smartapply-${ENVIRONMENT}-rg}"
LOCATION="${LOCATION:-westeurope}"
VM_NAME="${VM_NAME:-smartapply-${ENVIRONMENT}-vm}"
VM_USER="${VM_USER:-azureuser}"
KEY_VAULT_NAME="${KEY_VAULT_NAME:-smartapply-${ENVIRONMENT}-kv}"

# ================================================================
# Environment Variables (Required for Bicep Deployment)
# ================================================================

# SSH Configuration
export SSH_PUBLIC_KEY="${SSH_PUBLIC_KEY:-}"

# Database Configuration
export POSTGRES_ADMIN_USERNAME="${POSTGRES_ADMIN_USERNAME:-smartapply_admin}"
export POSTGRES_ADMIN_PASSWORD="${POSTGRES_ADMIN_PASSWORD:-}"

# Security - JWT Secrets
export JWT_SECRET="${JWT_SECRET:-}"
export REFRESH_TOKEN_SECRET="${REFRESH_TOKEN_SECRET:-}"

# Azure OpenAI Configuration
export AZURE_OPENAI_ENDPOINT="${AZURE_OPENAI_ENDPOINT:-https://smart-apply-test-ai.services.ai.azure.com/}"
export AZURE_OPENAI_API_KEY="${AZURE_OPENAI_API_KEY:-}"
export AZURE_OPENAI_DEPLOYMENT_NAME="${AZURE_OPENAI_DEPLOYMENT_NAME:-gpt-4.1}"
export AZURE_OPENAI_API_VERSION="${AZURE_OPENAI_API_VERSION:-2024-10-21}"

# Azure AI Foundry Agents Configuration
export PROJECT_ENDPOINT="${PROJECT_ENDPOINT:-https://smart-apply-test-ai.services.ai.azure.com/api/projects/smartApplytest}"
export CV_WRITER_AGENT_ID="${CV_WRITER_AGENT_ID:-asst_ZLNYVwISUTw93NA2Yq53ZW1G}"
export CL_WRITER_AGENT_ID="${CL_WRITER_AGENT_ID:-asst_wXDlhHUsjgnaF6MPOsoSPoCy}"
export ATS_AGENT_ID="${ATS_AGENT_ID:-asst_Jn2tlDlX3ZhzVIQhhw5Qa57W}"

# Docker images
API_IMAGE_TAG="${API_IMAGE_TAG:-latest}"
WEB_IMAGE_TAG="${WEB_IMAGE_TAG:-latest}"
API_IMAGE_NAME="smart-apply-api:${API_IMAGE_TAG}"
WEB_IMAGE_NAME="smart-apply-web:${WEB_IMAGE_TAG}"

# Deployment mode
PROVISION_INFRA="${PROVISION_INFRA:-true}"
BUILD_IMAGES="${BUILD_IMAGES:-true}"
DEPLOY_APP="${DEPLOY_APP:-true}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"

# ================================================================
# Helper Functions
# ================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking requirements..."
    
    command -v az >/dev/null 2>&1 || { log_error "Azure CLI not installed"; exit 1; }
    command -v docker >/dev/null 2>&1 || { log_error "Docker not installed"; exit 1; }
    command -v ssh >/dev/null 2>&1 || { log_error "SSH not installed"; exit 1; }
    command -v scp >/dev/null 2>&1 || { log_error "SCP not installed"; exit 1; }
    
    log_success "All requirements met"
}

validate_environment_variables() {
    log_info "Validating environment variables..."
    
    local missing_vars=()
    
    # Check required variables
    [ -z "$SSH_PUBLIC_KEY" ] && missing_vars+=("SSH_PUBLIC_KEY")
    [ -z "$POSTGRES_ADMIN_PASSWORD" ] && missing_vars+=("POSTGRES_ADMIN_PASSWORD")
    [ -z "$JWT_SECRET" ] && missing_vars+=("JWT_SECRET")
    [ -z "$REFRESH_TOKEN_SECRET" ] && missing_vars+=("REFRESH_TOKEN_SECRET")
    [ -z "$AZURE_OPENAI_API_KEY" ] && missing_vars+=("AZURE_OPENAI_API_KEY")
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        echo ""
        echo "Please set these variables before running the script:"
        echo "  export SSH_PUBLIC_KEY=\"\$(cat ~/.ssh/id_rsa.pub)\""
        echo "  export POSTGRES_ADMIN_PASSWORD=\"\$(openssl rand -base64 32)\""
        echo "  export JWT_SECRET=\"\$(openssl rand -base64 64)\""
        echo "  export REFRESH_TOKEN_SECRET=\"\$(openssl rand -base64 64)\""
        echo "  export AZURE_OPENAI_API_KEY=\"your-api-key\""
        exit 1
    fi
    
    # Validate SSH key format
    if [[ ! "$SSH_PUBLIC_KEY" =~ ^ssh- ]]; then
        log_error "SSH_PUBLIC_KEY does not appear to be a valid SSH public key"
        echo "  Expected format: ssh-rsa AAAA... or ssh-ed25519 AAAA..."
        exit 1
    fi
    
    # Validate secret lengths (should be strong)
    if [ ${#JWT_SECRET} -lt 32 ]; then
        log_error "JWT_SECRET is too short (minimum 32 characters recommended)"
        exit 1
    fi
    
    if [ ${#REFRESH_TOKEN_SECRET} -lt 32 ]; then
        log_error "REFRESH_TOKEN_SECRET is too short (minimum 32 characters recommended)"
        exit 1
    fi
    
    log_success "All required environment variables are set"
    log_info "Azure OpenAI Endpoint: $AZURE_OPENAI_ENDPOINT"
    log_info "Azure OpenAI Deployment: $AZURE_OPENAI_DEPLOYMENT_NAME"
    log_info "Project Endpoint: $PROJECT_ENDPOINT"
}

check_azure_login() {
    log_info "Checking Azure login status..."
    
    if ! az account show >/dev/null 2>&1; then
        log_error "Not logged in to Azure. Run: az login"
        exit 1
    fi
    
    SUBSCRIPTION=$(az account show --query name -o tsv)
    log_success "Logged in to Azure (Subscription: $SUBSCRIPTION)"
}

# ================================================================
# Infrastructure Provisioning
# ================================================================

provision_infrastructure() {
    if [ "$PROVISION_INFRA" != "true" ]; then
        log_info "Skipping infrastructure provisioning (PROVISION_INFRA=false)"
        return 0
    fi
    
    log_info "Provisioning Azure infrastructure..."
    
    cd "$PROJECT_ROOT/infra/azure"
    
    # Check if parameter file exists
    if [ ! -f "main.vm.bicepparam" ]; then
        log_error "Parameter file not found: main.vm.bicepparam"
        exit 1
    fi
    
    # Deploy infrastructure
    log_info "Deploying Bicep template (this may take 10-15 minutes)..."
    
    az deployment sub create \
        --name "smartapply-vm-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)" \
        --location "$LOCATION" \
        --template-file main-vm.bicep \
        --parameters main.vm.bicepparam \
        --output table
    
    log_success "Infrastructure provisioned successfully"
    
    # Get VM details
    VM_PUBLIC_IP=$(az vm show -d -g "$RESOURCE_GROUP" -n "$VM_NAME" --query publicIps -o tsv)
    VM_FQDN=$(az network public-ip show -g "$RESOURCE_GROUP" -n "${VM_NAME}-ip" --query dnsSettings.fqdn -o tsv)
    
    log_success "VM Public IP: $VM_PUBLIC_IP"
    log_success "VM FQDN: $VM_FQDN"
    
    # Wait for VM to be ready
    log_info "Waiting for VM to be fully initialized (cloud-init may take 5-10 minutes)..."
    sleep 60
}

# ================================================================
# Docker Image Build
# ================================================================

build_docker_images() {
    if [ "$BUILD_IMAGES" != "true" ]; then
        log_info "Skipping Docker image build (BUILD_IMAGES=false)"
        return 0
    fi
    
    log_info "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Build API image
    log_info "Building API image: $API_IMAGE_NAME"
    docker build \
        -f infra/Dockerfile \
        -t "$API_IMAGE_NAME" \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        .
    
    # Build Web image
    log_info "Building Web image: $WEB_IMAGE_NAME"
    docker build \
        -f infra/Dockerfile.web \
        -t "$WEB_IMAGE_NAME" \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        .
    
    log_success "Docker images built successfully"
}

# ================================================================
# Application Deployment
# ================================================================

deploy_application() {
    if [ "$DEPLOY_APP" != "true" ]; then
        log_info "Skipping application deployment (DEPLOY_APP=false)"
        return 0
    fi
    
    log_info "Deploying application to VM..."
    
    # Get VM connection details
    VM_FQDN=$(az network public-ip show -g "$RESOURCE_GROUP" -n "${VM_NAME}-ip" --query dnsSettings.fqdn -o tsv)
    
    if [ -z "$VM_FQDN" ]; then
        log_error "Could not get VM FQDN. Is the infrastructure provisioned?"
        exit 1
    fi
    
    SSH_TARGET="${VM_USER}@${VM_FQDN}"
    log_info "Deploying to: $SSH_TARGET"
    
    # Export Docker images to tar files
    log_info "Exporting Docker images..."
    mkdir -p "$PROJECT_ROOT/build"
    
    docker save "$API_IMAGE_NAME" | gzip > "$PROJECT_ROOT/build/api-image.tar.gz"
    log_success "API image exported ($(du -h "$PROJECT_ROOT/build/api-image.tar.gz" | cut -f1))"
    
    docker save "$WEB_IMAGE_NAME" | gzip > "$PROJECT_ROOT/build/web-image.tar.gz"
    log_success "Web image exported ($(du -h "$PROJECT_ROOT/build/web-image.tar.gz" | cut -f1))"
    
    # Transfer files to VM
    log_info "Transferring files to VM..."
    
    scp -o StrictHostKeyChecking=no \
        "$PROJECT_ROOT/build/api-image.tar.gz" \
        "$PROJECT_ROOT/build/web-image.tar.gz" \
        "$SSH_TARGET:/tmp/"
    
    scp -o StrictHostKeyChecking=no \
        "$PROJECT_ROOT/infra/docker-compose.prod.yml" \
        "$SSH_TARGET:/opt/smart-apply/docker-compose.yml"
    
    log_success "Files transferred successfully"
    
    # Update secrets from Key Vault
    log_info "Updating secrets from Key Vault..."
    
    ssh -o StrictHostKeyChecking=no "$SSH_TARGET" << EOF
        set -e
        export VAULT_NAME="$KEY_VAULT_NAME"
        sudo -E /opt/smart-apply/scripts/update-secrets.sh
EOF
    
    log_success "Secrets updated"
    
    # Load Docker image and restart containers
    log_info "Loading Docker image and restarting containers..."
    
    ssh -o StrictHostKeyChecking=no "$SSH_TARGET" << 'EOF'
        set -e
        cd /opt/smart-apply
        
        # Load new images
        echo "Loading Docker images..."
        docker load < /tmp/api-image.tar.gz
        docker load < /tmp/web-image.tar.gz
        
        # Stop existing containers
        echo "Stopping existing containers..."
        docker-compose down || true
        
        # Start new containers
        echo "Starting containers..."
        docker-compose up -d --remove-orphans
        
        # Clean up
        rm -f /tmp/api-image.tar.gz /tmp/web-image.tar.gz
        docker system prune -f
        
        echo "Containers started successfully"
EOF
    
    log_success "Application deployed successfully"
}

# ================================================================
# Database Migrations
# ================================================================

run_migrations() {
    if [ "$RUN_MIGRATIONS" != "true" ]; then
        log_info "Skipping database migrations (RUN_MIGRATIONS=false)"
        return 0
    fi
    
    log_info "Running database migrations..."
    
    VM_FQDN=$(az network public-ip show -g "$RESOURCE_GROUP" -n "${VM_NAME}-ip" --query dnsSettings.fqdn -o tsv)
    SSH_TARGET="${VM_USER}@${VM_FQDN}"
    
    ssh -o StrictHostKeyChecking=no "$SSH_TARGET" << 'EOF'
        set -e
        
        # Wait for container to be healthy
        echo "Waiting for API container to be healthy..."
        for i in {1..30}; do
            if docker exec smart-apply-api npx prisma migrate status >/dev/null 2>&1; then
                break
            fi
            echo "Waiting for database connection... ($i/30)"
            sleep 2
        done
        
        # Run migrations
        echo "Running Prisma migrations..."
        docker exec smart-apply-api npx prisma migrate deploy
        
        echo "Migrations completed successfully"
EOF
    
    log_success "Database migrations completed"
}

# ================================================================
# Health Check
# ================================================================

health_check() {
    log_info "Performing health check..."
    
    VM_FQDN=$(az network public-ip show -g "$RESOURCE_GROUP" -n "${VM_NAME}-ip" --query dnsSettings.fqdn -o tsv)
    HEALTH_URL="http://${VM_FQDN}/api/v1/health/live"
    
    log_info "Checking: $HEALTH_URL"
    
    for i in {1..30}; do
        if curl -f -s "$HEALTH_URL" >/dev/null 2>&1; then
            log_success "Health check passed!"
            
            # Get health details
            HEALTH_RESPONSE=$(curl -s "$HEALTH_URL")
            echo "$HEALTH_RESPONSE" | jq . 2>/dev/null || echo "$HEALTH_RESPONSE"
            
            return 0
        fi
        
        log_warning "Health check failed, retrying... ($i/30)"
        sleep 10
    done
    
    log_error "Health check failed after 30 attempts"
    return 1
}

# ================================================================
# Main Execution
# ================================================================

main() {
    echo "════════════════════════════════════════════════════════════════"
    echo " Smart Apply - VM Deployment"
    echo " Environment: $ENVIRONMENT"
    echo " Resource Group: $RESOURCE_GROUP"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    
    check_requirements
    validate_environment_variables
    check_azure_login
    
    provision_infrastructure
    build_docker_images
    deploy_application
    run_migrations
    health_check
    
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    log_success "Deployment completed successfully!"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    
    VM_FQDN=$(az network public-ip show -g "$RESOURCE_GROUP" -n "${VM_NAME}-ip" --query dnsSettings.fqdn -o tsv 2>/dev/null || echo "N/A")
    
    echo "📋 Deployment Summary:"
    echo "  • Environment: $ENVIRONMENT"
    echo "  • VM Name: $VM_NAME"
    echo "  • VM FQDN: $VM_FQDN"
    echo "  • Frontend URL: http://${VM_FQDN} (or https:// after SSL)"
    echo "  • API URL: http://${VM_FQDN}/api/v1"
    echo "  • Swagger Docs: http://${VM_FQDN}/docs"
    echo "  • SSH: ssh ${VM_USER}@${VM_FQDN}"
    echo ""
    echo "📝 Next Steps:"
    echo "  1. Configure SSL: ssh ${VM_USER}@${VM_FQDN}"
    echo "     sudo certbot --nginx -d <your-domain>"
    echo "  2. Update DNS: Point your domain to ${VM_FQDN}"
    echo "  3. Test Frontend: curl http://${VM_FQDN}"
    echo "  4. Test API: curl http://${VM_FQDN}/api/v1/health"
    echo ""
}

# Run main function
main "$@"
