/*
  Warnings:

  - You are about to drop the column `receiptUrl` on the `Reimbursement` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'ADMINISTRATOR');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'QUERY_RAISED', 'CANCELLED', 'RESUBMITTED', 'PAYMENT_MARKED', 'BILL_ATTACHED', 'BILL_DETACHED', 'REMARK_ADDED', 'OTHER');

-- AlterEnum
ALTER TYPE "ReimbursementStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Reimbursement" DROP COLUMN "receiptUrl",
ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "vendorName" TEXT,
    "invoiceNumber" TEXT,
    "transactionId" TEXT,
    "billDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "receiptUrl" TEXT NOT NULL,
    "uniqueIdentifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReimbursementBill" (
    "id" TEXT NOT NULL,
    "reimbursementId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "allocatedAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReimbursementBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "reimbursementId" TEXT NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "activity" TEXT,
    "actorType" "ActorType" NOT NULL,
    "userId" TEXT,
    "administratorId" TEXT,
    "actorRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bill_uniqueIdentifier_key" ON "Bill"("uniqueIdentifier");

-- CreateIndex
CREATE INDEX "Bill_invoiceNumber_idx" ON "Bill"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Bill_transactionId_idx" ON "Bill"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReimbursementBill_reimbursementId_billId_key" ON "ReimbursementBill"("reimbursementId", "billId");

-- CreateIndex
CREATE INDEX "ActivityLog_reimbursementId_idx" ON "ActivityLog"("reimbursementId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_administratorId_idx" ON "ActivityLog"("administratorId");

-- AddForeignKey
ALTER TABLE "ReimbursementBill" ADD CONSTRAINT "ReimbursementBill_reimbursementId_fkey" FOREIGN KEY ("reimbursementId") REFERENCES "Reimbursement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementBill" ADD CONSTRAINT "ReimbursementBill_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_reimbursementId_fkey" FOREIGN KEY ("reimbursementId") REFERENCES "Reimbursement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_administratorId_fkey" FOREIGN KEY ("administratorId") REFERENCES "Administrator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
