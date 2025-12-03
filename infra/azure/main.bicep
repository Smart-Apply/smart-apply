// Smart Apply - Main Azure Infrastructure
// Deploy with: az deployment sub create --location westeurope --template-file main.bicep --parameters main.bicepparam

targetScope = 'subscription'

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'prod'

@description('Primary Azure region')
param location string = 'westeurope'

@description('Application name prefix')
param appName string = 'smartapply'

@description('PostgreSQL administrator username')
@secure()
param postgresAdminUsername string

@description('PostgreSQL administrator password')
@secure()
param postgresAdminPassword string

@description('JWT secret for authentication')
@secure()
param jwtSecret string

@description('Refresh token secret')
@secure()
param refreshTokenSecret string

@description('Frontend URL for CORS')
param frontendUrl string

@description('Azure OpenAI deployment name')
param openAiDeploymentName string = 'gpt-4o'

@description('Enable Azure OpenAI (requires separate provisioning)')
param enableAzureOpenAI bool = false

// Variables
var resourceGroupName = '${appName}-${environment}-rg'
var tags = {
  Environment: environment
  Application: appName
  ManagedBy: 'Bicep'
  CostCenter: 'Smart-Apply-MVP'
}

// Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// Container Registry
module acr './modules/container-registry.bicep' = {
  name: 'acr-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    appName: appName
    tags: tags
  }
}

// PostgreSQL Database
module postgres './modules/postgresql.bicep' = {
  name: 'postgres-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    appName: appName
    adminUsername: postgresAdminUsername
    adminPassword: postgresAdminPassword
    tags: tags
  }
}

// Storage Account (Blob)
module storage './modules/storage.bicep' = {
  name: 'storage-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    appName: appName
    tags: tags
  }
}

// Service Bus (Job Queue)
module serviceBus './modules/service-bus.bicep' = {
  name: 'servicebus-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    appName: appName
    tags: tags
  }
}

// Key Vault (Secrets Management)
module keyVault './modules/key-vault.bicep' = {
  name: 'keyvault-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    appName: appName
    tags: tags
  }
}

// Log Analytics Workspace
module logAnalytics './modules/log-analytics.bicep' = {
  name: 'logs-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    appName: appName
    tags: tags
  }
}

// Container Apps Environment
module containerEnv './modules/container-environment.bicep' = {
  name: 'containerenv-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    appName: appName
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    tags: tags
  }
}

// Backend API (Container App)
module api './modules/container-app.bicep' = {
  name: 'api-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    appName: appName
    containerEnvironmentId: containerEnv.outputs.environmentId
    containerRegistryName: acr.outputs.registryName
    databaseUrl: postgres.outputs.connectionString
    storageConnectionString: storage.outputs.connectionString
    serviceBusConnectionString: serviceBus.outputs.connectionString
    keyVaultName: keyVault.outputs.keyVaultName
    jwtSecret: jwtSecret
    refreshTokenSecret: refreshTokenSecret
    frontendUrl: frontendUrl
    openAiDeploymentName: openAiDeploymentName
    enableAzureOpenAI: enableAzureOpenAI
    tags: tags
  }
}

// Store secrets in Key Vault
module secrets './modules/key-vault-secrets.bicep' = {
  name: 'secrets-deployment'
  scope: rg
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    jwtSecret: jwtSecret
    refreshTokenSecret: refreshTokenSecret
    postgresAdminPassword: postgresAdminPassword
    databaseUrl: postgres.outputs.connectionString
    storageConnectionString: storage.outputs.connectionString
    serviceBusConnectionString: serviceBus.outputs.connectionString
  }
}

// Outputs
output resourceGroupName string = rg.name
output containerRegistryLoginServer string = acr.outputs.loginServer
output containerRegistryName string = acr.outputs.registryName
output apiUrl string = api.outputs.fqdn
output postgresServerName string = postgres.outputs.serverName
output storageAccountName string = storage.outputs.storageAccountName
output serviceBusNamespace string = serviceBus.outputs.namespaceName
output keyVaultUri string = keyVault.outputs.keyVaultUri
output containerEnvironmentName string = containerEnv.outputs.environmentName
