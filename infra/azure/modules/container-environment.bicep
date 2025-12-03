// Container Apps Environment Module
@description('Azure region')
param location string

@description('Environment name')
param environment string

@description('Application name')
param appName string

@description('Log Analytics Workspace ID')
param logAnalyticsWorkspaceId string

@description('Resource tags')
param tags object

var environmentName = '${appName}-${environment}-cae'

resource containerAppEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: reference(logAnalyticsWorkspaceId, '2023-09-01').customerId
        sharedKey: listKeys(logAnalyticsWorkspaceId, '2023-09-01').primarySharedKey
      }
    }
    zoneRedundant: false // Enable for production HA
  }
}

output environmentId string = containerAppEnvironment.id
output environmentName string = containerAppEnvironment.name
output defaultDomain string = containerAppEnvironment.properties.defaultDomain
