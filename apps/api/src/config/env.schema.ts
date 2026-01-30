import { z } from 'zod';

const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT
  JWT_SECRET: z
    .string()
    .min(64, 'JWT_SECRET must be at least 64 characters for security')
    .refine(
      (val) => !val.includes('change') && !val.includes('REPLACE') && !val.includes('example'),
      'JWT_SECRET cannot contain placeholder text - generate with: openssl rand -base64 64',
    ),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'), // Short-lived access tokens
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'), // Long-lived refresh tokens
  // Legacy support
  JWT_EXPIRES_IN: z.string().default('15m'),

  // Storage
  STORAGE_DRIVER: z.enum(['disk', 'azure']).default('disk'),
  AZURE_STORAGE_ACCOUNT: z.string().optional(),
  AZURE_STORAGE_CONTAINER: z.string().default('smartapply'),
  AZURE_STORAGE_CONNECTION_STRING: z.string().optional(),

  // Jobs / Queue
  JOBS_DRIVER: z.enum(['in-memory', 'service-bus']).default('in-memory'),

  // Azure Service Bus
  SERVICE_BUS_CONNECTION_STRING: z.string().optional(),
  SERVICE_BUS_QUEUE_NAME: z.string().default('application-jobs'),

  // Azure Key Vault
  KEY_VAULT_URI: z.string().optional(),

  // Azure OpenAI
  AZURE_OPENAI_ENDPOINT: z.string().optional(),
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT_NAME: z.string().default('gpt-4o'),
  AZURE_OPENAI_API_VERSION: z.string().default('2024-02-15-preview'),
  LLM_PROVIDER: z.enum(['azure-openai', 'azure-ai-foundry', 'mock', 'huggingface']).default('mock'),

  // LLM Configuration (reuses AZURE_OPENAI_DEPLOYMENT_NAME for model)
  LLM_TEMPERATURE_DEFAULT: z.string().optional(),
  LLM_MAX_TOKENS_DEFAULT: z.string().optional(),
  LOG_LLM_CALLS: z.string().optional(),

  // Azure AI Foundry Agents
  AZURE_AI_FOUNDRY_CV_WRITER_ENDPOINT: z.string().optional(),
  AZURE_AI_FOUNDRY_CL_WRITER_ENDPOINT: z.string().optional(),
  AZURE_AI_FOUNDRY_API_KEY: z.string().optional(),

  // Azure AI Foundry Agent IDs
  PROJECT_ENDPOINT: z.string().optional(),
  ATS_AGENT_ID: z.string().optional(),
  CV_WRITER_AGENT_ID: z.string().optional(),
  CL_WRITER_AGENT_ID: z.string().optional(),

  // Hugging Face
  HUGGINGFACE_API_KEY: z.string().optional(),
  HUGGINGFACE_MODEL: z.string().default('meta-llama/Llama-2-7b-chat-hf'),

  // PDF Generation
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
  PUPPETEER_MAX_BROWSERS: z.string().default('5'), // Maximum concurrent browser instances
  PUPPETEER_MIN_BROWSERS: z.string().default('1'), // Minimum browser instances to keep alive
  PUPPETEER_IDLE_TIMEOUT_MS: z.string().default('300000'), // Close idle browsers after 5 minutes
  PUPPETEER_EVICTION_INTERVAL_MS: z.string().default('60000'), // Check for idle browsers every 60s

  // File Upload
  MAX_FILE_SIZE_MB: z.string().default('10'),
  MAX_PROFILE_PHOTO_SIZE_MB: z.string().default('5'),

  // OAuth (Optional)
  AZURE_AD_CLIENT_ID: z.string().optional(),
  AZURE_AD_CLIENT_SECRET: z.string().optional(),
  AZURE_AD_TENANT_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Security
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
  ENABLE_CSRF: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  CSP_REPORT_ONLY: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),

  // Rate Limiting - Default (general API endpoints)
  RATE_LIMIT_TTL: z.string().default('60'), // 1 minute in seconds (shorter window for development)
  RATE_LIMIT_MAX: z.string().default('5000'), // Very high for development to avoid blocking during testing (lower in production)

  // Rate Limiting - Auth endpoints (stricter)
  RATE_LIMIT_AUTH_TTL: z.string().default('900'), // 15 minutes in seconds
  RATE_LIMIT_AUTH_MAX: z.string().default('10'), // Increased from 5 to 10 for development

  // Cron Jobs
  ENABLE_CRON_JOBS: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),

  // Compression
  ENABLE_COMPRESSION: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),

  // Pagination
  DEFAULT_PAGE_SIZE: z.string().default('20'),
  MAX_PAGE_SIZE: z.string().default('100'),

  // Caching
  CACHE_TTL_SECONDS: z.string().default('3600'), // 1 hour TTL for static data (templates)

  // Circuit Breaker - LLM Service Protection
  LLM_CIRCUIT_BREAKER_TIMEOUT: z.string().default('60000'), // 60s timeout for LLM calls
  LLM_CIRCUIT_BREAKER_ERROR_THRESHOLD: z.string().default('50'), // Open circuit if 50% fail
  LLM_CIRCUIT_BREAKER_RESET_TIMEOUT: z.string().default('30000'), // Try again after 30s
  LLM_CIRCUIT_BREAKER_ROLLING_COUNT_TIMEOUT: z.string().default('10000'), // 10s window for rolling count
  LLM_CIRCUIT_BREAKER_ROLLING_COUNT_BUCKETS: z.string().default('10'), // 10 buckets for rolling count

  // Global Request Timeout
  REQUEST_TIMEOUT_MS: z.string().default('30000'), // 30s global timeout for all requests

  // Two-Factor Authentication
  TWO_FACTOR_ENCRYPTION_KEY: z
    .string()
    .length(64, 'TWO_FACTOR_ENCRYPTION_KEY must be 64 hex characters (32 bytes) for AES-256')
    .regex(/^[a-fA-F0-9]+$/, 'TWO_FACTOR_ENCRYPTION_KEY must be a valid hex string')
    .optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@example.com'),
  APP_URL: z.string().default('http://localhost:3001'), // Frontend URL for email links
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  // Debug logging only in development (before Pino is available)
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log('[EnvSchema] Validating environment config:', {
      configKeys: config ? Object.keys(config).length : 0,
      hasDatabase: !!config?.DATABASE_URL,
      hasJwtSecret: !!config?.JWT_SECRET,
    });
  }

  try {
    return envSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n')
        : 'Unknown validation error';
      throw new Error(`❌ Environment validation failed:\n${missingVars}`);
    }
    // Errors should always be logged regardless of environment
    // eslint-disable-next-line no-console
    console.error('[EnvSchema] Environment validation error (not ZodError):', error);
    throw error;
  }
}
