// ================================================================
// RBAC Assignments Module
// ================================================================
// Assigns roles to VM's Managed Identity for accessing Azure services
// ================================================================

@description('VM Managed Identity Principal ID')
param vmPrincipalId string

@description('Key Vault name')
param keyVaultName string

@description('Storage Account name')
param storageAccountName string

@description('Service Bus Namespace name')
param serviceBusNamespaceName string

// ================================================================
// Key Vault - Secrets User Role
// ================================================================

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource keyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, vmPrincipalId, 'KeyVaultSecretsUser')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: vmPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ================================================================
// Storage Account - Blob Data Contributor Role
// ================================================================

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource storageBlobContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, vmPrincipalId, 'StorageBlobDataContributor')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') // Storage Blob Data Contributor
    principalId: vmPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ================================================================
// Service Bus - Data Owner Role
// ================================================================

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2024-01-01' existing = {
  name: serviceBusNamespaceName
}

resource serviceBusDataOwner 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(serviceBusNamespace.id, vmPrincipalId, 'ServiceBusDataOwner')
  scope: serviceBusNamespace
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '090c5cfd-751d-490a-894a-3ce6f1109419') // Azure Service Bus Data Owner
    principalId: vmPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ================================================================
// Outputs
// ================================================================

@description('Key Vault Secrets User role assignment ID')
output keyVaultRoleAssignmentId string = keyVaultSecretsUser.id

@description('Storage Blob Contributor role assignment ID')
output storageRoleAssignmentId string = storageBlobContributor.id

@description('Service Bus Data Owner role assignment ID')
output serviceBusRoleAssignmentId string = serviceBusDataOwner.id
