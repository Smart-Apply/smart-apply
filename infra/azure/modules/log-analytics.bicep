// Log Analytics Workspace Module
@description('Azure region')
param location string

@description('Environment name')
param environment string

@description('Application name')
param appName string

@description('Resource tags')
param tags object

var workspaceName = '${appName}-${environment}-logs'

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018' // Pay-as-you-go
    }
    retentionInDays: 30 // 30 days retention for MVP
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

output workspaceId string = logAnalyticsWorkspace.id
output workspaceName string = logAnalyticsWorkspace.name
output customerId string = logAnalyticsWorkspace.properties.customerId
