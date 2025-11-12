-- CreateEnum
CREATE TYPE "Civility" AS ENUM ('MR', 'MRS', 'MS');

-- CreateEnum
CREATE TYPE "PriceRange" AS ENUM ('ENTRY_LEVEL', 'MID_RANGE', 'HIGH_END', 'LUXURY');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'VOID');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "avg_delivery_time" TEXT,
ADD COLUMN     "client_references" TEXT,
ADD COLUMN     "contactCivility" "Civility",
ADD COLUMN     "contact_first_name" TEXT,
ADD COLUMN     "contact_function" TEXT,
ADD COLUMN     "contact_last_name" TEXT,
ADD COLUMN     "deliveryZones" TEXT[],
ADD COLUMN     "detailed_description" TEXT,
ADD COLUMN     "min_order_quantity" INTEGER,
ADD COLUMN     "paymentConditions" TEXT[],
ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "priceRange" "PriceRange",
ADD COLUMN     "productCategories" TEXT[],
ADD COLUMN     "production_volume" TEXT,
ADD COLUMN     "sample_available" BOOLEAN,
ADD COLUMN     "social_links" JSONB;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discount_amount" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
ADD COLUMN     "estimated_delivery_date" TIMESTAMP(3),
ADD COLUMN     "shipping_carrier" TEXT,
ADD COLUMN     "shipping_date" TIMESTAMP(3),
ADD COLUMN     "shipping_fee" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
ADD COLUMN     "shipping_mode" TEXT,
ADD COLUMN     "shipping_tracking_number" TEXT,
ADD COLUMN     "sub_total" DECIMAL(65,30) NOT NULL DEFAULT 0.0;

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "notes" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "order_id" TEXT NOT NULL,
    "triggered_by_id" TEXT,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3) NOT NULL,
    "pdf_url" TEXT,
    "notes" TEXT,
    "subTotal" DECIMAL(65,30) NOT NULL,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "shippingFee" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "order_id" TEXT NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "amount_paid" DECIMAL(65,30) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL,
    "transaction_ref" TEXT,
    "invoice_id" TEXT NOT NULL,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoice_number_key" ON "Invoice"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_order_id_key" ON "Invoice"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "InvoicePayment_transaction_ref_key" ON "InvoicePayment"("transaction_ref");

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
