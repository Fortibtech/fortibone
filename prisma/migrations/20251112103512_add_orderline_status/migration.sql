/*
  Warnings:

  - Added the required column `status` to the `OrderLine` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OrderLine" ADD COLUMN     "status" "OrderStatus" NOT NULL;
