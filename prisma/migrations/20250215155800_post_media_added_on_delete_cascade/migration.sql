-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_mediaId_fkey";

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
