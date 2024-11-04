/*
  Warnings:

  - The primary key for the `OTC` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `userId` on the `OTC` table. All the data in the column will be lost.
  - Added the required column `email` to the `OTC` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `OTC` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "OTC" DROP CONSTRAINT "OTC_userId_fkey";

-- AlterTable
ALTER TABLE "OTC" DROP CONSTRAINT "OTC_pkey",
DROP COLUMN "userId",
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "OTC_pkey" PRIMARY KEY ("id");
