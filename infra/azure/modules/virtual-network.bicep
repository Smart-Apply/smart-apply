// ================================================================
// Virtual Network Module
// ================================================================
// Creates a VNet with subnets for:
// - Application tier (VMs)
// - Data tier (PostgreSQL with VNet integration)
// - Optional: Bastion subnet for secure SSH access
// ================================================================

@description('Name of the virtual network')
param vnetName string

@description('Location for the VNet')
param location string = resourceGroup().location

@description('VNet address space (default: 10.0.0.0/16)')
param vnetAddressPrefix string = '10.0.0.0/16'

@description('Application subnet address prefix (default: 10.0.1.0/24)')
param appSubnetPrefix string = '10.0.1.0/24'

@description('Data subnet address prefix (default: 10.0.2.0/24)')
param dataSubnetPrefix string = '10.0.2.0/24'

@description('Create Bastion subnet (recommended for production)')
param createBastionSubnet bool = false

@description('Bastion subnet address prefix (must be /26 or larger)')
param bastionSubnetPrefix string = '10.0.3.0/26'

@description('Tags to apply to the VNet')
param tags object = {}

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        vnetAddressPrefix
      ]
    }
    subnets: concat(
      [
        // Application subnet (VMs)
        {
          name: 'app-subnet'
          properties: {
            addressPrefix: appSubnetPrefix
            privateEndpointNetworkPolicies: 'Disabled' // Allow private endpoints
            privateLinkServiceNetworkPolicies: 'Enabled'
            serviceEndpoints: [
              {
                service: 'Microsoft.Storage' // For Azure Blob
              }
              {
                service: 'Microsoft.KeyVault' // For Key Vault
              }
              {
                service: 'Microsoft.ServiceBus' // For Service Bus
              }
              {
                service: 'Microsoft.Sql' // For PostgreSQL
              }
            ]
          }
        }
        // Data subnet (PostgreSQL with VNet integration)
        {
          name: 'data-subnet'
          properties: {
            addressPrefix: dataSubnetPrefix
            delegations: [
              {
                name: 'PostgreSqlDelegation'
                properties: {
                  serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
                }
              }
            ]
            privateEndpointNetworkPolicies: 'Disabled'
            privateLinkServiceNetworkPolicies: 'Enabled'
          }
        }
      ],
      createBastionSubnet ? [
        // Azure Bastion subnet (for secure SSH without public IP on VMs)
        {
          name: 'AzureBastionSubnet' // Must be exactly this name
          properties: {
            addressPrefix: bastionSubnetPrefix
            privateEndpointNetworkPolicies: 'Disabled'
            privateLinkServiceNetworkPolicies: 'Enabled'
          }
        }
      ] : []
    )
  }
}

// ================================================================
// Outputs
// ================================================================

@description('VNet Resource ID')
output vnetId string = virtualNetwork.id

@description('VNet Name')
output vnetName string = virtualNetwork.name

@description('Application Subnet ID')
output appSubnetId string = virtualNetwork.properties.subnets[0].id

@description('Data Subnet ID')
output dataSubnetId string = virtualNetwork.properties.subnets[1].id

@description('Bastion Subnet ID (if created)')
output bastionSubnetId string = createBastionSubnet ? virtualNetwork.properties.subnets[2].id : ''
