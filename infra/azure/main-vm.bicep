// ================================================================
// Smart Apply - VM-Based Azure Infrastructure
// ================================================================
// Deploy with: 
//   az deployment sub create --location westeurope \
//     --template-file main-vm.bicep \
//     --parameters main.vm.bicepparam
// ================================================================

targetScope = 'subscription'

// ================================================================
// Parameters
// ================================================================

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Primary Azure region')
param location string = 'westeurope'

@description('Application name prefix')
param appName string = 'smartapply'

@description('VM administrator username')
param vmAdminUsername string = 'azureuser'

@description('SSH public key for VM access')
@secure()
param sshPublicKey string

@description('VM size (B2s recommended for MVP)')
@allowed(['Standard_B2s', 'Standard_D2s_v5', 'Standard_D4s_v5'])
param vmSize string = 'Standard_B2s'

@description('Allowed source IP for SSH (your IP or use * for any)')
param allowedSshSourceIp string = '*'

@description('Enable auto-shutdown (cost savings for dev)')
param enableAutoShutdown bool = (environment == 'dev')

@description('Auto-shutdown time in UTC (e.g., 1900 = 7:00 PM)')
param autoShutdownTime string = '1900'

@description('DNS name label for public IP')
param dnsNameLabel string = '${appName}-${environment}-vm'

@description('PostgreSQL administrator username')
@secure()
param postgresAdminUsername string

@description('PostgreSQL administrator password')
@secure()
param postgresAdminPassword string

@description('JWT secret for authentication (64+ chars)')
@secure()
param jwtSecret string

@description('Refresh token secret (64+ chars)')
@secure()
param refreshTokenSecret string

@description('Azure OpenAI deployment name (stored in Key Vault)')
param openAiDeploymentName string = 'gpt-4o'

@description('Azure OpenAI endpoint URL (stored in Key Vault)')
param openAiEndpoint string

@description('Azure OpenAI API key (stored in Key Vault)')
@secure()
param openAiApiKey string

@description('Azure OpenAI API version (stored in Key Vault)')
param openAiApiVersion string = '2024-10-21'

@description('Azure AI Foundry project endpoint (stored in Key Vault)')
param projectEndpoint string

@description('CV Writer Agent ID (stored in Key Vault)')
param cvWriterAgentId string

@description('Cover Letter Writer Agent ID (stored in Key Vault)')
param clWriterAgentId string

@description('ATS Agent ID (stored in Key Vault)')
param atsAgentId string

@description('Enable agent-based URL parser (stored in Key Vault)')
param enableAgentParser bool = true

@description('Frontend URL for CORS (stored in Key Vault)')
param frontendUrl string = 'https://app.smartapply.com'

// ================================================================
// Variables
// ================================================================

var resourceGroupName = '${appName}-${environment}-rg'
var tags = {
  Environment: environment
  Application: appName
  ManagedBy: 'Bicep'
  CostCenter: 'Smart-Apply-MVP'
  DeploymentType: 'VM'
}

// ================================================================
// Resource Group
// ================================================================

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// ================================================================
// Networking
// ================================================================

module vnet './modules/virtual-network.bicep' = {
  name: 'vnet-deployment'
  scope: rg
  params: {
    vnetName: '${appName}-${environment}-vnet'
    location: location
    vnetAddressPrefix: '10.0.0.0/16'
    appSubnetPrefix: '10.0.1.0/24'
    dataSubnetPrefix: '10.0.2.0/24'
    createBastionSubnet: false // Set to true for production (adds ~€130/mo)
    tags: tags
  }
}

module nsg './modules/network-security-group.bicep' = {
  name: 'nsg-deployment'
  scope: rg
  params: {
    nsgName: '${appName}-${environment}-nsg'
    location: location
    allowedSshSourceIp: allowedSshSourceIp
    tags: tags
  }
}

module publicIp './modules/public-ip.bicep' = {
  name: 'publicip-deployment'
  scope: rg
  params: {
    publicIpName: '${appName}-${environment}-ip'
    location: location
    dnsNameLabel: dnsNameLabel
    publicIpSku: 'Standard'
    publicIpAllocationMethod: 'Static'
    tags: tags
  }
}

// ================================================================
// Data Services
// ================================================================

module postgres './modules/postgresql.bicep' = {
  name: 'postgres-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    appName: appName
    adminUsername: postgresAdminUsername
    adminPassword: postgresAdminPassword
    tags: tags
  }
}

module storage './modules/storage.bicep' = {
  name: 'storage-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    appName: appName
    tags: tags
  }
}

module serviceBus './modules/service-bus.bicep' = {
  name: 'servicebus-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    appName: appName
    tags: tags
  }
}

module keyVault './modules/key-vault.bicep' = {
  name: 'keyvault-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    appName: appName
    tags: tags
  }
}

// ================================================================
// Virtual Machine
// ================================================================

// Load cloud-init script
var cloudInitScript = loadTextContent('./cloud-init.yaml')
var cloudInitBase64 = base64(cloudInitScript)

module vm './modules/virtual-machine.bicep' = {
  name: 'vm-deployment'
  scope: rg
  params: {
    vmName: '${appName}-${environment}-vm'
    location: location
    vmSize: vmSize
    adminUsername: vmAdminUsername
    sshPublicKey: sshPublicKey
    subnetId: vnet.outputs.appSubnetId
    networkSecurityGroupId: nsg.outputs.nsgId
    publicIpId: publicIp.outputs.publicIpId
    cloudInitData: cloudInitBase64
    enableAutoShutdown: enableAutoShutdown
    autoShutdownTime: autoShutdownTime
    tags: tags
  }
}

// ================================================================
// RBAC Assignments for VM Managed Identity
// ================================================================

// Create RBAC module to assign roles to VM's Managed Identity
module rbacAssignments './modules/rbac-assignments.bicep' = {
  name: 'rbac-deployment'
  scope: rg
  params: {
    vmPrincipalId: vm.outputs.vmPrincipalId
    keyVaultName: keyVault.outputs.keyVaultName
    storageAccountName: storage.outputs.storageAccountName
    serviceBusNamespaceName: serviceBus.outputs.namespaceName
  }
}

// ================================================================
// Key Vault Secrets
// ================================================================

var databaseConnectionString = 'postgresql://${postgresAdminUsername}:${postgresAdminPassword}@${postgres.outputs.fqdn}:5432/${postgres.outputs.databaseName}?sslmode=require'

module secrets './modules/key-vault-secrets.bicep' = {
  name: 'secrets-deployment'
  scope: rg
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    jwtSecret: jwtSecret
    refreshTokenSecret: refreshTokenSecret
    postgresAdminPassword: postgresAdminPassword
    databaseUrl: databaseConnectionString
    storageConnectionString: storage.outputs.connectionString
    serviceBusConnectionString: serviceBus.outputs.connectionString
  }
  dependsOn: [
    rbacAssignments // Ensure RBAC is set before storing secrets
  ]
}

// ================================================================
// Outputs
// ================================================================

@description('Resource group name')
output resourceGroupName string = rg.name

@description('VM name')
output vmName string = vm.outputs.vmName

@description('VM public IP address')
output vmPublicIp string = publicIp.outputs.publicIpAddress

@description('VM FQDN')
output vmFqdn string = publicIp.outputs.fqdn

@description('VM private IP address')
output vmPrivateIp string = vm.outputs.privateIpAddress

@description('SSH command')
output sshCommand string = 'ssh ${vmAdminUsername}@${publicIp.outputs.fqdn}'

@description('PostgreSQL server name')
output postgresServerName string = postgres.outputs.serverName

@description('PostgreSQL FQDN')
output postgresFqdn string = postgres.outputs.fqdn

@description('Storage account name')
output storageAccountName string = storage.outputs.storageAccountName

@description('Service Bus namespace')
output serviceBusNamespace string = serviceBus.outputs.namespaceName

@description('Key Vault URI')
output keyVaultUri string = keyVault.outputs.keyVaultUri

@description('Key Vault name')
output keyVaultName string = keyVault.outputs.keyVaultName

@description('Deployment instructions')
output deploymentInstructions string = '''
════════════════════════════════════════════════════════════════
Smart Apply VM Deployment - Next Steps
════════════════════════════════════════════════════════════════

1. SSH to VM:
   ${sshCommand}

2. Set Key Vault name in secrets script:
   sudo nano /opt/smart-apply/scripts/update-secrets.sh
   # Set VAULT_NAME="${keyVault.outputs.keyVaultName}"

3. Retrieve secrets from Key Vault:
   sudo -u azureuser VAULT_NAME="${keyVault.outputs.keyVaultName}" /opt/smart-apply/scripts/update-secrets.sh

4. Deploy application (see scripts/deploy-vm.sh)

5. Configure SSL:
   sudo certbot --nginx -d <your-domain>

════════════════════════════════════════════════════════════════
'''
