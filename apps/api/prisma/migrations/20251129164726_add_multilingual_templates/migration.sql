-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "baseTemplateId" TEXT,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en';

-- CreateIndex
CREATE INDEX "templates_category_language_isActive_idx" ON "templates"("category", "language", "isActive");

-- CreateIndex
CREATE INDEX "templates_baseTemplateId_idx" ON "templates"("baseTemplateId");
