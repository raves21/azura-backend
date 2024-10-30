/*
  Warnings:

  - You are about to drop the column `coverPhoto` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "coverPhoto",
ADD COLUMN     "banner" TEXT;
