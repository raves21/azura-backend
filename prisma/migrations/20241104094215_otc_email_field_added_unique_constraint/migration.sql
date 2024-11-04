/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `OTC` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "OTC_email_key" ON "OTC"("email");
