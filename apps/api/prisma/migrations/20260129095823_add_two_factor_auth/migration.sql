-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'TWO_FACTOR_ENABLED';
ALTER TYPE "AuditEventType" ADD VALUE 'TWO_FACTOR_DISABLED';
ALTER TYPE "AuditEventType" ADD VALUE 'TWO_FACTOR_CHALLENGE_SUCCESS';
ALTER TYPE "AuditEventType" ADD VALUE 'TWO_FACTOR_CHALLENGE_FAILED';
ALTER TYPE "AuditEventType" ADD VALUE 'TWO_FACTOR_BACKUP_CODE_USED';
ALTER TYPE "AuditEventType" ADD VALUE 'TWO_FACTOR_DEVICE_TRUSTED';
ALTER TYPE "AuditEventType" ADD VALUE 'TWO_FACTOR_DEVICE_REVOKED';

-- CreateTable
CREATE TABLE "two_factor_auth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "encryptedSecret" TEXT,
    "secretIv" TEXT,
    "secretAuthTag" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "two_factor_auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_backup_codes" (
    "id" TEXT NOT NULL,
    "twoFactorAuthId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceTokenHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_auth_userId_key" ON "two_factor_auth"("userId");

-- CreateIndex
CREATE INDEX "two_factor_backup_codes_twoFactorAuthId_idx" ON "two_factor_backup_codes"("twoFactorAuthId");

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_deviceTokenHash_key" ON "trusted_devices"("deviceTokenHash");

-- CreateIndex
CREATE INDEX "trusted_devices_userId_idx" ON "trusted_devices"("userId");

-- CreateIndex
CREATE INDEX "trusted_devices_expiresAt_idx" ON "trusted_devices"("expiresAt");

-- AddForeignKey
ALTER TABLE "two_factor_auth" ADD CONSTRAINT "two_factor_auth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_backup_codes" ADD CONSTRAINT "two_factor_backup_codes_twoFactorAuthId_fkey" FOREIGN KEY ("twoFactorAuthId") REFERENCES "two_factor_auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
