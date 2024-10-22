/*
  Warnings:

  - The primary key for the `Follow` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Follow` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[followerId,followedId]` on the table `Follow` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Follow_followedId_followerId_key";

-- AlterTable
ALTER TABLE "Follow" DROP CONSTRAINT "Follow_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId", "followedId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followedId_key" ON "Follow"("followerId", "followedId");
