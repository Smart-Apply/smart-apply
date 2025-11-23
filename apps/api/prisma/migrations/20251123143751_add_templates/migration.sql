-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('COVER_LETTER', 'RESUME', 'BOTH');

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "coverLetterTemplateId" TEXT,
ADD COLUMN     "resumeTemplateId" TEXT;

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "TemplateType" NOT NULL,
    "category" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "htmlTemplate" TEXT NOT NULL,
    "cssStyles" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "templates_type_isActive_idx" ON "templates"("type", "isActive");

-- CreateIndex
CREATE INDEX "templates_isDefault_idx" ON "templates"("isDefault");

-- CreateIndex
CREATE INDEX "applications_coverLetterTemplateId_idx" ON "applications"("coverLetterTemplateId");

-- CreateIndex
CREATE INDEX "applications_resumeTemplateId_idx" ON "applications"("resumeTemplateId");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_coverLetterTemplateId_fkey" FOREIGN KEY ("coverLetterTemplateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_resumeTemplateId_fkey" FOREIGN KEY ("resumeTemplateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
