-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "average_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "review_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."FavoriteProduct" (
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteProduct_pkey" PRIMARY KEY ("user_id","product_id")
);

-- AddForeignKey
ALTER TABLE "public"."FavoriteProduct" ADD CONSTRAINT "FavoriteProduct_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FavoriteProduct" ADD CONSTRAINT "FavoriteProduct_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
