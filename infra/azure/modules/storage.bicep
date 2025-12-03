// Azure Storage Account Module (Blob Storage)
@description('Azure region')
param location string

@description('Environment name')
param environment string

@description('Application name')
param appName string

@description('Resource tags')
param tags object

var storageAccountName = replace('${appName}${environment}st', '-', '') // Storage account names can't have hyphens
var containerName = 'applications' // Container for PDFs

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS' // Locally redundant storage (cheapest)
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false // Private by default, use SAS tokens
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow' // Use 'Deny' with private endpoints in production
    }
  }
}

// Blob service
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

// Container for application PDFs
resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: containerName
  properties: {
    publicAccess: 'None' // Private container
  }
}

// Connection string
var connectionString = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${az.environment().suffixes.storage}'

output storageAccountId string = storageAccount.id
output storageAccountName string = storageAccount.name
output containerName string = container.name
output connectionString string = connectionString
output blobEndpoint string = storageAccount.properties.primaryEndpoints.blob
