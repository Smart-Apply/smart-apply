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

  /**
   * Logical deployment stage — `local | dev | int | prod`. Use this to
   * branch on the environment when several stages share the same NODE_ENV
   * (e.g. `dev`, `int`, and `prod` are all NODE_ENV=production builds).
   */
  get appEnv(): 'local' | 'dev' | 'int' | 'prod' {
    return this.nestConfig.get('APP_ENV', { infer: true });
  }

  get isLocal(): boolean {
    return this.appEnv === 'local';
  }

  // Logging
  get logLevel(): 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent' {
    return this.nestConfig.get('LOG_LEVEL', { infer: true });
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
  get storageDriver(): 'disk' | 'r2' {
    return this.nestConfig.get('STORAGE_DRIVER', { infer: true });
  }

  // Cloudflare R2 (S3-compatible)
  get r2AccountId(): string | undefined {
    return this.nestConfig.get('R2_ACCOUNT_ID', { infer: true });
  }

  get r2AccessKeyId(): string | undefined {
    return this.nestConfig.get('R2_ACCESS_KEY_ID', { infer: true });
  }

  get r2SecretAccessKey(): string | undefined {
    return this.nestConfig.get('R2_SECRET_ACCESS_KEY', { infer: true });
  }

  get r2Bucket(): string {
    return this.nestConfig.get('R2_BUCKET', { infer: true });
  }

  get r2Endpoint(): string | undefined {
    return this.nestConfig.get('R2_ENDPOINT', { infer: true });
  }

  // Throttler storage backend
  get throttlerStorage(): 'memory' | 'upstash' {
    return this.nestConfig.get('THROTTLER_STORAGE', { infer: true });
  }

  // Upstash Redis (REST)
  get upstashRedisRestUrl(): string | undefined {
    return this.nestConfig.get('UPSTASH_REDIS_REST_URL', { infer: true });
  }

  get upstashRedisRestToken(): string | undefined {
    return this.nestConfig.get('UPSTASH_REDIS_REST_TOKEN', { infer: true });
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

  get llmProvider(): 'azure-openai' | 'azure-ai-foundry' | 'mock' {
    return this.nestConfig.get('LLM_PROVIDER', { infer: true });
  }

  // LLM Configuration (reuses existing Azure OpenAI deployment)
  get llmTemperatureDefault(): number {
    return parseFloat(this.nestConfig.get('LLM_TEMPERATURE_DEFAULT', { infer: true }) || '0.5');
  }

  get llmMaxTokensDefault(): number {
    return parseInt(this.nestConfig.get('LLM_MAX_TOKENS_DEFAULT', { infer: true }) || '2000', 10);
  }

  get logLlmCalls(): boolean {
    return this.nestConfig.get('LOG_LLM_CALLS', { infer: true }) === 'true';
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
  get jobsDriver(): 'in-memory' | 'qstash' {
    return this.nestConfig.get('JOBS_DRIVER', { infer: true });
  }

  // Upstash QStash (managed job queue, push-based)
  get qstashUrl(): string | undefined {
    return this.nestConfig.get('QSTASH_URL', { infer: true });
  }

  get qstashToken(): string | undefined {
    return this.nestConfig.get('QSTASH_TOKEN', { infer: true });
  }

  get qstashCurrentSigningKey(): string | undefined {
    return this.nestConfig.get('QSTASH_CURRENT_SIGNING_KEY', { infer: true });
  }

  get qstashNextSigningKey(): string | undefined {
    return this.nestConfig.get('QSTASH_NEXT_SIGNING_KEY', { infer: true });
  }

  get qstashWebhookUrl(): string {
    const explicit = this.nestConfig.get('QSTASH_WEBHOOK_URL', { infer: true });
    return explicit || `${this.apiBaseUrl}/api/v1/jobs/qstash-webhook`;
  }

  // PDF
  // (No tuning surface — react-pdf renders synchronously on the request thread
  // and pdf-v2/preview-renderer.service.ts loads pdfjs-dist + @napi-rs/canvas
  // lazily on first preview request.)

  // OAuth
  get azureAdClientId(): string | undefined {
    return this.nestConfig.get('AZURE_AD_CLIENT_ID', { infer: true });
  }

  get azureAdClientSecret(): string | undefined {
    return this.nestConfig.get('AZURE_AD_CLIENT_SECRET', { infer: true });
  }

  get azureAdTenantId(): string | undefined {
    return this.nestConfig.get('AZURE_AD_TENANT_ID', { infer: true }) || 'common';
  }

  get googleClientId(): string | undefined {
    return this.nestConfig.get('GOOGLE_CLIENT_ID', { infer: true });
  }

  get googleClientSecret(): string | undefined {
    return this.nestConfig.get('GOOGLE_CLIENT_SECRET', { infer: true });
  }

  // Admin allow-list (lower-cased)
  get adminEmails(): string[] {
    const raw = this.nestConfig.get('ADMIN_EMAILS', { infer: true }) as string | undefined;
    if (!raw) return [];
    return raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  // Public base URL of the API (used for OAuth callbacks)
  // Falls back to http://localhost:${PORT} when API_BASE_URL is not set (dev)
  get apiBaseUrl(): string {
    const fromEnv = this.nestConfig.get('API_BASE_URL', { infer: true });
    return fromEnv || `http://localhost:${this.port}`;
  }

  /**
   * Parent domain to scope auth cookies to (e.g. `.smart-apply.io`). When
   * set, the browser stores them as first-party for ALL subdomains, which
   * sidesteps Chrome's third-party-cookie tracking protection silently
   * dropping cookies between `staging.smart-apply.io` and
   * `api-staging.smart-apply.io`. Returns `undefined` locally so cookies
   * stay host-only on localhost.
   */
  get cookieDomain(): string | undefined {
    const value = this.nestConfig.get('COOKIE_DOMAIN', { infer: true });
    return value && value.trim().length > 0 ? value.trim() : undefined;
  }

  // OAuth Callback URLs (built from API_BASE_URL, must match the URL registered with the provider)
  get googleCallbackUrl(): string {
    return `${this.apiBaseUrl}/api/v1/auth/google/callback`;
  }

  get microsoftCallbackUrl(): string {
    return `${this.apiBaseUrl}/api/v1/auth/microsoft/callback`;
  }

  // Security
  get corsOrigins(): string[] {
    return this.nestConfig
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim());
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

  // Cron Jobs
  get enableCronJobs(): boolean {
    return this.nestConfig.get('ENABLE_CRON_JOBS', { infer: true });
  }

  // Compression
  get enableCompression(): boolean {
    return this.nestConfig.get('ENABLE_COMPRESSION', { infer: true });
  }

  // Pagination
  get defaultPageSize(): number {
    return parseInt(this.nestConfig.get('DEFAULT_PAGE_SIZE', { infer: true }), 10);
  }

  get maxPageSize(): number {
    return parseInt(this.nestConfig.get('MAX_PAGE_SIZE', { infer: true }), 10);
  }

  // Caching
  get cacheTtlSeconds(): number {
    return parseInt(this.nestConfig.get('CACHE_TTL_SECONDS', { infer: true }), 10);
  }

  // Circuit Breaker - LLM Service Protection
  get llmCircuitBreakerTimeout(): number {
    return parseInt(this.nestConfig.get('LLM_CIRCUIT_BREAKER_TIMEOUT', { infer: true }), 10);
  }

  get llmCircuitBreakerErrorThreshold(): number {
    return parseInt(
      this.nestConfig.get('LLM_CIRCUIT_BREAKER_ERROR_THRESHOLD', { infer: true }),
      10,
    );
  }

  get llmCircuitBreakerResetTimeout(): number {
    return parseInt(this.nestConfig.get('LLM_CIRCUIT_BREAKER_RESET_TIMEOUT', { infer: true }), 10);
  }

  get llmCircuitBreakerRollingCountTimeout(): number {
    return parseInt(
      this.nestConfig.get('LLM_CIRCUIT_BREAKER_ROLLING_COUNT_TIMEOUT', { infer: true }),
      10,
    );
  }

  get llmCircuitBreakerRollingCountBuckets(): number {
    return parseInt(
      this.nestConfig.get('LLM_CIRCUIT_BREAKER_ROLLING_COUNT_BUCKETS', { infer: true }),
      10,
    );
  }

  // Global Request Timeout
  get requestTimeoutMs(): number {
    return parseInt(this.nestConfig.get('REQUEST_TIMEOUT_MS', { infer: true }), 10);
  }

  // Two-Factor Authentication
  get twoFactorEncryptionKey(): Buffer | undefined {
    const keyHex = this.nestConfig.get('TWO_FACTOR_ENCRYPTION_KEY', { infer: true });
    if (!keyHex) return undefined;
    return Buffer.from(keyHex, 'hex');
  }

  // Email (Resend)
  get resendApiKey(): string | undefined {
    return this.nestConfig.get('RESEND_API_KEY', { infer: true });
  }

  get emailFrom(): string {
    return this.nestConfig.get('EMAIL_FROM', { infer: true });
  }

  get appUrl(): string {
    return this.nestConfig.get('APP_URL', { infer: true });
  }

  /**
   * Inbox that the public /contact form forwards user submissions to.
   * Falls back to `EMAIL_FROM` so we never silently drop messages on a
   * partial deploy.
   */
  get supportEmail(): string {
    return this.nestConfig.get('SUPPORT_EMAIL', { infer: true }) || this.emailFrom;
  }

  /**
   * Cloudflare Turnstile secret key. When unset, registration skips
   * captcha verification (handy for local dev). Production must set this
   * to actually block bot signups.
   */
  get turnstileSecretKey(): string | undefined {
    return this.nestConfig.get('TURNSTILE_SECRET_KEY', { infer: true });
  }

  // Apify (LinkedIn job search — Pro feature)
  get apifyToken(): string | undefined {
    return this.nestConfig.get('APIFY_TOKEN', { infer: true });
  }

  get apifyLinkedInActorId(): string {
    return this.nestConfig.get('APIFY_LINKEDIN_ACTOR_ID', { infer: true });
  }

  // ---------------------------------------------------------------------------
  // Email Tracking (Premium feature) — OAuth Inbox Sync
  // ---------------------------------------------------------------------------

  /**
   * AES-256-GCM key used to encrypt persisted OAuth refresh tokens in
   * `mailbox_connections`. 32 bytes (returned as Buffer). When unset, the
   * mailbox-sync module refuses to connect new mailboxes (existing rows
   * stay readable only if the key was set when they were written).
   */
  get mailboxTokenEncryptionKey(): Buffer | undefined {
    const keyHex = this.nestConfig.get('MAILBOX_TOKEN_ENCRYPTION_KEY', { infer: true });
    if (!keyHex) return undefined;
    return Buffer.from(keyHex, 'hex');
  }

  get msGraphClientId(): string | undefined {
    return this.nestConfig.get('MS_GRAPH_CLIENT_ID', { infer: true });
  }

  get msGraphClientSecret(): string | undefined {
    return this.nestConfig.get('MS_GRAPH_CLIENT_SECRET', { infer: true });
  }

  get msGraphTenant(): string {
    return this.nestConfig.get('MS_GRAPH_TENANT', { infer: true });
  }

  /**
   * Public callback URL the Microsoft consent screen redirects to. Built
   * from `apiBaseUrl` so it matches the URL registered with the Azure AD
   * app, regardless of stage.
   */
  get msGraphCallbackUrl(): string {
    return `${this.apiBaseUrl}/api/v1/mailbox-sync/microsoft/callback`;
  }

  /**
   * Public webhook URL Microsoft Graph POSTs change notifications to.
   * Must be HTTPS in prod (Graph rejects plain http for subscriptions).
   */
  get msGraphWebhookUrl(): string {
    return `${this.apiBaseUrl}/api/v1/mailbox-sync/microsoft/webhook`;
  }

  /**
   * Where the user is redirected after a successful OAuth round-trip.
   * Defaults to APP_URL + '/settings?email_tracking=connected'.
   */
  get msGraphPostConnectRedirect(): string {
    const explicit = this.nestConfig.get('MS_GRAPH_POST_CONNECT_REDIRECT', { infer: true });
    return explicit || `${this.appUrl}/settings?email_tracking=connected`;
  }

  /**
   * Renew Graph subscriptions when they have less than this many minutes left.
   * The renewal cron runs daily; default 6h margin keeps us safe even if a
   * cron run fails.
   */
  get mailboxSubscriptionRenewalMarginMinutes(): number {
    return parseInt(
      this.nestConfig.get('MAILBOX_SUBSCRIPTION_RENEWAL_MARGIN_MINUTES', { infer: true }),
      10,
    );
  }

  /**
   * True when the email-tracking module has all the secrets it needs to
   * accept new connections. Used by the controller to short-circuit with a
   * 503 instead of failing deep in the OAuth flow.
   */
  get mailboxSyncEnabled(): boolean {
    return Boolean(
      this.mailboxTokenEncryptionKey && this.msGraphClientId && this.msGraphClientSecret,
    );
  }
}
