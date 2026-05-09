-- AlterTable
ALTER TABLE "auto_apply_configs" ADD COLUMN     "clTemplateId" TEXT,
ADD COLUMN     "cvTemplateId" TEXT,
ADD COLUMN     "generateCoverLetter" BOOLEAN NOT NULL DEFAULT true;
