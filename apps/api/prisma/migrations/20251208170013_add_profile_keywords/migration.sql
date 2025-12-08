-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "lastKeywordsExtractedAt" TIMESTAMP(3),
ADD COLUMN     "profileKeywords" JSONB;
