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
