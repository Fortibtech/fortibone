/*
  Warnings:

  - A unique constraint covering the columns `[transfer_peer_transaction_id]` on the table `WalletTransaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "WalletTransactionType" ADD VALUE 'TRANSFER';

-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "transfer_peer_transaction_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_transfer_peer_transaction_id_key" ON "WalletTransaction"("transfer_peer_transaction_id");

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_transfer_peer_transaction_id_fkey" FOREIGN KEY ("transfer_peer_transaction_id") REFERENCES "WalletTransaction"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
