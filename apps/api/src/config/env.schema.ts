import { z } from 'zod';

const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),

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
  LLM_PROVIDER: z.enum(['azure-openai', 'mock', 'huggingface']).default('mock'),

  // Hugging Face
  HUGGINGFACE_API_KEY: z.string().optional(),
  HUGGINGFACE_MODEL: z.string().default('meta-llama/Llama-2-7b-chat-hf'),

  // PDF Generation
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),

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

  // Rate Limiting - Default (general API endpoints)
  RATE_LIMIT_TTL: z.string().default('900'), // 15 minutes in seconds
  RATE_LIMIT_MAX: z.string().default('100'),

  // Rate Limiting - Auth endpoints (stricter)
  RATE_LIMIT_AUTH_TTL: z.string().default('900'), // 15 minutes in seconds
  RATE_LIMIT_AUTH_MAX: z.string().default('5'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(): EnvConfig {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n');
      throw new Error(`❌ Environment validation failed:\n${missingVars}`);
    }
    throw error;
  }
}
