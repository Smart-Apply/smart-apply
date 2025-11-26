import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EnvConfig } from './env.schema';

@Injectable()
export class ConfigService {
  constructor(private nestConfig: NestConfigService<EnvConfig, true>) {}

  get nodeEnv(): string {
    return this.nestConfig.get('NODE_ENV', { infer: true });
  }

  get port(): number {
    return parseInt(this.nestConfig.get('PORT', { infer: true }), 10);
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  // Database
  get databaseUrl(): string {
    return this.nestConfig.get('DATABASE_URL', { infer: true });
  }

  // JWT
  get jwtSecret(): string {
    return this.nestConfig.get('JWT_SECRET', { infer: true });
  }

  get jwtExpiresIn(): string {
    return this.nestConfig.get('JWT_EXPIRES_IN', { infer: true });
  }

  get jwtAccessExpiresIn(): string {
    return this.nestConfig.get('JWT_ACCESS_EXPIRES_IN', { infer: true });
  }

  get jwtRefreshExpiresIn(): string {
    return this.nestConfig.get('JWT_REFRESH_EXPIRES_IN', { infer: true });
  }

  // Storage
  get storageDriver(): 'disk' | 'azure' {
    return this.nestConfig.get('STORAGE_DRIVER', { infer: true });
  }

  get azureStorageAccount(): string | undefined {
    return this.nestConfig.get('AZURE_STORAGE_ACCOUNT', { infer: true });
  }

  get azureStorageContainer(): string {
    return this.nestConfig.get('AZURE_STORAGE_CONTAINER', { infer: true });
  }

  get azureStorageConnectionString(): string | undefined {
    return this.nestConfig.get('AZURE_STORAGE_CONNECTION_STRING', { infer: true });
  }

  // Service Bus
  get serviceBusConnectionString(): string | undefined {
    return this.nestConfig.get('SERVICE_BUS_CONNECTION_STRING', { infer: true });
  }

  get serviceBusQueueName(): string {
    return this.nestConfig.get('SERVICE_BUS_QUEUE_NAME', { infer: true });
  }

  // Key Vault
  get keyVaultUri(): string | undefined {
    return this.nestConfig.get('KEY_VAULT_URI', { infer: true });
  }

  // Azure OpenAI
  get azureOpenAIEndpoint(): string | undefined {
    return this.nestConfig.get('AZURE_OPENAI_ENDPOINT', { infer: true });
  }

  get azureOpenAIApiKey(): string | undefined {
    return this.nestConfig.get('AZURE_OPENAI_API_KEY', { infer: true });
  }

  get azureOpenAIDeploymentName(): string {
    return this.nestConfig.get('AZURE_OPENAI_DEPLOYMENT_NAME', { infer: true });
  }

  get azureOpenAIApiVersion(): string {
    return this.nestConfig.get('AZURE_OPENAI_API_VERSION', { infer: true });
  }

  get llmProvider(): 'azure-openai' | 'azure-ai-foundry' | 'mock' | 'huggingface' {
    return this.nestConfig.get('LLM_PROVIDER', { infer: true });
  }

  get huggingFaceApiKey(): string | undefined {
    return this.nestConfig.get('HUGGINGFACE_API_KEY', { infer: true });
  }

  get huggingFaceModel(): string {
    return this.nestConfig.get('HUGGINGFACE_MODEL', { infer: true });
  }

  // Azure AI Foundry Agents
  get azureAIFoundryCvWriterEndpoint(): string | undefined {
    return this.nestConfig.get('AZURE_AI_FOUNDRY_CV_WRITER_ENDPOINT', { infer: true });
  }

  get azureAIFoundryClWriterEndpoint(): string | undefined {
    return this.nestConfig.get('AZURE_AI_FOUNDRY_CL_WRITER_ENDPOINT', { infer: true });
  }

  get azureAIFoundryApiKey(): string | undefined {
    return this.nestConfig.get('AZURE_AI_FOUNDRY_API_KEY', { infer: true });
  }

  // Jobs
  get jobsDriver(): 'in-memory' | 'service-bus' {
    return this.nestConfig.get('JOBS_DRIVER', { infer: true });
  }

  // PDF
  get puppeteerExecutablePath(): string | undefined {
    return this.nestConfig.get('PUPPETEER_EXECUTABLE_PATH', { infer: true });
  }

  // OAuth
  get azureAdClientId(): string | undefined {
    return this.nestConfig.get('AZURE_AD_CLIENT_ID', { infer: true });
  }

  get azureAdClientSecret(): string | undefined {
    return this.nestConfig.get('AZURE_AD_CLIENT_SECRET', { infer: true });
  }

  get azureAdTenantId(): string | undefined {
    return this.nestConfig.get('AZURE_AD_TENANT_ID', { infer: true });
  }

  get googleClientId(): string | undefined {
    return this.nestConfig.get('GOOGLE_CLIENT_ID', { infer: true });
  }

  get googleClientSecret(): string | undefined {
    return this.nestConfig.get('GOOGLE_CLIENT_SECRET', { infer: true });
  }

  // Security
  get corsOrigins(): string[] {
    return this.nestConfig.get('CORS_ORIGINS', { infer: true }).split(',');
  }

  get enableCsrf(): boolean {
    return this.nestConfig.get('ENABLE_CSRF', { infer: true });
  }

  get rateLimitTtl(): number {
    return parseInt(this.nestConfig.get('RATE_LIMIT_TTL', { infer: true }), 10) * 1000; // Convert to milliseconds
  }

  get rateLimitMax(): number {
    return parseInt(this.nestConfig.get('RATE_LIMIT_MAX', { infer: true }), 10);
  }

  get rateLimitAuthTtl(): number {
    return parseInt(this.nestConfig.get('RATE_LIMIT_AUTH_TTL', { infer: true }), 10) * 1000; // Convert to milliseconds
  }

  get rateLimitAuthMax(): number {
    return parseInt(this.nestConfig.get('RATE_LIMIT_AUTH_MAX', { infer: true }), 10);
  }

  get cspReportOnly(): boolean {
    return this.nestConfig.get('CSP_REPORT_ONLY', { infer: true });
  }
}
