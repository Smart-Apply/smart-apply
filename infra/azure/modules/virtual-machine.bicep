// ================================================================
// Virtual Machine Module for Smart Apply MVP
// ================================================================
// Creates an Azure VM with:
// - Ubuntu 22.04 LTS
// - Standard_B2s (2 vCPU, 4GB RAM) - Burstable for cost optimization
// - System-assigned Managed Identity for Key Vault access
// - Cloud-init for automated setup (Docker, Nginx, app deployment)
// - Premium SSD for OS disk (30GB)
// - Azure Monitor Agent extension for observability
// ================================================================

@description('Name of the virtual machine')
param vmName string

@description('Location for all resources')
param location string = resourceGroup().location

@description('VM size (default: Standard_B2s for MVP cost optimization)')
@allowed([
  'Standard_B2s'   // 2 vCPU, 4GB RAM - €30/mo (MVP with both API + Frontend)
  'Standard_D2s_v5' // 2 vCPU, 8GB RAM - €75/mo (Production)
  'Standard_D4s_v5' // 4 vCPU, 16GB RAM - €150/mo (High traffic)
])
param vmSize string = 'Standard_B2s'

@description('Admin username for SSH access')
param adminUsername string = 'azureuser'

@description('SSH public key for authentication')
@secure()
param sshPublicKey string

@description('Subnet ID for VM network interface')
param subnetId string

@description('Network Security Group ID')
param networkSecurityGroupId string

@description('Public IP ID (optional - leave empty for private VM)')
param publicIpId string = ''

@description('Cloud-init configuration (base64 encoded)')
param cloudInitData string

@description('Tags to apply to all resources')
param tags object = {}

@description('Enable auto-shutdown (useful for dev environment cost savings)')
param enableAutoShutdown bool = false

@description('Auto-shutdown time (UTC, e.g., 1900 = 7:00 PM)')
param autoShutdownTime string = '1900'

@description('Timezone for auto-shutdown')
param autoShutdownTimezone string = 'UTC'

// ================================================================
// Network Interface
// ================================================================

resource networkInterface 'Microsoft.Network/networkInterfaces@2023-11-01' = {
  name: '${vmName}-nic'
  location: location
  tags: tags
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          subnet: {
            id: subnetId
          }
          privateIPAllocationMethod: 'Dynamic'
          publicIPAddress: !empty(publicIpId) ? {
            id: publicIpId
          } : null
        }
      }
    ]
    networkSecurityGroup: {
      id: networkSecurityGroupId
    }
    enableAcceleratedNetworking: false // Not supported on B-series VMs
  }
}

// ================================================================
// Virtual Machine
// ================================================================

resource virtualMachine 'Microsoft.Compute/virtualMachines@2024-03-01' = {
  name: vmName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned' // Managed Identity for Key Vault, Storage, Service Bus access
  }
  properties: {
    hardwareProfile: {
      vmSize: vmSize
    }
    osProfile: {
      computerName: vmName
      adminUsername: adminUsername
      customData: cloudInitData // Base64-encoded cloud-init script
      linuxConfiguration: {
        disablePasswordAuthentication: true // SSH key only for security
        ssh: {
          publicKeys: [
            {
              path: '/home/${adminUsername}/.ssh/authorized_keys'
              keyData: sshPublicKey
            }
          ]
        }
        patchSettings: {
          patchMode: 'AutomaticByPlatform' // Automatic OS patching
          automaticByPlatformSettings: {
            rebootSetting: 'IfRequired'
          }
        }
      }
    }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: '0001-com-ubuntu-server-jammy'
        sku: '22_04-lts-gen2'
        version: 'latest'
      }
      osDisk: {
        name: '${vmName}-osdisk'
        createOption: 'FromImage'
        diskSizeGB: 30
        managedDisk: {
          storageAccountType: 'Premium_LRS' // SSD for better I/O (can use Standard_LRS to save ~€3/mo)
        }
        deleteOption: 'Delete' // Delete disk when VM is deleted
      }
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: networkInterface.id
          properties: {
            deleteOption: 'Delete' // Delete NIC when VM is deleted
          }
        }
      ]
    }
    diagnosticsProfile: {
      bootDiagnostics: {
        enabled: true // Store boot logs in managed storage (no separate storage account needed)
      }
    }
    securityProfile: {
      encryptionAtHost: false // Requires special subscription quota (set to true for enhanced security)
      securityType: 'TrustedLaunch' // Secure boot + vTPM for Gen2 VMs
      uefiSettings: {
        secureBootEnabled: true
        vTpmEnabled: true
      }
    }
  }
}

// ================================================================
// VM Extensions
// ================================================================

// Azure Monitor Agent for metrics and logs
resource monitorAgent 'Microsoft.Compute/virtualMachines/extensions@2024-03-01' = {
  name: 'AzureMonitorLinuxAgent'
  parent: virtualMachine
  location: location
  properties: {
    publisher: 'Microsoft.Azure.Monitor'
    type: 'AzureMonitorLinuxAgent'
    typeHandlerVersion: '1.29'
    autoUpgradeMinorVersion: true
    enableAutomaticUpgrade: true
    settings: {}
  }
}

// Dependency Agent for VM Insights (optional - uncomment if using Azure Monitor VM Insights)
// resource dependencyAgent 'Microsoft.Compute/virtualMachines/extensions@2024-03-01' = {
//   name: 'DependencyAgentLinux'
//   parent: virtualMachine
//   location: location
//   properties: {
//     publisher: 'Microsoft.Azure.Monitoring.DependencyAgent'
//     type: 'DependencyAgentLinux'
//     typeHandlerVersion: '9.10'
//     autoUpgradeMinorVersion: true
//   }
//   dependsOn: [
//     monitorAgent
//   ]
// }

// ================================================================
// Auto-shutdown Schedule (Cost Optimization)
// ================================================================

resource autoShutdownSchedule 'Microsoft.DevTestLab/schedules@2018-09-15' = if (enableAutoShutdown) {
  name: 'shutdown-computevm-${vmName}'
  location: location
  tags: tags
  properties: {
    status: 'Enabled'
    taskType: 'ComputeVmShutdownTask'
    dailyRecurrence: {
      time: autoShutdownTime // e.g., '1900' = 7:00 PM
    }
    timeZoneId: autoShutdownTimezone
    notificationSettings: {
      status: 'Disabled' // Set to 'Enabled' and add email for shutdown notifications
    }
    targetResourceId: virtualMachine.id
  }
}

// ================================================================
// Outputs
// ================================================================

@description('VM Resource ID')
output vmId string = virtualMachine.id

@description('VM Name')
output vmName string = virtualMachine.name

@description('VM Principal ID (for RBAC assignments)')
output vmPrincipalId string = virtualMachine.identity.principalId

@description('Private IP Address')
output privateIpAddress string = networkInterface.properties.ipConfigurations[0].properties.privateIPAddress

@description('Network Interface ID')
output networkInterfaceId string = networkInterface.id
