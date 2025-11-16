-- AlterTable: Add new firstName and lastName columns if they don't exist
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastName" TEXT;

-- Data Migration: Split fullName into firstName and lastName
UPDATE "users" 
SET 
  "firstName" = CASE 
    WHEN "fullName" IS NOT NULL AND position(' ' in "fullName") > 0 
    THEN split_part("fullName", ' ', 1)
    ELSE "fullName"
  END,
  "lastName" = CASE 
    WHEN "fullName" IS NOT NULL AND position(' ' in "fullName") > 0 
    THEN substring("fullName" from position(' ' in "fullName") + 1)
    ELSE NULL
  END
WHERE "fullName" IS NOT NULL AND "firstName" IS NULL;

-- Drop old fullName column if it exists
ALTER TABLE "users" DROP COLUMN IF EXISTS "fullName";