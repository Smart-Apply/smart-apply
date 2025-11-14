/*
  Warnings:

  - Added the required column `userId` to the `job_postings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "job_postings" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "job_postings_userId_idx" ON "job_postings"("userId");

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
