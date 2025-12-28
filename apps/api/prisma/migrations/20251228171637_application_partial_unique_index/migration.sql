-- DropIndex
-- Remove the old unique constraint that blocked reapplication after soft delete
DROP INDEX "applications_userId_jobPostingId_key";

-- CreateIndex
-- Create partial unique index: only enforce uniqueness for non-deleted applications
-- This allows users to create a new application for the same job after deleting the old one
CREATE UNIQUE INDEX "applications_userId_jobPostingId_active_idx" 
  ON "applications" ("userId", "jobPostingId") 
  WHERE "deletedAt" IS NULL;
