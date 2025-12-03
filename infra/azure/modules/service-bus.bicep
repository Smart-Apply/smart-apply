// Azure Service Bus Module (Job Queue)
@description('Azure region')
param location string

@description('Environment name')
param environment string

@description('Application name')
param appName string

@description('Resource tags')
param tags object

var namespaceName = '${appName}-${environment}-servicebus'
var queueName = 'applications'

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2023-01-01-preview' = {
  name: namespaceName
  location: location
  tags: tags
  sku: {
    name: 'Basic' // Basic tier sufficient for MVP (256 KB message size)
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    minimumTlsVersion: '1.2'
  }
}

// Queue for application processing
resource queue 'Microsoft.ServiceBus/namespaces/queues@2023-01-01-preview' = {
  parent: serviceBusNamespace
  name: queueName
  properties: {
    maxDeliveryCount: 10
    defaultMessageTimeToLive: 'P1D' // 1 day
    lockDuration: 'PT5M' // 5 minutes
    enablePartitioning: false
    requiresDuplicateDetection: false
    requiresSession: false
    deadLetteringOnMessageExpiration: true
  }
}

// Connection string
var connectionString = listKeys('${serviceBusNamespace.id}/AuthorizationRules/RootManageSharedAccessKey', serviceBusNamespace.apiVersion).primaryConnectionString

output namespaceId string = serviceBusNamespace.id
output namespaceName string = serviceBusNamespace.name
output queueName string = queue.name
output connectionString string = connectionString
