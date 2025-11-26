-- AlterTable (CREATED enum value already added in previous migration)
ALTER TABLE "applications" ALTER COLUMN "applicationStatus" SET DEFAULT 'CREATED';

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationUpdates" BOOLEAN NOT NULL DEFAULT true,
    "newJobPostings" BOOLEAN NOT NULL DEFAULT false,
    "marketingEmails" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'de',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "profilePublic" BOOLEAN NOT NULL DEFAULT false,
    "analyticsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
