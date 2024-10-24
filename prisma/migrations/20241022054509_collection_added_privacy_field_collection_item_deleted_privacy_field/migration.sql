/*
  Warnings:

  - You are about to drop the column `privacy` on the `CollectionItem` table. All the data in the column will be lost.
  - Added the required column `privacy` to the `Collection` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "privacy" "Privacy" NOT NULL;

-- AlterTable
ALTER TABLE "CollectionItem" DROP COLUMN "privacy";
