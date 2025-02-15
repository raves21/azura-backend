/*
  Warnings:

  - A unique constraint covering the columns `[collectionId,mediaId,mediaType]` on the table `CollectionItem` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `mediaType` to the `CollectionItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CollectionItem" DROP CONSTRAINT "CollectionItem_mediaId_fkey";

-- DropIndex
DROP INDEX "CollectionItem_collectionId_mediaId_key";

-- AlterTable
ALTER TABLE "CollectionItem" ADD COLUMN     "mediaType" "MediaType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_collectionId_mediaId_mediaType_key" ON "CollectionItem"("collectionId", "mediaId", "mediaType");

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
