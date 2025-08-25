-- AlterEnum
ALTER TYPE "public"."MovementType" ADD VALUE 'EXPIRATION';

-- CreateTable
CREATE TABLE "public"."ProductBatch" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiration_date" TIMESTAMP(3),
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "variant_id" TEXT NOT NULL,

    CONSTRAINT "ProductBatch_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."ProductBatch" ADD CONSTRAINT "ProductBatch_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
