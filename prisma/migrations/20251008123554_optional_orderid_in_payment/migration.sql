/*
  Warnings:

  - You are about to alter the column `location` on the `Business` table. The data in that column could be lost. The data in that column will be cast from `geometry` to `Unsupported("geometry(Point, 4326)")`.

*/
-- AlterTable
ALTER TABLE "Business" ALTER COLUMN "location" SET DATA TYPE geometry(Point, 4326);

-- AlterTable
ALTER TABLE "PaymentTransaction" ALTER COLUMN "order_id" DROP NOT NULL;
