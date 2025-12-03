// PostgreSQL Flexible Server Module
@description('Azure region')
param location string

@description('Environment name')
param environment string

@description('Application name')
param appName string

@description('Administrator username')
@secure()
param adminUsername string

@description('Administrator password')
@secure()
param adminPassword string

@description('Resource tags')
param tags object

var serverName = '${appName}-${environment}-psql'
var databaseName = 'smartapply'

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms' // Burstable tier for MVP (1 vCore, 2GB RAM)
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: adminUsername
    administratorLoginPassword: adminPassword
    version: '16' // PostgreSQL 16
    storage: {
      storageSizeGB: 32 // Minimum for Flexible Server
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled' // Enable for production
    }
    highAvailability: {
      mode: 'Disabled' // Enable 'ZoneRedundant' for production
    }
    network: {
      publicNetworkAccess: 'Enabled' // Use private endpoints in production
    }
  }
}

// Database
resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgresServer
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.UTF8'
  }
}

// Firewall rule to allow Azure services
resource firewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Connection string (stored in Key Vault)
var connectionString = 'postgresql://${adminUsername}:${adminPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${databaseName}?sslmode=require'

output serverId string = postgresServer.id
output serverName string = postgresServer.name
output databaseName string = database.name
output connectionString string = connectionString
output fqdn string = postgresServer.properties.fullyQualifiedDomainName
