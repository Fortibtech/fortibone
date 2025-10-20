/*
  Warnings:

  - A unique constraint covering the columns `[siret]` on the table `Business` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CommerceType" AS ENUM ('PHYSICAL', 'DIGITAL', 'HYBRID');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "activity_sector" TEXT,
ADD COLUMN     "commerce_type" "CommerceType" NOT NULL DEFAULT 'PHYSICAL',
ADD COLUMN     "siret" TEXT,
ADD COLUMN     "website_url" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Business_siret_key" ON "Business"("siret");
