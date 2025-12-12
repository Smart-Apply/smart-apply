-- AlterTable
ALTER TABLE "applications" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "job_postings" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "applications_userId_deletedAt_idx" ON "applications"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "job_postings_userId_deletedAt_idx" ON "job_postings"("userId", "deletedAt");
