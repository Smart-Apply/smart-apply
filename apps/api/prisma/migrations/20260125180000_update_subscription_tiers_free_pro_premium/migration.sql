-- Update Subscription Tiers from PREMIUM/PREMIUM_PLUS to FREE/PRO/PREMIUM
-- This migration:
-- 1. Adds new usage tracking fields
-- 2. Updates the SubscriptionTier enum from (FREE, PREMIUM, PREMIUM_PLUS) to (FREE, PRO, PREMIUM)
-- 3. Maps existing PREMIUM users to PRO, PREMIUM_PLUS to PREMIUM

-- Step 1: Add new usage tracking fields to subscription_usage
ALTER TABLE "subscription_usage" 
ADD COLUMN IF NOT EXISTS "coverLettersGenerated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "resumesGenerated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "jobParsingUsed" INTEGER NOT NULL DEFAULT 0;

-- Step 2: Create new enum type with correct values
CREATE TYPE "SubscriptionTier_new" AS ENUM ('FREE', 'PRO', 'PREMIUM');

-- Step 3: Alter the column to use the new enum with mapping
-- Using CASE to handle the conversion:
-- OLD FREE -> NEW FREE
-- OLD PREMIUM -> NEW PRO
-- OLD PREMIUM_PLUS -> NEW PREMIUM
ALTER TABLE "subscriptions" 
ALTER COLUMN "tier" DROP DEFAULT;

ALTER TABLE "subscriptions" 
ALTER COLUMN "tier" TYPE "SubscriptionTier_new" 
USING (
  CASE tier::text
    WHEN 'FREE' THEN 'FREE'::"SubscriptionTier_new"
    WHEN 'PREMIUM' THEN 'PRO'::"SubscriptionTier_new"
    WHEN 'PREMIUM_PLUS' THEN 'PREMIUM'::"SubscriptionTier_new"
    ELSE 'FREE'::"SubscriptionTier_new"
  END
);

ALTER TABLE "subscriptions" 
ALTER COLUMN "tier" SET DEFAULT 'FREE'::"SubscriptionTier_new";

-- Step 4: Drop old enum and rename new one
DROP TYPE "SubscriptionTier";
ALTER TYPE "SubscriptionTier_new" RENAME TO "SubscriptionTier";
