-- CreateIndex
CREATE INDEX "CartItem_productVariantId_idx" ON "CartItem"("productVariantId");

-- CreateIndex
CREATE INDEX "Payment_rentalId_idx" ON "Payment"("rentalId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Penalty_rentalId_idx" ON "Penalty"("rentalId");

-- CreateIndex
CREATE INDEX "Promotion_startDate_idx" ON "Promotion"("startDate");

-- CreateIndex
CREATE INDEX "Promotion_endDate_idx" ON "Promotion"("endDate");

-- CreateIndex
CREATE INDEX "Rental_status_idx" ON "Rental"("status");

-- CreateIndex
CREATE INDEX "Rental_paymentStatus_idx" ON "Rental"("paymentStatus");

-- CreateIndex
CREATE INDEX "Rental_endDate_idx" ON "Rental"("endDate");

-- CreateIndex
CREATE INDEX "Rental_returnDate_idx" ON "Rental"("returnDate");

-- CreateIndex
CREATE INDEX "RentalItem_productVariantId_idx" ON "RentalItem"("productVariantId");
