-- CreateEnum
CREATE TYPE "public"."DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- AlterTable
ALTER TABLE "public"."Business" ADD COLUMN     "average_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "currency_id" TEXT,
ADD COLUMN     "review_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."Currency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange_rate" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OpeningHour" (
    "id" TEXT NOT NULL,
    "day_of_week" "public"."DayOfWeek" NOT NULL,
    "open_time" TEXT NOT NULL,
    "close_time" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,

    CONSTRAINT "OpeningHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BusinessReview" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "business_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,

    CONSTRAINT "BusinessReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "public"."Currency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningHour_business_id_day_of_week_open_time_close_time_key" ON "public"."OpeningHour"("business_id", "day_of_week", "open_time", "close_time");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessReview_business_id_author_id_key" ON "public"."BusinessReview"("business_id", "author_id");

-- AddForeignKey
ALTER TABLE "public"."Business" ADD CONSTRAINT "Business_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OpeningHour" ADD CONSTRAINT "OpeningHour_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusinessReview" ADD CONSTRAINT "BusinessReview_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusinessReview" ADD CONSTRAINT "BusinessReview_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
