/*
  Warnings:

  - A unique constraint covering the columns `[title,year,type,description]` on the table `Media` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Media_title_year_type_key";

-- CreateIndex
CREATE UNIQUE INDEX "Media_title_year_type_description_key" ON "Media"("title", "year", "type", "description");
