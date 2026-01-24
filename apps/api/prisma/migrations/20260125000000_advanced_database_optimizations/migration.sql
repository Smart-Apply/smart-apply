-- Advanced Database Optimizations Migration
-- 4. Partial indexes for active sessions
-- 5. Partial indexes for soft delete queries
-- 6. Foreign key indexes on template relations
-- 8. Database-level defaults for timestamps
-- 9. Materialized views for dashboard statistics

-- ============================================
-- 4. PARTIAL INDEX FOR ACTIVE SESSIONS
-- ============================================

-- Only index active, non-expired sessions (smaller index, faster lookups)
CREATE INDEX IF NOT EXISTS "sessions_active_partial_idx" 
ON "sessions" ("userId", "lastActiveAt" DESC) 
WHERE "isActive" = true;

-- Index for session cleanup queries (find expired sessions)
CREATE INDEX IF NOT EXISTS "sessions_expired_cleanup_idx" 
ON "sessions" ("expiresAt") 
WHERE "isActive" = true;

-- ============================================
-- 5. PARTIAL INDEXES FOR SOFT DELETE QUERIES
-- ============================================

-- Applications: Most queries filter by deletedAt IS NULL
CREATE INDEX IF NOT EXISTS "applications_active_user_created_idx" 
ON "applications" ("userId", "createdAt" DESC) 
WHERE "deletedAt" IS NULL;

-- Applications: Active applications by status
CREATE INDEX IF NOT EXISTS "applications_active_status_idx" 
ON "applications" ("userId", "applicationStatus") 
WHERE "deletedAt" IS NULL;

-- Job Postings: Most queries filter by deletedAt IS NULL
CREATE INDEX IF NOT EXISTS "job_postings_active_user_created_idx" 
ON "job_postings" ("userId", "createdAt" DESC) 
WHERE "deletedAt" IS NULL;

-- Job Postings: Search active postings by company
CREATE INDEX IF NOT EXISTS "job_postings_active_company_idx" 
ON "job_postings" ("userId", "company") 
WHERE "deletedAt" IS NULL;

-- ============================================
-- 6. COMPOSITE INDEX ON TEMPLATE RELATIONS
-- ============================================

-- When loading applications with templates, both template IDs are often accessed
CREATE INDEX IF NOT EXISTS "applications_templates_idx" 
ON "applications" ("coverLetterTemplateId", "resumeTemplateId") 
WHERE "coverLetterTemplateId" IS NOT NULL OR "resumeTemplateId" IS NOT NULL;

-- ============================================
-- 8. DATABASE-LEVEL DEFAULTS FOR TIMESTAMPS
-- ============================================

-- Ensure createdAt defaults are set at database level (not just Prisma)
-- This provides an extra layer of data integrity

ALTER TABLE "users" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "profiles" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "job_postings" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "applications" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "templates" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "refresh_tokens" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "sessions" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "audit_logs" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "subscriptions" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "subscription_usage" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "user_preferences" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- ============================================
-- 9. MATERIALIZED VIEWS FOR DASHBOARD STATISTICS
-- ============================================

-- User statistics materialized view (for dashboard)
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_user_statistics" AS
SELECT 
  u.id AS "userId",
  COUNT(DISTINCT a.id) FILTER (WHERE a."deletedAt" IS NULL) AS "totalApplications",
  COUNT(DISTINCT a.id) FILTER (WHERE a."deletedAt" IS NULL AND a."applicationStatus" = 'CREATED') AS "createdApplications",
  COUNT(DISTINCT a.id) FILTER (WHERE a."deletedAt" IS NULL AND a."applicationStatus" = 'APPLIED') AS "appliedApplications",
  COUNT(DISTINCT a.id) FILTER (WHERE a."deletedAt" IS NULL AND a."applicationStatus" = 'INTERVIEW') AS "interviewApplications",
  COUNT(DISTINCT a.id) FILTER (WHERE a."deletedAt" IS NULL AND a."applicationStatus" = 'ACCEPTED') AS "acceptedApplications",
  COUNT(DISTINCT a.id) FILTER (WHERE a."deletedAt" IS NULL AND a."applicationStatus" = 'REJECTED') AS "rejectedApplications",
  COUNT(DISTINCT jp.id) FILTER (WHERE jp."deletedAt" IS NULL) AS "totalJobPostings",
  COUNT(DISTINCT a.id) FILTER (WHERE a."deletedAt" IS NULL AND a."createdAt" >= CURRENT_DATE - INTERVAL '30 days') AS "applicationsLast30Days",
  MAX(a."createdAt") FILTER (WHERE a."deletedAt" IS NULL) AS "lastApplicationDate"
FROM "users" u
LEFT JOIN "applications" a ON u.id = a."userId"
LEFT JOIN "job_postings" jp ON u.id = jp."userId"
GROUP BY u.id;

-- Index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS "mv_user_statistics_userid_idx" ON "mv_user_statistics" ("userId");

-- Application status distribution materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_application_status_distribution" AS
SELECT 
  "userId",
  "applicationStatus",
  COUNT(*) AS "count",
  ROUND(AVG("matchScore")::numeric, 2) AS "avgMatchScore"
FROM "applications"
WHERE "deletedAt" IS NULL
GROUP BY "userId", "applicationStatus";

-- Index on status distribution view
CREATE INDEX IF NOT EXISTS "mv_app_status_dist_userid_idx" ON "mv_application_status_distribution" ("userId");

-- Monthly application trends materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_monthly_application_trends" AS
SELECT 
  "userId",
  DATE_TRUNC('month', "createdAt") AS "month",
  COUNT(*) AS "applicationCount",
  COUNT(*) FILTER (WHERE "status" = 'READY') AS "completedCount",
  COUNT(*) FILTER (WHERE "status" = 'FAILED') AS "failedCount"
FROM "applications"
WHERE "deletedAt" IS NULL
GROUP BY "userId", DATE_TRUNC('month', "createdAt");

-- Index on monthly trends view
CREATE INDEX IF NOT EXISTS "mv_monthly_trends_userid_idx" ON "mv_monthly_application_trends" ("userId", "month" DESC);

-- ============================================
-- FUNCTION TO REFRESH ALL MATERIALIZED VIEWS
-- ============================================

CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_user_statistics";
  REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_application_status_distribution";
  REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_monthly_application_trends";
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON MATERIALIZED VIEW "mv_user_statistics" IS 'Cached user dashboard statistics. Refresh periodically or after significant changes.';
COMMENT ON MATERIALIZED VIEW "mv_application_status_distribution" IS 'Application status counts per user. Refresh after status changes.';
COMMENT ON MATERIALIZED VIEW "mv_monthly_application_trends" IS 'Monthly application trends per user. Refresh daily.';
COMMENT ON FUNCTION refresh_all_materialized_views() IS 'Refreshes all materialized views concurrently. Call periodically (e.g., every 5 minutes via cron).';
