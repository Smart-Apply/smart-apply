// Key Vault Secrets Module
@description('Key Vault name')
param keyVaultName string

@description('JWT secret')
@secure()
param jwtSecret string

@description('Refresh token secret')
@secure()
param refreshTokenSecret string

@description('PostgreSQL admin password')
@secure()
param postgresAdminPassword string

@description('Database connection string')
@secure()
param databaseUrl string

@description('Storage connection string')
@secure()
param storageConnectionString string

@description('Service Bus connection string')
@secure()
param serviceBusConnectionString string

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource jwtSecretSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'jwt-secret'
  properties: {
    value: jwtSecret
    contentType: 'text/plain'
  }
}

resource refreshTokenSecretSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'refresh-token-secret'
  properties: {
    value: refreshTokenSecret
    contentType: 'text/plain'
  }
}

resource postgresPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'postgres-admin-password'
  properties: {
    value: postgresAdminPassword
    contentType: 'text/plain'
  }
}

resource databaseUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'database-url'
  properties: {
    value: databaseUrl
    contentType: 'text/plain'
  }
}

resource storageConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'storage-connection-string'
  properties: {
    value: storageConnectionString
    contentType: 'text/plain'
  }
}

resource serviceBusConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'service-bus-connection-string'
  properties: {
    value: serviceBusConnectionString
    contentType: 'text/plain'
  }
}

// Secret IDs (not values) are safe to output for reference
@description('JWT secret resource ID')
output jwtSecretResourceId string = jwtSecretSecret.id

@description('Refresh token secret resource ID')
output refreshTokenSecretResourceId string = refreshTokenSecretSecret.id

@description('Database URL secret resource ID')
output databaseUrlResourceId string = databaseUrlSecret.id
