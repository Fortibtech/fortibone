/*
  Warnings:

  - A unique constraint covering the columns `[payment_intent_id]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[transaction_id]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."PaymentMethodEnum" AS ENUM ('STRIPE', 'MVOLA', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."OrderStatus" ADD VALUE 'PENDING_PAYMENT';
ALTER TYPE "public"."OrderStatus" ADD VALUE 'PAID';
ALTER TYPE "public"."OrderStatus" ADD VALUE 'PAYMENT_FAILED';
ALTER TYPE "public"."OrderStatus" ADD VALUE 'REJECTED';
ALTER TYPE "public"."OrderStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "public"."OrderStatus" ADD VALUE 'PENDING_REFUND';
ALTER TYPE "public"."OrderStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "payment_intent_id" TEXT,
ADD COLUMN     "payment_method" "public"."PaymentMethodEnum",
ADD COLUMN     "transaction_id" TEXT;

-- CreateTable
CREATE TABLE "public"."PaymentTransaction" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency_code" TEXT NOT NULL,
    "provider" "public"."PaymentMethodEnum" NOT NULL,
    "provider_transaction_id" TEXT,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "order_id" TEXT NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_provider_transaction_id_key" ON "public"."PaymentTransaction"("provider_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "Order_payment_intent_id_key" ON "public"."Order"("payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "Order_transaction_id_key" ON "public"."Order"("transaction_id");

-- AddForeignKey
ALTER TABLE "public"."PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
