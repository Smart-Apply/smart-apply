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

@description('GitHub repository URL')
param repositoryUrl string = 'https://github.com/Ar1anit/smart-apply'

@description('GitHub branch name')
param repositoryBranch string = 'mvp'

@description('Azure OpenAI deployment name')
param openAiDeploymentName string = 'gpt-4o'

@description('Azure OpenAI endpoint URL')
param openAiEndpoint string = 'https://smart-apply-test-ai.services.ai.azure.com/'

@description('Azure OpenAI API key')
@secure()
param openAiApiKey string

@description('Azure OpenAI API version')
param openAiApiVersion string = '2024-10-21'

@description('Azure AI Foundry project endpoint')
param projectEndpoint string = 'https://smart-apply-test-ai.services.ai.azure.com/api/projects/smartApplytest'

@description('CV Writer Agent ID')
param cvWriterAgentId string = 'asst_ZLNYVwISUTw93NA2Yq53ZW1G'

@description('Cover Letter Writer Agent ID')
param clWriterAgentId string = 'asst_wXDlhHUsjgnaF6MPOsoSPoCy'

@description('ATS Agent ID')
param atsAgentId string = 'asst_Jn2tlDlX3ZhzVIQhhw5Qa57W'

@description('Enable agent-based URL parser')
param enableAgentParser bool = true

@description('Maximum steps for agent execution')
param agentMaxSteps int = 10

@description('Agent timeout in milliseconds')
param agentTimeout int = 30000

@description('Enable Azure OpenAI (requires separate provisioning)')
param enableAzureOpenAI bool = true

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

// Variables for connection strings
// Azure PostgreSQL Flexible Server format: postgresql://username:password@host:5432/database?sslmode=require
var databaseConnectionString = 'postgresql://${postgresAdminUsername}:${postgresAdminPassword}@${postgres.outputs.fqdn}:5432/${postgres.outputs.databaseName}?sslmode=require'

// Backend API (Container App) - Deploy first to get URL
module api './modules/container-app.bicep' = {
  name: 'api-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    appName: appName
    containerEnvironmentId: containerEnv.outputs.environmentId
    containerRegistryName: acr.outputs.registryName
    databaseUrl: databaseConnectionString
    storageConnectionString: storage.outputs.connectionString
    serviceBusConnectionString: serviceBus.outputs.connectionString
    keyVaultName: keyVault.outputs.keyVaultName
    jwtSecret: jwtSecret
    refreshTokenSecret: refreshTokenSecret
    frontendUrl: 'https://smartapply-dev-web.ashycliff-786e35b4.northeurope.azurecontainerapps.io'
    openAiDeploymentName: openAiDeploymentName
    openAiEndpoint: openAiEndpoint
    openAiApiKey: openAiApiKey
    openAiApiVersion: openAiApiVersion
    projectEndpoint: projectEndpoint
    cvWriterAgentId: cvWriterAgentId
    clWriterAgentId: clWriterAgentId
    atsAgentId: atsAgentId
    enableAgentParser: enableAgentParser
    agentMaxSteps: agentMaxSteps
    agentTimeout: agentTimeout
    enableAzureOpenAI: enableAzureOpenAI
    storageAccountName: storage.outputs.storageAccountName
    tags: tags
  }
}

// Frontend (Container App) - Deploy after backend to use its URL
module web './modules/container-app-web.bicep' = {
  name: 'web-deployment'
  scope: rg
  params: {
    location: location
    containerAppName: '${appName}-${environment}-web'
    environmentId: containerEnv.outputs.environmentId
    containerRegistryServer: acr.outputs.loginServer
    containerImage: '${acr.outputs.loginServer}/smart-apply-web:latest'
    backendApiUrl: 'https://${api.outputs.fqdn}/api/v1'
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
    databaseUrl: databaseConnectionString
    storageConnectionString: storage.outputs.connectionString
    serviceBusConnectionString: serviceBus.outputs.connectionString
  }
}

// Outputs
output resourceGroupName string = rg.name
output containerRegistryLoginServer string = acr.outputs.loginServer
output containerRegistryName string = acr.outputs.registryName
output apiUrl string = api.outputs.fqdn
output webUrl string = web.outputs.containerAppUrl
output postgresServerName string = postgres.outputs.serverName
output storageAccountName string = storage.outputs.storageAccountName
output serviceBusNamespace string = serviceBus.outputs.namespaceName
output keyVaultUri string = keyVault.outputs.keyVaultUri
output containerEnvironmentName string = containerEnv.outputs.environmentName
