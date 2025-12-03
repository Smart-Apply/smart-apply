// Container App Module (Backend API)
@description('Azure region')
param location string

@description('Environment name')
param environment string

@description('Application name')
param appName string

@description('Container Apps Environment ID')
param containerEnvironmentId string

@description('Container Registry Name (unused in initial deployment)')
param containerRegistryName string

@description('Database connection string')
@secure()
param databaseUrl string

@description('Storage connection string')
@secure()
param storageConnectionString string

@description('Service Bus connection string')
@secure()
param serviceBusConnectionString string

@description('Key Vault name')
param keyVaultName string

@description('JWT secret')
@secure()
param jwtSecret string

@description('Refresh token secret')
@secure()
param refreshTokenSecret string

@description('Frontend URL for CORS')
param frontendUrl string

@description('Azure OpenAI deployment name')
param openAiDeploymentName string

@description('Enable Azure OpenAI')
param enableAzureOpenAI bool

@description('Resource tags')
param tags object

var containerAppName = '${appName}-${environment}-api'
// Use a public dummy image for initial deployment (will be replaced by GitHub Actions)
var containerImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned' // Managed Identity for Key Vault access
  }
  properties: {
    managedEnvironmentId: containerEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single' // Use 'Multiple' for blue-green deployments
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http' // Use 'http2' for gRPC
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      // Registry will be configured by GitHub Actions on first deployment
      secrets: [
        {
          name: 'database-url'
          value: databaseUrl
        }
        {
          name: 'storage-connection-string'
          value: storageConnectionString
        }
        {
          name: 'service-bus-connection-string'
          value: serviceBusConnectionString
        }
        {
          name: 'jwt-secret'
          value: jwtSecret
        }
        {
          name: 'refresh-token-secret'
          value: refreshTokenSecret
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: containerImage
          resources: {
            cpu: json('0.5') // 0.5 vCPU
            memory: '1Gi' // 1GB RAM
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '3000'
            }
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'JWT_SECRET'
              secretRef: 'jwt-secret'
            }
            {
              name: 'REFRESH_TOKEN_SECRET'
              secretRef: 'refresh-token-secret'
            }
            {
              name: 'JWT_EXPIRES_IN'
              value: '15m'
            }
            {
              name: 'REFRESH_TOKEN_EXPIRES_IN'
              value: '7d'
            }
            {
              name: 'STORAGE_DRIVER'
              value: 'azure'
            }
            {
              name: 'AZURE_STORAGE_CONNECTION_STRING'
              secretRef: 'storage-connection-string'
            }
            {
              name: 'AZURE_STORAGE_CONTAINER'
              value: 'applications'
            }
            {
              name: 'JOBS_DRIVER'
              value: 'service-bus'
            }
            {
              name: 'SERVICE_BUS_CONNECTION_STRING'
              secretRef: 'service-bus-connection-string'
            }
            {
              name: 'SERVICE_BUS_QUEUE_NAME'
              value: 'applications'
            }
            {
              name: 'LLM_PROVIDER'
              value: enableAzureOpenAI ? 'azure-openai' : 'mock'
            }
            {
              name: 'AZURE_OPENAI_DEPLOYMENT_NAME'
              value: openAiDeploymentName
            }
            {
              name: 'CORS_ORIGINS'
              value: frontendUrl
            }
            {
              name: 'RATE_LIMIT_TTL'
              value: '900'
            }
            {
              name: 'RATE_LIMIT_MAX'
              value: '100'
            }
            {
              name: 'RATE_LIMIT_AUTH_TTL'
              value: '900'
            }
            {
              name: 'RATE_LIMIT_AUTH_MAX'
              value: '5'
            }
            {
              name: 'ENABLE_CSRF'
              value: 'true'
            }
            {
              name: 'KEY_VAULT_URI'
              value: 'https://${keyVaultName}.${az.environment().suffixes.keyvaultDns}/'
            }
            {
              name: 'PUPPETEER_EXECUTABLE_PATH'
              value: '/usr/bin/chromium-browser'
            }
            {
              name: 'PUPPETEER_SKIP_CHROMIUM_DOWNLOAD'
              value: 'true'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/v1/health/live'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 30
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/v1/health/ready'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 5
              timeoutSeconds: 3
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1 // Always-on for MVP
        maxReplicas: 5 // Auto-scale up to 5 instances
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

output containerAppId string = containerApp.id
output containerAppName string = containerApp.name
output fqdn string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output principalId string = containerApp.identity.principalId
