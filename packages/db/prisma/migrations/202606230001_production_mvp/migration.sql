CREATE TABLE "BusinessMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessMember_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Invoice" ADD COLUMN "sourceQuoteId" TEXT;

CREATE UNIQUE INDEX "BusinessMember_userId_businessId_key" ON "BusinessMember"("userId", "businessId");
CREATE INDEX "BusinessMember_businessId_idx" ON "BusinessMember"("businessId");
CREATE INDEX "BusinessMember_userId_idx" ON "BusinessMember"("userId");
CREATE UNIQUE INDEX "Invoice_sourceQuoteId_key" ON "Invoice"("sourceQuoteId");
CREATE INDEX "Quote_businessId_status_idx" ON "Quote"("businessId", "status");
CREATE INDEX "Invoice_businessId_status_dueDate_idx" ON "Invoice"("businessId", "status", "dueDate");

ALTER TABLE "BusinessMember" ADD CONSTRAINT "BusinessMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessMember" ADD CONSTRAINT "BusinessMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_sourceQuoteId_fkey" FOREIGN KEY ("sourceQuoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
