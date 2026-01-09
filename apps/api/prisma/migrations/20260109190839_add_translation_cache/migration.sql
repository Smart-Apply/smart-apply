-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "cachedTranslations" JSONB,
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "sourceLanguage" TEXT;
