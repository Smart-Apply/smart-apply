// ================================================================
// Network Security Group Module
// ================================================================
// Creates NSG with security rules for Smart Apply VM:
// - Inbound: HTTPS (443), HTTP (80), SSH (22 - restricted)
// - Outbound: PostgreSQL (5432), HTTPS (443), HTTP (80)
// - Deny all other traffic by default
// ================================================================

@description('Name of the network security group')
param nsgName string

@description('Location for the NSG')
param location string = resourceGroup().location

@description('Allowed source IP for SSH access (e.g., your office IP, VPN IP, or Bastion subnet)')
param allowedSshSourceIp string = '*'

@description('Tags to apply to the NSG')
param tags object = {}

resource networkSecurityGroup 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: nsgName
  location: location
  tags: tags
  properties: {
    securityRules: [
      // ================================================================
      // INBOUND RULES
      // ================================================================
      
      // Allow HTTPS from Internet (production traffic)
      {
        name: 'AllowHttpsInbound'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '443'
          sourceAddressPrefix: 'Internet'
          destinationAddressPrefix: '*'
          description: 'Allow HTTPS traffic from Internet'
        }
      }
      
      // Allow HTTP from Internet (for Let\'s Encrypt SSL certificate renewal)
      {
        name: 'AllowHttpInbound'
        properties: {
          priority: 110
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '80'
          sourceAddressPrefix: 'Internet'
          destinationAddressPrefix: '*'
          description: 'Allow HTTP traffic for SSL certificate renewal (Let\'s Encrypt ACME challenge)'
        }
      }
      
      // Allow SSH (restricted to specific IP for security)
      {
        name: 'AllowSshInbound'
        properties: {
          priority: 120
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '22'
          sourceAddressPrefix: allowedSshSourceIp // Set to your IP or use Azure Bastion instead
          destinationAddressPrefix: '*'
          description: 'Allow SSH access from specific IP (for deployment and troubleshooting)'
        }
      }
      
      // Allow Azure Load Balancer health probes
      {
        name: 'AllowAzureLoadBalancerInbound'
        properties: {
          priority: 130
          direction: 'Inbound'
          access: 'Allow'
          protocol: '*'
          sourcePortRange: '*'
          destinationPortRange: '*'
          sourceAddressPrefix: 'AzureLoadBalancer'
          destinationAddressPrefix: '*'
          description: 'Allow Azure Load Balancer health probes'
        }
      }
      
      // Allow internal VNet traffic (for future multi-VM scenarios)
      {
        name: 'AllowVnetInbound'
        properties: {
          priority: 140
          direction: 'Inbound'
          access: 'Allow'
          protocol: '*'
          sourcePortRange: '*'
          destinationPortRange: '*'
          sourceAddressPrefix: 'VirtualNetwork'
          destinationAddressPrefix: 'VirtualNetwork'
          description: 'Allow internal VNet traffic (for database, service bus communication)'
        }
      }
      
      // Deny all other inbound traffic
      {
        name: 'DenyAllInbound'
        properties: {
          priority: 1000
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourcePortRange: '*'
          destinationPortRange: '*'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
          description: 'Deny all other inbound traffic (explicit deny)'
        }
      }
      
      // ================================================================
      // OUTBOUND RULES
      // ================================================================
      
      // Allow PostgreSQL connections
      {
        name: 'AllowPostgreSqlOutbound'
        properties: {
          priority: 100
          direction: 'Outbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '5432'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: 'Sql' // Service tag for Azure SQL/PostgreSQL
          description: 'Allow connections to Azure PostgreSQL'
        }
      }
      
      // Allow HTTPS (Azure services: Storage, Service Bus, Key Vault, OpenAI)
      {
        name: 'AllowHttpsOutbound'
        properties: {
          priority: 110
          direction: 'Outbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '443'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: 'Internet'
          description: 'Allow HTTPS for Azure services (Storage, Service Bus, Key Vault, OpenAI)'
        }
      }
      
      // Allow HTTP (for package updates, npm registry)
      {
        name: 'AllowHttpOutbound'
        properties: {
          priority: 120
          direction: 'Outbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '80'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: 'Internet'
          description: 'Allow HTTP for package updates and npm registry'
        }
      }
      
      // Allow DNS queries
      {
        name: 'AllowDnsOutbound'
        properties: {
          priority: 130
          direction: 'Outbound'
          access: 'Allow'
          protocol: 'Udp'
          sourcePortRange: '*'
          destinationPortRange: '53'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: 'Internet'
          description: 'Allow DNS queries'
        }
      }
      
      // Allow VNet outbound (for internal services)
      {
        name: 'AllowVnetOutbound'
        properties: {
          priority: 140
          direction: 'Outbound'
          access: 'Allow'
          protocol: '*'
          sourcePortRange: '*'
          destinationPortRange: '*'
          sourceAddressPrefix: 'VirtualNetwork'
          destinationAddressPrefix: 'VirtualNetwork'
          description: 'Allow internal VNet traffic'
        }
      }
      
      // Allow NTP (time synchronization)
      {
        name: 'AllowNtpOutbound'
        properties: {
          priority: 150
          direction: 'Outbound'
          access: 'Allow'
          protocol: 'Udp'
          sourcePortRange: '*'
          destinationPortRange: '123'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: 'Internet'
          description: 'Allow NTP for time synchronization'
        }
      }
      
      // Deny all other outbound traffic (optional - uncomment for strict security)
      // {
      //   name: 'DenyAllOutbound'
      //   properties: {
      //     priority: 1000
      //     direction: 'Outbound'
      //     access: 'Deny'
      //     protocol: '*'
      //     sourcePortRange: '*'
      //     destinationPortRange: '*'
      //     sourceAddressPrefix: '*'
      //     destinationAddressPrefix: '*'
      //     description: 'Deny all other outbound traffic'
      //   }
      // }
    ]
  }
}

// ================================================================
// Outputs
// ================================================================

@description('NSG Resource ID')
output nsgId string = networkSecurityGroup.id

@description('NSG Name')
output nsgName string = networkSecurityGroup.name
