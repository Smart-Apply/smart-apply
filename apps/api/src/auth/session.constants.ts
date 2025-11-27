/**
 * Session management configuration constants
 */

/**
 * Maximum number of active sessions allowed per user
 * When exceeded, oldest sessions are automatically revoked (FIFO)
 */
export const MAX_SESSIONS_PER_USER = 5;

/**
 * Maximum number of active refresh tokens per user
 * This should match MAX_SESSIONS_PER_USER for consistency
 */
export const MAX_TOKENS_PER_USER = 5;

/**
 * Session expiration duration in days
 * Sessions are automatically cleaned up after this period
 */
export const SESSION_EXPIRATION_DAYS = 30;

/**
 * Cleanup period for revoked sessions in days
 * Revoked sessions older than this are permanently deleted
 */
export const REVOKED_SESSION_CLEANUP_DAYS = 30;
