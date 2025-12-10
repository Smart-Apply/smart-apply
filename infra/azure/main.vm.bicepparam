using './main-vm.bicep'

// ================================================================
// Smart Apply VM Deployment Parameters - Development
// ================================================================

// Environment
param environment = 'dev'
param location = 'westeurope'
param appName = 'smartapply'

// VM Configuration
param vmAdminUsername = 'azureuser'
param sshPublicKey = readEnvironmentVariable('SSH_PUBLIC_KEY', '<your-ssh-public-key>')
param vmSize = 'Standard_B2s' // 2 vCPU, 4GB RAM (€30/mo)
param allowedSshSourceIp = '*' // CHANGE TO YOUR IP IN PRODUCTION
param enableAutoShutdown = true // Enable for dev (saves ~€15-20/mo)
param autoShutdownTime = '1900' // 7:00 PM UTC
param dnsNameLabel = 'smartapply-dev-api'

// Database Configuration
param postgresAdminUsername = readEnvironmentVariable('POSTGRES_ADMIN_USERNAME', 'smartapply_admin')
param postgresAdminPassword = readEnvironmentVariable('POSTGRES_ADMIN_PASSWORD', 'CHANGE_ME_IN_PRODUCTION')

// Security - JWT Secrets (CRITICAL: Generate with: openssl rand -base64 64)
param jwtSecret = readEnvironmentVariable('JWT_SECRET', 'CHANGE_ME_GENERATE_WITH_openssl_rand_base64_64')
param refreshTokenSecret = readEnvironmentVariable('REFRESH_TOKEN_SECRET', 'CHANGE_ME_GENERATE_WITH_openssl_rand_base64_64')

// Azure OpenAI Configuration
param openAiDeploymentName = 'gpt-4o'
param openAiEndpoint = readEnvironmentVariable('AZURE_OPENAI_ENDPOINT', 'https://smart-apply-test-ai.services.ai.azure.com/')
param openAiApiKey = readEnvironmentVariable('AZURE_OPENAI_API_KEY', 'CHANGE_ME_YOUR_AZURE_OPENAI_KEY')
param openAiApiVersion = '2024-10-21'

// Azure AI Foundry Agents
param projectEndpoint = readEnvironmentVariable('PROJECT_ENDPOINT', 'https://smart-apply-test-ai.services.ai.azure.com/api/projects/smartApplytest')
param cvWriterAgentId = readEnvironmentVariable('CV_WRITER_AGENT_ID', 'asst_ZLNYVwISUTw93NA2Yq53ZW1G')
param clWriterAgentId = readEnvironmentVariable('CL_WRITER_AGENT_ID', 'asst_wXDlhHUsjgnaF6MPOsoSPoCy')
param atsAgentId = readEnvironmentVariable('ATS_AGENT_ID', 'asst_Jn2tlDlX3ZhzVIQhhw5Qa57W')
param enableAgentParser = true

// Frontend URL (for CORS)
param frontendUrl = 'http://localhost:3001' // Dev environment
