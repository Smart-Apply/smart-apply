using './main.bicep'

param environment = 'test'
param location = 'swedencentral'
param appName = 'smartapply'

// Database credentials
param postgresAdminUsername = 'sqladmin'
param postgresAdminPassword = 'DrOJKrfAyfgiCFSOqEbfo4bQq4EkJUo44jkpZGaSOmI='

// Security secrets
param jwtSecret = 'TDayOd2uN1YrFAuASeHuMfBEonp9dzP4qqF24ueWvEAOLkcI866pC5wpPtCSL8rUj/u2oPAJDwgsmvFDFdsiVQ=='
param refreshTokenSecret = 'EjSJMx2NC22B80w7TB/8guXSL09sJkACgDODJwyAjyXs72pH41b8yg6L3Oo3t4lB50wHlKi391lddGJJF7YX8Q=='

// Frontend URL (update after frontend deployment)
param frontendUrl = 'https://smartapply.vercel.app'

// Azure OpenAI (optional)
param openAiDeploymentName = 'gpt-4o'
param enableAzureOpenAI = false
