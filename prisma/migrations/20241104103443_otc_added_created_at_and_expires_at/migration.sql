/*
  Warnings:

  - Added the required column `expiresAt` to the `OTC` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OTC" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL;
