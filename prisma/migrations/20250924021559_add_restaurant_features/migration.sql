/*
  Warnings:

  - You are about to drop the column `table_number` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "table_number",
ADD COLUMN     "table_id" TEXT;

-- CreateTable
CREATE TABLE "public"."RestaurantTable" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "business_id" TEXT NOT NULL,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Menu" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(65,30) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "business_id" TEXT NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MenuItem" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "menu_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTable_business_id_name_key" ON "public"."RestaurantTable"("business_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Menu_business_id_name_key" ON "public"."Menu"("business_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_menu_id_variant_id_key" ON "public"."MenuItem"("menu_id", "variant_id");

-- AddForeignKey
ALTER TABLE "public"."RestaurantTable" ADD CONSTRAINT "RestaurantTable_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Menu" ADD CONSTRAINT "Menu_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MenuItem" ADD CONSTRAINT "MenuItem_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MenuItem" ADD CONSTRAINT "MenuItem_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."RestaurantTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
