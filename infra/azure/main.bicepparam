// Smart Apply - Bicep Parameters
// Usage: az deployment sub create --location westeurope --template-file main.bicep --parameters main.bicepparam

using './main.bicep'

// Environment configuration
param environment = 'prod'
param location = 'westeurope'
param appName = 'smartapply'

// Database credentials (CHANGE THESE!)
param postgresAdminUsername = 'sqladmin'
param postgresAdminPassword = '' // TODO: Set via command line or Key Vault reference

// Security secrets (CHANGE THESE!)
param jwtSecret = '' // TODO: Generate with: openssl rand -base64 64
param refreshTokenSecret = '' // TODO: Generate with: openssl rand -base64 64

// Frontend URL
param frontendUrl = 'https://smartapply.vercel.app' // TODO: Update with your frontend URL

// Azure OpenAI configuration
param openAiDeploymentName = 'gpt-4o'
param enableAzureOpenAI = false // Set to true if you have Azure OpenAI provisioned
