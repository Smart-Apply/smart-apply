using './main.bicep'

param environment = 'dev'
param location = 'northeurope'
param appName = 'smartapply'

// Database credentials
param postgresAdminUsername = 'sqladmin'
param postgresAdminPassword = 'gicin8CKKNzJ8uYXmvP5oCMeTBDQ70RKevZ1s0P0grs='

// Security secrets
param jwtSecret = 'UuUouJwUXFpk/QMgTlHir7U1MrxJr6gEV1hX3VUJCmeg3OS6yU4ysN+wVq3fdqOY45jn6rlY7t2N0mxpT1XRtw=='
param refreshTokenSecret = 'ipp4+fIVQr1Hzo7qVDPlngHBrtxCd8qAmi5pcwKsLYIsJ5RKSP138i1TT9+YqVKkU3v3JbHf7mLPxvhyxyukXg=='

// Azure OpenAI & AI Foundry Configuration
param openAiDeploymentName = 'gpt-4.1'
param openAiEndpoint = 'https://smart-apply-test-ai.services.ai.azure.com/'
param openAiApiKey = 'BYYHbmL2SsdfPRXnnHA2VuKW8GymK3nEcAZrqIiL3eRlqfndij7TJQQJ99BKACYeBjFXJ3w3AAAAACOGzQKD'
param openAiApiVersion = '2024-10-21'
param projectEndpoint = 'https://smart-apply-test-ai.services.ai.azure.com/api/projects/smartApplytest'
param cvWriterAgentId = 'asst_ZLNYVwISUTw93NA2Yq53ZW1G'
param clWriterAgentId = 'asst_wXDlhHUsjgnaF6MPOsoSPoCy'
param atsAgentId = 'asst_Jn2tlDlX3ZhzVIQhhw5Qa57W'
param enableAgentParser = true
param agentMaxSteps = 10
param agentTimeout = 30000
param enableAzureOpenAI = true
