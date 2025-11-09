/*
  Warnings:

  - You are about to drop the column `description` on the `education` table. All the data in the column will be lost.
  - You are about to drop the column `fieldOfStudy` on the `education` table. All the data in the column will be lost.
  - You are about to drop the column `gpa` on the `education` table. All the data in the column will be lost.
  - The `startYear` column on the `education` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `endYear` column on the `education` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "education" DROP COLUMN "description",
DROP COLUMN "fieldOfStudy",
DROP COLUMN "gpa",
DROP COLUMN "startYear",
ADD COLUMN     "startYear" TIMESTAMP(3),
DROP COLUMN "endYear",
ADD COLUMN     "endYear" TIMESTAMP(3);
