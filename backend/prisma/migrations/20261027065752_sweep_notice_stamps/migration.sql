-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "autoConfirmNoticeAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);
