-- AlterTable - Remove translation cache fields (no longer needed after removing translation feature)
ALTER TABLE "applications" DROP COLUMN IF EXISTS "cachedTranslations";
ALTER TABLE "applications" DROP COLUMN IF EXISTS "contentHash";
ALTER TABLE "applications" DROP COLUMN IF EXISTS "contentLanguage";
