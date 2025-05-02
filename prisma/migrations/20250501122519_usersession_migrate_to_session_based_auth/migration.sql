/*
  Warnings:

  - The primary key for the `UserSession` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `deviceName` on the `UserSession` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `UserSession` table. All the data in the column will be lost.
  - You are about to drop the column `refreshTokenExpiresAt` on the `UserSession` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `UserSession` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[token]` on the table `UserSession` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `browser` to the `UserSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expiresAt` to the `UserSession` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `UserSession` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `os` to the `UserSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platform` to the `UserSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `token` to the `UserSession` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "UserSession_refreshToken_key";

-- AlterTable
ALTER TABLE "UserSession" DROP CONSTRAINT "UserSession_pkey",
DROP COLUMN "deviceName",
DROP COLUMN "refreshToken",
DROP COLUMN "refreshTokenExpiresAt",
DROP COLUMN "sessionId",
ADD COLUMN     "browser" TEXT NOT NULL,
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "id" UUID NOT NULL,
ADD COLUMN     "os" TEXT NOT NULL,
ADD COLUMN     "platform" TEXT NOT NULL,
ADD COLUMN     "token" TEXT NOT NULL,
ADD CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_key" ON "UserSession"("token");
