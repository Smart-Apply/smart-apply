using './main.bicep'

param environment = 'dev'
param location = 'northeurope'
param appName = 'smartapply'

// Database credentials
param postgresAdminUsername = 'sqladmin'
param postgresAdminPassword = 'rvCdvIB5PaPGpY/8FKnLvWpJ/jOqtkvo8ZYcTNPO6E8='

// Security secrets
param jwtSecret = 'pRxdHu3CVFAdPhnKIBj4ajN38/1ScA+/alLFR7D4oOa9EfpwtOqixTj/CxpseSDF/0328VaMwGNqzFrV1+MFMA=='
param refreshTokenSecret = '42PEWUS/5mZC5TgVFslZ2KNiaisf3oMCCcXg8Pbxx61iMyfu84m2W0GNi7Mnp0zpEmPnzihyTDTj+yuAw4gDgw=='

// Frontend URL (update after frontend deployment)
param frontendUrl = 'https://smartapply.vercel.app'

// Azure OpenAI (optional)
param openAiDeploymentName = 'gpt-4o'
param enableAzureOpenAI = false
