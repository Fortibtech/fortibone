/*
  Warnings:

  - A unique constraint covering the columns `[stripe_account_id]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "stripe_account_id" TEXT,
ADD COLUMN     "stripe_account_setup_complete" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "metadata" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "User_stripe_account_id_key" ON "User"("stripe_account_id");
