-- CreateTable
CREATE TABLE "languages" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "languages_profileId_idx" ON "languages"("profileId");

-- AddForeignKey
ALTER TABLE "languages" ADD CONSTRAINT "languages_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
