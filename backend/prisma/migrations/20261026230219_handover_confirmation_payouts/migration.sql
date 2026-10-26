-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "disputeReason" TEXT,
ADD COLUMN     "disputedAt" TIMESTAMP(3),
ADD COLUMN     "handoverAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "handoverSalt" TEXT,
ADD COLUMN     "resolutionNote" TEXT;

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "grossCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "netCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "paidById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payout_deliveryId_key" ON "Payout"("deliveryId");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
