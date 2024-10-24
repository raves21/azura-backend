/*
  Warnings:

  - A unique constraint covering the columns `[collectionId,mediaId]` on the table `CollectionItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_collectionId_mediaId_key" ON "CollectionItem"("collectionId", "mediaId");
