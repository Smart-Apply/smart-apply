-- CreateIndex
-- Add sorted index for Application list queries (ordered by createdAt DESC)
CREATE INDEX "applications_userId_createdAt_idx" ON "applications"("userId", "createdAt" DESC);

-- CreateIndex
-- Add unique constraint to prevent duplicate applications for same job posting
CREATE UNIQUE INDEX "applications_userId_jobPostingId_key" ON "applications"("userId", "jobPostingId");

-- CreateIndex
-- Add sorted index for JobPosting list queries (ordered by createdAt DESC)
CREATE INDEX "job_postings_userId_createdAt_idx" ON "job_postings"("userId", "createdAt" DESC);

-- CreateIndex
-- Add composite index for RefreshToken cleanup queries (find by userId and expiresAt)
CREATE INDEX "refresh_tokens_userId_expiresAt_idx" ON "refresh_tokens"("userId", "expiresAt");

-- CreateIndex
-- Add composite index for Session cleanup queries (find by userId and expiresAt)
CREATE INDEX "sessions_userId_expiresAt_idx" ON "sessions"("userId", "expiresAt");

-- CreateIndex
-- Add sorted index for AuditLog queries (ordered by createdAt DESC)
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);
