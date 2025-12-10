// ================================================================
// Public IP Module
// ================================================================
// Creates a static public IP for the VM with DNS name label
// ================================================================

@description('Name of the public IP')
param publicIpName string

@description('Location for the public IP')
param location string = resourceGroup().location

@description('DNS name label (e.g., smart-apply-api, results in <label>.westeurope.cloudapp.azure.com)')
param dnsNameLabel string

@description('Public IP SKU (Standard recommended for production)')
@allowed([
  'Basic'
  'Standard'
])
param publicIpSku string = 'Standard'

@description('Public IP allocation method')
@allowed([
  'Static'
  'Dynamic'
])
param publicIpAllocationMethod string = 'Static'

@description('Tags to apply to the public IP')
param tags object = {}

resource publicIp 'Microsoft.Network/publicIPAddresses@2023-11-01' = {
  name: publicIpName
  location: location
  tags: tags
  sku: {
    name: publicIpSku
    tier: 'Regional'
  }
  properties: {
    publicIPAllocationMethod: publicIpAllocationMethod
    publicIPAddressVersion: 'IPv4'
    dnsSettings: {
      domainNameLabel: dnsNameLabel
    }
    idleTimeoutInMinutes: 4
    deleteOption: 'Delete' // Delete public IP when associated resource is deleted
  }
}

// ================================================================
// Outputs
// ================================================================

@description('Public IP Resource ID')
output publicIpId string = publicIp.id

@description('Public IP Address')
output publicIpAddress string = publicIp.properties.ipAddress

@description('FQDN (Fully Qualified Domain Name)')
output fqdn string = publicIp.properties.dnsSettings.fqdn

@description('Public IP Name')
output publicIpName string = publicIp.name
