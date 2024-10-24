/*
  Warnings:

  - Added the required column `privacy` to the `CollectionItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Privacy" AS ENUM ('FRIENDS_ONLY', 'PUBLIC', 'ONLY_ME');

-- AlterTable
ALTER TABLE "CollectionItem" ADD COLUMN     "privacy" "Privacy" NOT NULL;
