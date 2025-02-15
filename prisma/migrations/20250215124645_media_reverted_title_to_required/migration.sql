/*
  Warnings:

  - Made the column `title` on table `media` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "media" ALTER COLUMN "title" SET NOT NULL;
