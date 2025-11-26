/*
  Warnings:

  - You are about to drop the `user_preferences` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_preferences" DROP CONSTRAINT "user_preferences_userId_fkey";

-- DropTable
DROP TABLE "user_preferences";
