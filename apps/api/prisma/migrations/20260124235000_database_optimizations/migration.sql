-- Database Optimizations Migration
-- 1. Composite indexes for common query patterns
-- 2. Full-text search index for job postings
-- 3. Check constraints for data integrity

-- ============================================
-- 1. COMPOSITE INDEXES FOR APPLICATION QUERIES
-- ============================================

-- Applications are often filtered by userId + status + sorted by createdAt
CREATE INDEX IF NOT EXISTS "applications_user_status_created_idx" 
ON "applications" ("userId", "status", "createdAt" DESC);

-- Applications filtered by userId + applicationStatus (user-facing status)
CREATE INDEX IF NOT EXISTS "applications_user_app_status_created_idx" 
ON "applications" ("userId", "applicationStatus", "createdAt" DESC);

-- ============================================
-- 2. FULL-TEXT SEARCH INDEX FOR JOB POSTINGS
-- ============================================

-- Add German text search configuration if not exists
-- PostgreSQL has built-in 'german' configuration

-- Full-text search index on job posting content (title, company, fullText)
-- Using GIN index for efficient text search
CREATE INDEX IF NOT EXISTS "job_postings_fulltext_idx" 
ON "job_postings" USING gin(
  to_tsvector('german', COALESCE("title", '') || ' ' || COALESCE("company", '') || ' ' || COALESCE("fullText", ''))
);

-- Also create an English variant for international job postings
CREATE INDEX IF NOT EXISTS "job_postings_fulltext_en_idx" 
ON "job_postings" USING gin(
  to_tsvector('english', COALESCE("title", '') || ' ' || COALESCE("company", '') || ' ' || COALESCE("fullText", ''))
);

-- ============================================
-- 3. CHECK CONSTRAINTS FOR DATA INTEGRITY
-- ============================================

-- Ensure matchScore is within valid range (0-100)
ALTER TABLE "applications" 
ADD CONSTRAINT "chk_applications_match_score" 
CHECK ("matchScore" IS NULL OR ("matchScore" >= 0 AND "matchScore" <= 100));

-- Ensure subscription usage counters are non-negative
ALTER TABLE "subscription_usage" 
ADD CONSTRAINT "chk_subscription_usage_applications" 
CHECK ("applicationsUsed" >= 0);

ALTER TABLE "subscription_usage" 
ADD CONSTRAINT "chk_subscription_usage_interviews" 
CHECK ("interviewSessionsUsed" >= 0);

-- Ensure subscription period dates are valid (end > start)
ALTER TABLE "subscription_usage" 
ADD CONSTRAINT "chk_subscription_usage_period" 
CHECK ("periodEnd" > "periodStart");

-- Ensure subscription current period dates are valid
ALTER TABLE "subscriptions" 
ADD CONSTRAINT "chk_subscriptions_period" 
CHECK ("currentPeriodEnd" IS NULL OR "currentPeriodStart" IS NULL OR "currentPeriodEnd" > "currentPeriodStart");

-- Ensure trial period dates are valid
ALTER TABLE "subscriptions" 
ADD CONSTRAINT "chk_subscriptions_trial" 
CHECK ("trialEnd" IS NULL OR "trialStart" IS NULL OR "trialEnd" > "trialStart");

-- Ensure session expiration is in the future relative to creation
ALTER TABLE "sessions" 
ADD CONSTRAINT "chk_sessions_expiration" 
CHECK ("expiresAt" > "createdAt");

-- Ensure refresh token expiration is in the future relative to creation
ALTER TABLE "refresh_tokens" 
ADD CONSTRAINT "chk_refresh_tokens_expiration" 
CHECK ("expiresAt" > "createdAt");

-- Ensure experience dates are valid (end >= start if both provided)
ALTER TABLE "experiences" 
ADD CONSTRAINT "chk_experiences_dates" 
CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

-- Ensure education years are valid (end >= start if both provided)
ALTER TABLE "education" 
ADD CONSTRAINT "chk_education_years" 
CHECK ("endYear" IS NULL OR "startYear" IS NULL OR "endYear" >= "startYear");

-- Ensure project dates are valid (end >= start if both provided)
ALTER TABLE "projects" 
ADD CONSTRAINT "chk_projects_dates" 
CHECK ("endDate" IS NULL OR "startDate" IS NULL OR "endDate" >= "startDate");

-- Ensure certificate expiry is after issue date
ALTER TABLE "certificates" 
ADD CONSTRAINT "chk_certificates_dates" 
CHECK ("expiryDate" IS NULL OR "issueDate" IS NULL OR "expiryDate" >= "issueDate");
