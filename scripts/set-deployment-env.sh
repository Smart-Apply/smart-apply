#!/bin/bash
# ================================================================
# Smart Apply - Set Deployment Environment Variables
# ================================================================
# Helper script to set all required environment variables for VM deployment
# Source this file before running deploy-vm.sh:
#   source ./scripts/set-deployment-env.sh
# ================================================================

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "════════════════════════════════════════════════════════════════"
echo " Smart Apply - Setting Deployment Environment Variables"
echo "════════════════════════════════════════════════════════════════"
echo ""

# ================================================================
# SSH Configuration
# ================================================================
echo -e "${YELLOW}[1/5] SSH Configuration${NC}"

# Check if SSH key exists
if [ -f ~/.ssh/id_rsa.pub ]; then
    export SSH_PUBLIC_KEY="$(cat ~/.ssh/id_rsa.pub)"
    echo -e "${GREEN}✓${NC} SSH_PUBLIC_KEY set from ~/.ssh/id_rsa.pub"
elif [ -f ~/.ssh/id_ed25519.pub ]; then
    export SSH_PUBLIC_KEY="$(cat ~/.ssh/id_ed25519.pub)"
    echo -e "${GREEN}✓${NC} SSH_PUBLIC_KEY set from ~/.ssh/id_ed25519.pub"
else
    echo "⚠️  No SSH key found. Generate one with:"
    echo "   ssh-keygen -t ed25519 -C 'your_email@example.com'"
fi
echo ""

# ================================================================
# Database Configuration
# ================================================================
echo -e "${YELLOW}[2/5] Database Configuration${NC}"

export POSTGRES_ADMIN_USERNAME="smartapply_admin"
echo -e "${GREEN}✓${NC} POSTGRES_ADMIN_USERNAME=$POSTGRES_ADMIN_USERNAME"

# Generate secure password if not already set
if [ -z "$POSTGRES_ADMIN_PASSWORD" ]; then
    export POSTGRES_ADMIN_PASSWORD="$(openssl rand -base64 32)"
    echo -e "${GREEN}✓${NC} POSTGRES_ADMIN_PASSWORD generated (32 chars)"
else
    echo -e "${GREEN}✓${NC} POSTGRES_ADMIN_PASSWORD already set"
fi
echo ""

# ================================================================
# Security - JWT Secrets
# ================================================================
echo -e "${YELLOW}[3/5] JWT Secrets${NC}"

# Load from your .env file if available
ENV_FILE="$(dirname "$0")/../apps/api/.env"
if [ -f "$ENV_FILE" ]; then
    # Extract JWT_SECRET from .env
    JWT_FROM_ENV=$(grep "^JWT_SECRET=" "$ENV_FILE" | cut -d '=' -f2-)
    if [ -n "$JWT_FROM_ENV" ] && [ "$JWT_FROM_ENV" != "CHANGE_ME_GENERATE_WITH_openssl_rand_base64_64" ]; then
        export JWT_SECRET="$JWT_FROM_ENV"
        echo -e "${GREEN}✓${NC} JWT_SECRET loaded from .env (${#JWT_SECRET} chars)"
    fi
    
    # Extract REFRESH_TOKEN_SECRET if exists, otherwise generate
    REFRESH_FROM_ENV=$(grep "^REFRESH_TOKEN_SECRET=" "$ENV_FILE" 2>/dev/null | cut -d '=' -f2-)
    if [ -n "$REFRESH_FROM_ENV" ]; then
        export REFRESH_TOKEN_SECRET="$REFRESH_FROM_ENV"
        echo -e "${GREEN}✓${NC} REFRESH_TOKEN_SECRET loaded from .env (${#REFRESH_TOKEN_SECRET} chars)"
    fi
fi

# Generate if not set
if [ -z "$JWT_SECRET" ]; then
    export JWT_SECRET="$(openssl rand -base64 64)"
    echo -e "${GREEN}✓${NC} JWT_SECRET generated (64 chars)"
fi

if [ -z "$REFRESH_TOKEN_SECRET" ]; then
    export REFRESH_TOKEN_SECRET="$(openssl rand -base64 64)"
    echo -e "${GREEN}✓${NC} REFRESH_TOKEN_SECRET generated (64 chars)"
fi
echo ""

# ================================================================
# Azure OpenAI Configuration
# ================================================================
echo -e "${YELLOW}[4/5] Azure OpenAI Configuration${NC}"

if [ -f "$ENV_FILE" ]; then
    # Extract Azure OpenAI settings from .env
    export AZURE_OPENAI_ENDPOINT=$(grep "^AZURE_OPENAI_ENDPOINT=" "$ENV_FILE" | cut -d '=' -f2-)
    export AZURE_OPENAI_API_KEY=$(grep "^AZURE_OPENAI_API_KEY=" "$ENV_FILE" | cut -d '=' -f2-)
    export AZURE_OPENAI_DEPLOYMENT_NAME=$(grep "^AZURE_OPENAI_DEPLOYMENT_NAME=" "$ENV_FILE" | cut -d '=' -f2-)
    export AZURE_OPENAI_API_VERSION=$(grep "^AZURE_OPENAI_API_VERSION=" "$ENV_FILE" | cut -d '=' -f2-)
    
    echo -e "${GREEN}✓${NC} AZURE_OPENAI_ENDPOINT=$AZURE_OPENAI_ENDPOINT"
    echo -e "${GREEN}✓${NC} AZURE_OPENAI_API_KEY=***${AZURE_OPENAI_API_KEY: -10}"
    echo -e "${GREEN}✓${NC} AZURE_OPENAI_DEPLOYMENT_NAME=$AZURE_OPENAI_DEPLOYMENT_NAME"
    echo -e "${GREEN}✓${NC} AZURE_OPENAI_API_VERSION=$AZURE_OPENAI_API_VERSION"
else
    echo "⚠️  .env file not found at $ENV_FILE"
    echo "   Please set AZURE_OPENAI_* variables manually"
fi
echo ""

# ================================================================
# Azure AI Foundry Agents Configuration
# ================================================================
echo -e "${YELLOW}[5/5] Azure AI Foundry Agents${NC}"

if [ -f "$ENV_FILE" ]; then
    export PROJECT_ENDPOINT=$(grep "^PROJECT_ENDPOINT=" "$ENV_FILE" | cut -d '=' -f2-)
    export CV_WRITER_AGENT_ID=$(grep "^CV_WRITER_AGENT_ID=" "$ENV_FILE" | cut -d '=' -f2-)
    export CL_WRITER_AGENT_ID=$(grep "^CL_WRITER_AGENT_ID=" "$ENV_FILE" | cut -d '=' -f2-)
    export ATS_AGENT_ID=$(grep "^ATS_AGENT_ID=" "$ENV_FILE" | cut -d '=' -f2-)
    
    echo -e "${GREEN}✓${NC} PROJECT_ENDPOINT=$PROJECT_ENDPOINT"
    echo -e "${GREEN}✓${NC} CV_WRITER_AGENT_ID=$CV_WRITER_AGENT_ID"
    echo -e "${GREEN}✓${NC} CL_WRITER_AGENT_ID=$CL_WRITER_AGENT_ID"
    echo -e "${GREEN}✓${NC} ATS_AGENT_ID=$ATS_AGENT_ID"
fi
echo ""

# ================================================================
# Summary
# ================================================================
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✓ All environment variables set successfully!${NC}"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "You can now run the deployment script:"
echo "  ./scripts/deploy-vm.sh"
echo ""
echo "Or verify the variables with:"
echo "  echo \$SSH_PUBLIC_KEY"
echo "  echo \$POSTGRES_ADMIN_PASSWORD"
echo "  echo \$JWT_SECRET"
echo "  echo \$AZURE_OPENAI_API_KEY"
echo ""
