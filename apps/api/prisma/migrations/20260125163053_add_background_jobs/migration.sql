-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTERED');

-- DropIndex
DROP INDEX "applications_user_app_status_created_idx";

-- DropIndex
DROP INDEX "applications_user_status_created_idx";

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
    "data" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deadLetterReason" TEXT,
    "deadLetteredAt" TIMESTAMP(3),

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "background_jobs_type_idx" ON "background_jobs"("type");

-- CreateIndex
CREATE INDEX "background_jobs_status_idx" ON "background_jobs"("status");

-- CreateIndex
CREATE INDEX "background_jobs_createdAt_idx" ON "background_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "background_jobs_type_status_idx" ON "background_jobs"("type", "status");
