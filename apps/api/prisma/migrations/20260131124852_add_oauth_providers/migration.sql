-- CreateEnum
CREATE TYPE "OAuthProviderType" AS ENUM ('GOOGLE', 'MICROSOFT', 'LINKEDIN', 'APPLE', 'FACEBOOK');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarUrl" TEXT;

-- CreateTable
CREATE TABLE "oauth_providers" (
    "id" TEXT NOT NULL,
    "provider" "OAuthProviderType" NOT NULL,
    "providerId" TEXT NOT NULL,
    "email" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oauth_providers_userId_idx" ON "oauth_providers"("userId");

-- CreateIndex
CREATE INDEX "oauth_providers_provider_idx" ON "oauth_providers"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_providers_provider_providerId_key" ON "oauth_providers"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_providers_provider_userId_key" ON "oauth_providers"("provider", "userId");

-- AddForeignKey
ALTER TABLE "oauth_providers" ADD CONSTRAINT "oauth_providers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
