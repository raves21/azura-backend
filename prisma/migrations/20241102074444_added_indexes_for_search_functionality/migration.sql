-- CreateIndex
CREATE INDEX "Collection_name_idx" ON "Collection"("name");

-- CreateIndex
CREATE INDEX "Media_title_idx" ON "Media"("title");

-- CreateIndex
CREATE INDEX "Post_content_idx" ON "Post"("content");

-- CreateIndex
CREATE INDEX "User_username_handle_idx" ON "User"("username", "handle");
