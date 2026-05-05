import { z } from 'zod';

const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /**
   * Logical deployment stage. Independent of NODE_ENV (which only switches
   * dev/prod build behaviour). Use this to select the correct downstream
   * services (DB, blob, queue, OpenAI, etc.). The value is also used by
   * `ConfigModule` to layer `.env.${APP_ENV}` on top of the shared `.env`.
   */
  APP_ENV: z.enum(['local', 'dev', 'int', 'prod']).default('local'),
  PORT: z.string().default('3000'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Direct (non-pooled) database URL — required for Prisma CLI / migrations
  // when DATABASE_URL points at a transaction-mode pooler (e.g. Neon pgbouncer,
  // Supabase Supavisor). Optional for plain Postgres connections.
  DIRECT_URL: z.string().optional(),

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
  STORAGE_DRIVER: z.enum(['disk', 'r2']).default('disk'),

  // Cloudflare R2 (S3-compatible) — used when STORAGE_DRIVER=r2
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().default('smart-apply-prod'),
  // Optional explicit endpoint override; otherwise built from R2_ACCOUNT_ID.
  R2_ENDPOINT: z.string().optional(),

  // Throttler storage backend (in-memory by default; "upstash" for distributed)
  THROTTLER_STORAGE: z.enum(['memory', 'upstash']).default('memory'),

  // Upstash Redis (REST) — used by THROTTLER_STORAGE=upstash and other features
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Jobs / Queue
  JOBS_DRIVER: z.enum(['in-memory', 'qstash']).default('in-memory'),

  // Upstash QStash — used when JOBS_DRIVER=qstash
  // Get values at https://console.upstash.com/qstash
  QSTASH_URL: z.string().optional(),
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  // Public URL the QStash service should POST job webhooks to.
  // Falls back to API_BASE_URL + '/api/v1/jobs/qstash-webhook' when unset.
  QSTASH_WEBHOOK_URL: z.string().optional(),

  // Azure OpenAI
  AZURE_OPENAI_ENDPOINT: z.string().optional(),
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT_NAME: z.string().default('gpt-4o'),
  AZURE_OPENAI_API_VERSION: z.string().default('2024-02-15-preview'),
  LLM_PROVIDER: z.enum(['azure-openai', 'azure-ai-foundry', 'mock']).default('mock'),

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
  // PRODUCTION RECOMMENDATION: set RATE_LIMIT_TTL=900 (15min) and RATE_LIMIT_MAX=300
  // The dev defaults below are intentionally permissive to avoid blocking during local testing.
  RATE_LIMIT_TTL: z.string().default('60'), // 1 minute in seconds (shorter window for development)
  RATE_LIMIT_MAX: z.string().default('5000'), // Very high for development to avoid blocking during testing (lower in production)

  // Rate Limiting - Auth endpoints (stricter)
  // PRODUCTION RECOMMENDATION: keep TTL=900 and set MAX=15
  // NOTE: 5 was too aggressive — legitimate users on Firefox/Safari with
  // strict tracking protection sometimes need to retry the registration
  // form a few times before Cloudflare Turnstile produces a valid token.
  // CAPTCHA failures themselves no longer consume the budget (they're
  // rejected by `CaptchaGuard` before the throttler runs), but typos in
  // password / 2FA / forgot-password flows still do, and 5/15min was
  // tripping real users.
  RATE_LIMIT_AUTH_TTL: z.string().default('900'), // 15 minutes in seconds
  RATE_LIMIT_AUTH_MAX: z.string().default('15'),

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

  // Inbox the public contact form forwards to. Defaults to EMAIL_FROM
  // when not explicitly set so misconfiguration never silently drops
  // user messages.
  SUPPORT_EMAIL: z.string().optional(),

  // Cloudflare Turnstile (invisible CAPTCHA) — protects /auth/register
  // against bot signups that would drain the LLM budget.
  // Get keys from https://dash.cloudflare.com/?to=/:account/turnstile
  // When TURNSTILE_SECRET_KEY is unset, the backend skips verification
  // and just logs a warning — useful for local dev without keys.
  TURNSTILE_SECRET_KEY: z.string().optional(),

  // Public base URL of the API (used for OAuth callback URLs in production)
  // In dev, defaults to http://localhost:${PORT}; in prod, set to https://api.<your-domain>
  API_BASE_URL: z.string().optional(),

  // Sentry error tracking (optional — if unset, Sentry stays disabled)
  SENTRY_DSN: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(), // commit SHA from CI for source-map matching

  // Apify (LinkedIn job search — Pro feature)
  // Get token from https://console.apify.com/account/integrations
  // When unset, the LinkedIn job search endpoint returns 503.
  APIFY_TOKEN: z.string().optional(),
  // Default actor: curious_coder/linkedin-jobs-scraper (id: hKByXkMQaC5Qt9UMN)
  APIFY_LINKEDIN_ACTOR_ID: z.string().default('hKByXkMQaC5Qt9UMN'),

  // Admin allow-list (comma-separated emails). Users whose `email` matches
  // one of these (case-insensitive) can call the /admin/* endpoints. When
  // unset, all /admin/* routes return 403.
  ADMIN_EMAILS: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  // Debug logging only in development (before Pino is available)
  if (process.env.NODE_ENV === 'development') {
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

    console.error('[EnvSchema] Environment validation error (not ZodError):', error);
    throw error;
  }
}
