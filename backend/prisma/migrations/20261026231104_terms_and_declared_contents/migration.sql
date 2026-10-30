-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "contentsConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "declaredValueCents" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;
