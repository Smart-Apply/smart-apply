-- Email Tracking (Premium feature)
-- Adds:
--   - ApplicationStatusSource enum + applications.statusSource column
--   - user_preferences.emailTrackingNotify column (default true)
--   - MailboxProvider, MailboxConnectionStatus enums
--   - mailbox_connections table (OAuth tokens encrypted at rest)
--   - EmailClassification enum
--   - application_email_events table (audit trail; no email bodies stored)
--
-- Forward-only. Rollback via Neon point-in-time-restore (see
-- docs/security/MIGRATION_ROLLBACK.md).

-- ===================== Enums =====================
CREATE TYPE "ApplicationStatusSource" AS ENUM ('SYSTEM', 'USER', 'EMAIL_TRACKING');

CREATE TYPE "MailboxProvider" AS ENUM ('MICROSOFT', 'GOOGLE');

CREATE TYPE "MailboxConnectionStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR');

CREATE TYPE "EmailClassification" AS ENUM (
  'APPLIED_CONFIRMATION',
  'INTERVIEW_INVITE',
  'OFFER',
  'REJECTION',
  'REQUEST_FOR_INFO',
  'OTHER'
);

-- ===================== applications.statusSource =====================
ALTER TABLE "applications"
  ADD COLUMN "statusSource" "ApplicationStatusSource" NOT NULL DEFAULT 'SYSTEM';

-- ===================== user_preferences.emailTrackingNotify =====================
ALTER TABLE "user_preferences"
  ADD COLUMN "emailTrackingNotify" BOOLEAN NOT NULL DEFAULT true;

-- ===================== mailbox_connections =====================
CREATE TABLE "mailbox_connections" (
  "id"                      TEXT NOT NULL,
  "userId"                  TEXT NOT NULL,
  "provider"                "MailboxProvider" NOT NULL,
  "status"                  "MailboxConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "emailAddress"            TEXT NOT NULL,
  "refreshTokenCiphertext"  TEXT NOT NULL,
  "refreshTokenIv"          TEXT NOT NULL,
  "refreshTokenAuthTag"     TEXT NOT NULL,
  "scope"                   TEXT,
  "subscriptionId"          TEXT,
  "subscriptionExpiresAt"   TIMESTAMP(3),
  "webhookClientState"      TEXT NOT NULL,
  "lastSyncedAt"            TIMESTAMP(3),
  "lastErrorAt"             TIMESTAMP(3),
  "lastErrorMessage"        TEXT,
  "consecutiveErrors"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mailbox_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mailbox_connections_subscriptionId_key"
  ON "mailbox_connections"("subscriptionId");

CREATE UNIQUE INDEX "mailbox_connections_userId_provider_key"
  ON "mailbox_connections"("userId", "provider");

CREATE INDEX "mailbox_connections_userId_idx"
  ON "mailbox_connections"("userId");

CREATE INDEX "mailbox_connections_status_subscriptionExpiresAt_idx"
  ON "mailbox_connections"("status", "subscriptionExpiresAt");

ALTER TABLE "mailbox_connections"
  ADD CONSTRAINT "mailbox_connections_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===================== application_email_events =====================
CREATE TABLE "application_email_events" (
  "id"                      TEXT NOT NULL,
  "mailboxConnectionId"     TEXT NOT NULL,
  "applicationId"           TEXT,
  "providerMessageId"       TEXT NOT NULL,
  "fromAddress"             TEXT NOT NULL,
  "fromName"                TEXT,
  "subject"                 VARCHAR(500) NOT NULL,
  "receivedAt"              TIMESTAMP(3) NOT NULL,
  "classification"          "EmailClassification",
  "confidence"              DOUBLE PRECISION,
  "classifierModel"         TEXT,
  "resultedInStatusChange"  BOOLEAN NOT NULL DEFAULT false,
  "previousStatus"          "ApplicationTrackingStatus",
  "newStatus"               "ApplicationTrackingStatus",
  "notificationSent"        BOOLEAN NOT NULL DEFAULT false,
  "reason"                  TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_email_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "application_email_events_mailboxConnectionId_providerMessageId_key"
  ON "application_email_events"("mailboxConnectionId", "providerMessageId");

CREATE INDEX "application_email_events_applicationId_createdAt_idx"
  ON "application_email_events"("applicationId", "createdAt" DESC);

CREATE INDEX "application_email_events_mailboxConnectionId_createdAt_idx"
  ON "application_email_events"("mailboxConnectionId", "createdAt" DESC);

ALTER TABLE "application_email_events"
  ADD CONSTRAINT "application_email_events_mailboxConnectionId_fkey"
  FOREIGN KEY ("mailboxConnectionId") REFERENCES "mailbox_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "application_email_events"
  ADD CONSTRAINT "application_email_events_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
