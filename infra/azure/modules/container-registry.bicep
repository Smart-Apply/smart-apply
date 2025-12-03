// Azure Container Registry Module
@description('Azure region')
param location string

@description('Environment name')
param environment string

@description('Application name')
param appName string

@description('Resource tags')
param tags object

var registryName = replace('${appName}${environment}acr', '-', '') // ACR names can't have hyphens

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  tags: tags
  sku: {
    name: 'Premium' // Premium for all regions support
  }
  properties: {
    adminUserEnabled: true // Enable for GitHub Actions, use Managed Identity in production
    publicNetworkAccess: 'Enabled'
    networkRuleBypassOptions: 'AzureServices'
    policies: {
      retentionPolicy: {
        status: 'enabled'
        days: 30
      }
    }
  }
}

output registryId string = acr.id
output registryName string = acr.name
output loginServer string = acr.properties.loginServer
