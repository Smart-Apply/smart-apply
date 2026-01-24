-- Schema Improvements Migration
-- This migration adds enums, removes redundant indexes, and adds unique constraints
-- with proper data conversion for existing records

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "LanguageProficiency" AS ENUM ('NATIVE', 'FLUENT', 'ADVANCED', 'INTERMEDIATE', 'BASIC');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('MOBILE', 'TABLET', 'DESKTOP', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'REGISTER', 'PASSWORD_CHANGE', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_COMPLETE', 'SESSION_CREATE', 'SESSION_REVOKE', 'TOKEN_REFRESH', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'EMAIL_CHANGE', 'PROFILE_UPDATE', 'RATE_LIMIT_EXCEEDED', 'SUSPICIOUS_ACTIVITY', 'CSRF_VIOLATION');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- DropIndex (redundant indexes - @unique already creates implicit index)
DROP INDEX IF EXISTS "refresh_tokens_token_idx";
DROP INDEX IF EXISTS "subscriptions_stripeCustomerId_idx";
DROP INDEX IF EXISTS "users_email_idx";

-- AlterTable: user_preferences - Convert theme string to enum
-- First, backup old data
ALTER TABLE "user_preferences" RENAME COLUMN "theme" TO "theme_old";
-- Add new enum column with default
ALTER TABLE "user_preferences" ADD COLUMN "theme" "Theme" NOT NULL DEFAULT 'SYSTEM';
-- Convert existing data
UPDATE "user_preferences" SET "theme" = 
  CASE 
    WHEN LOWER("theme_old") = 'light' THEN 'LIGHT'::"Theme"
    WHEN LOWER("theme_old") = 'dark' THEN 'DARK'::"Theme"
    ELSE 'SYSTEM'::"Theme"
  END;
-- Drop old column
ALTER TABLE "user_preferences" DROP COLUMN "theme_old";

-- AlterTable: skills - Convert level string to enum
-- First, rename old column
ALTER TABLE "skills" RENAME COLUMN "level" TO "level_old";
-- Add new enum column (nullable since original was nullable)
ALTER TABLE "skills" ADD COLUMN "level" "SkillLevel";
-- Convert existing data
UPDATE "skills" SET "level" = 
  CASE 
    WHEN LOWER("level_old") LIKE '%beginner%' OR LOWER("level_old") LIKE '%anfänger%' THEN 'BEGINNER'::"SkillLevel"
    WHEN LOWER("level_old") LIKE '%intermediate%' OR LOWER("level_old") LIKE '%fortgeschritt%' THEN 'INTERMEDIATE'::"SkillLevel"
    WHEN LOWER("level_old") LIKE '%advanced%' OR LOWER("level_old") LIKE '%gut%' THEN 'ADVANCED'::"SkillLevel"
    WHEN LOWER("level_old") LIKE '%expert%' OR LOWER("level_old") LIKE '%experte%' THEN 'EXPERT'::"SkillLevel"
    ELSE NULL
  END;
-- Drop old column
ALTER TABLE "skills" DROP COLUMN "level_old";

-- AlterTable: languages - Add legacy column and convert level to enum
-- Add legacy column for backup
ALTER TABLE "languages" ADD COLUMN "levelLegacy" TEXT;
-- Backup existing data
UPDATE "languages" SET "levelLegacy" = "level";
-- Rename old column
ALTER TABLE "languages" RENAME COLUMN "level" TO "level_old";
-- Add new enum column (nullable)
ALTER TABLE "languages" ADD COLUMN "level" "LanguageProficiency";
-- Convert existing data
UPDATE "languages" SET "level" = 
  CASE 
    WHEN LOWER("level_old") LIKE '%native%' OR LOWER("level_old") LIKE '%muttersprache%' THEN 'NATIVE'::"LanguageProficiency"
    WHEN LOWER("level_old") LIKE '%fluent%' OR LOWER("level_old") LIKE '%fließend%' THEN 'FLUENT'::"LanguageProficiency"
    WHEN LOWER("level_old") LIKE '%advanced%' OR LOWER("level_old") LIKE '%fortgeschritt%' THEN 'ADVANCED'::"LanguageProficiency"
    WHEN LOWER("level_old") LIKE '%intermediate%' OR LOWER("level_old") LIKE '%gut%' THEN 'INTERMEDIATE'::"LanguageProficiency"
    WHEN LOWER("level_old") LIKE '%basic%' OR LOWER("level_old") LIKE '%grundkenntnisse%' THEN 'BASIC'::"LanguageProficiency"
    ELSE 'INTERMEDIATE'::"LanguageProficiency" -- Default fallback
  END;
-- Drop old column
ALTER TABLE "languages" DROP COLUMN "level_old";

-- AlterTable: sessions - Convert deviceType string to enum
ALTER TABLE "sessions" RENAME COLUMN "deviceType" TO "deviceType_old";
ALTER TABLE "sessions" ADD COLUMN "deviceType" "DeviceType";
UPDATE "sessions" SET "deviceType" = 
  CASE 
    WHEN LOWER("deviceType_old") = 'mobile' THEN 'MOBILE'::"DeviceType"
    WHEN LOWER("deviceType_old") = 'tablet' THEN 'TABLET'::"DeviceType"
    WHEN LOWER("deviceType_old") = 'desktop' THEN 'DESKTOP'::"DeviceType"
    ELSE 'UNKNOWN'::"DeviceType"
  END
WHERE "deviceType_old" IS NOT NULL;
ALTER TABLE "sessions" DROP COLUMN "deviceType_old";

-- AlterTable: audit_logs - Convert eventType and severity to enums
-- Note: This will fail if there are records with values not in the enum
-- Backup and convert eventType
ALTER TABLE "audit_logs" RENAME COLUMN "eventType" TO "eventType_old";
ALTER TABLE "audit_logs" ADD COLUMN "eventType" "AuditEventType";
UPDATE "audit_logs" SET "eventType" = 
  CASE 
    WHEN UPPER("eventType_old") = 'LOGIN_SUCCESS' THEN 'LOGIN_SUCCESS'::"AuditEventType"
    WHEN UPPER("eventType_old") = 'LOGIN_FAILURE' THEN 'LOGIN_FAILURE'::"AuditEventType"
    WHEN UPPER("eventType_old") = 'LOGOUT' THEN 'LOGOUT'::"AuditEventType"
    WHEN UPPER("eventType_old") = 'REGISTER' THEN 'REGISTER'::"AuditEventType"
    WHEN UPPER("eventType_old") = 'PASSWORD_CHANGE' THEN 'PASSWORD_CHANGE'::"AuditEventType"
    WHEN UPPER("eventType_old") = 'PASSWORD_RESET_REQUEST' THEN 'PASSWORD_RESET_REQUEST'::"AuditEventType"
    WHEN UPPER("eventType_old") = 'PASSWORD_RESET_COMPLETE' THEN 'PASSWORD_RESET_COMPLETE'::"AuditEventType"
    WHEN UPPER("eventType_old") = 'SESSION_CREATE' THEN 'SESSION_CREATE'::"AuditEventType"
    WHEN UPPER("eventType_old") = 'SESSION_REVOKE' THEN 'SESSION_REVOKE'::"AuditEventType"
    WHEN UPPER("eventType_old") = 'TOKEN_REFRESH' THEN 'TOKEN_REFRESH'::"AuditEventType"
    WHEN UPPER("eventType_old") = 'ACCOUNT_LOCKED' THEN 'ACCOUNT_LOCKED'::"AuditEventType"
    WHEN UPPER("eventType_old") = 'ACCOUNT_UNLOCKED' THEN 'ACCOUNT_UNLOCKED'::"AuditEventType"
    WHEN UPPER("eventType_old") = 'EMAIL_CHANGE' THEN 'EMAIL_CHANGE'::"AuditEventType"
    WHEN UPPER("eventType_old") = 'PROFILE_UPDATE' THEN 'PROFILE_UPDATE'::"AuditEventType"
    WHEN UPPER("eventType_old") = 'RATE_LIMIT_EXCEEDED' THEN 'RATE_LIMIT_EXCEEDED'::"AuditEventType"
    WHEN UPPER("eventType_old") = 'SUSPICIOUS_ACTIVITY' THEN 'SUSPICIOUS_ACTIVITY'::"AuditEventType"
    WHEN UPPER("eventType_old") = 'CSRF_VIOLATION' THEN 'CSRF_VIOLATION'::"AuditEventType"
    ELSE 'LOGIN_SUCCESS'::"AuditEventType" -- Fallback, should not happen
  END;
-- Make eventType NOT NULL after conversion
ALTER TABLE "audit_logs" ALTER COLUMN "eventType" SET NOT NULL;
ALTER TABLE "audit_logs" DROP COLUMN "eventType_old";

-- Backup and convert severity
ALTER TABLE "audit_logs" RENAME COLUMN "severity" TO "severity_old";
ALTER TABLE "audit_logs" ADD COLUMN "severity" "AuditSeverity";
UPDATE "audit_logs" SET "severity" = 
  CASE 
    WHEN LOWER("severity_old") = 'info' THEN 'INFO'::"AuditSeverity"
    WHEN LOWER("severity_old") = 'warning' THEN 'WARNING'::"AuditSeverity"
    WHEN LOWER("severity_old") = 'critical' THEN 'CRITICAL'::"AuditSeverity"
    ELSE 'INFO'::"AuditSeverity"
  END;
-- Make severity NOT NULL after conversion
ALTER TABLE "audit_logs" ALTER COLUMN "severity" SET NOT NULL;
ALTER TABLE "audit_logs" DROP COLUMN "severity_old";

-- AlterTable: subscription_usage - Add createdAt
ALTER TABLE "subscription_usage" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex: New indexes
CREATE INDEX "applications_jobPostingId_idx" ON "applications"("jobPostingId");

-- Recreate audit_logs indexes with correct column types
DROP INDEX IF EXISTS "audit_logs_eventType_idx";
DROP INDEX IF EXISTS "audit_logs_severity_idx";
CREATE INDEX "audit_logs_eventType_idx" ON "audit_logs"("eventType");
CREATE INDEX "audit_logs_severity_idx" ON "audit_logs"("severity");

-- CreateIndex: Unique constraints
-- First, remove duplicates if any exist (keep the first occurrence)
DELETE FROM "languages" a USING "languages" b
WHERE a.id > b.id AND a."profileId" = b."profileId" AND a."name" = b."name";

DELETE FROM "skills" a USING "skills" b
WHERE a.id > b.id AND a."profileId" = b."profileId" AND a."name" = b."name";

DELETE FROM "templates" a USING "templates" b
WHERE a.id > b.id AND a."name" = b."name" AND a."type" = b."type" AND a."language" = b."language";

-- Now create unique indexes
CREATE UNIQUE INDEX "languages_profileId_name_key" ON "languages"("profileId", "name");
CREATE UNIQUE INDEX "skills_profileId_name_key" ON "skills"("profileId", "name");
CREATE UNIQUE INDEX "templates_name_type_language_key" ON "templates"("name", "type", "language");
