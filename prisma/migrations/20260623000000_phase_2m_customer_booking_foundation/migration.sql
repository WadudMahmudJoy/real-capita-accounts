-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'COMPANY', 'OTHER');

-- CreateEnum
CREATE TYPE "BookableItemCategory" AS ENUM ('LAND', 'PLOT', 'FLAT', 'UNIT', 'SHARE', 'OTHER');

-- CreateEnum
CREATE TYPE "BookableItemStatus" AS ENUM ('AVAILABLE', 'HOLD', 'BOOKED', 'SOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingAdministrativeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'HOLD', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "customerCode" TEXT NOT NULL,
    "customerType" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "nidOrPassport" TEXT,
    "address" TEXT NOT NULL,
    "professionOrBusiness" TEXT,
    "nomineeOrReference" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookable_items" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" "BookableItemCategory" NOT NULL,
    "itemIdentifier" TEXT NOT NULL,
    "block" TEXT,
    "zone" TEXT,
    "phase" TEXT,
    "sizeOrArea" TEXT,
    "shareQuantity" DECIMAL(18,2),
    "basePrice" DECIMAL(18,2) NOT NULL,
    "status" "BookableItemStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookable_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "bookableItemId" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "totalAgreedPrice" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netBookingValue" DECIMAL(18,2) NOT NULL,
    "bookingMoney" DECIMAL(18,2),
    "administrativeStatus" "BookingAdministrativeStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_installments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_receipt_allocations" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "allocationDate" TIMESTAMP(3) NOT NULL,
    "allocationReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_receipt_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_customerCode_key" ON "customers"("customerCode");

-- CreateIndex
CREATE UNIQUE INDEX "customers_nidOrPassport_key" ON "customers"("nidOrPassport");

-- CreateIndex
CREATE INDEX "customers_customerType_idx" ON "customers"("customerType");

-- CreateIndex
CREATE INDEX "customers_isActive_idx" ON "customers"("isActive");

-- CreateIndex
CREATE INDEX "customers_isDeleted_idx" ON "customers"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "bookable_items_itemCode_key" ON "bookable_items"("itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "bookable_items_projectId_category_itemIdentifier_key" ON "bookable_items"("projectId", "category", "itemIdentifier");

-- CreateIndex
CREATE INDEX "bookable_items_projectId_idx" ON "bookable_items"("projectId");

-- CreateIndex
CREATE INDEX "bookable_items_category_idx" ON "bookable_items"("category");

-- CreateIndex
CREATE INDEX "bookable_items_status_idx" ON "bookable_items"("status");

-- CreateIndex
CREATE INDEX "bookable_items_isDeleted_idx" ON "bookable_items"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_bookingNumber_key" ON "bookings"("bookingNumber");

-- CreateIndex
CREATE INDEX "bookings_customerId_idx" ON "bookings"("customerId");

-- CreateIndex
CREATE INDEX "bookings_projectId_idx" ON "bookings"("projectId");

-- CreateIndex
CREATE INDEX "bookings_bookableItemId_idx" ON "bookings"("bookableItemId");

-- CreateIndex
CREATE INDEX "bookings_administrativeStatus_idx" ON "bookings"("administrativeStatus");

-- CreateIndex
CREATE INDEX "bookings_bookingDate_idx" ON "bookings"("bookingDate");

-- CreateIndex
CREATE INDEX "bookings_isDeleted_idx" ON "bookings"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "booking_installments_bookingId_installmentNo_key" ON "booking_installments"("bookingId", "installmentNo");

-- CreateIndex
CREATE INDEX "booking_installments_bookingId_idx" ON "booking_installments"("bookingId");

-- CreateIndex
CREATE INDEX "booking_installments_dueDate_idx" ON "booking_installments"("dueDate");

-- CreateIndex
CREATE INDEX "booking_receipt_allocations_bookingId_idx" ON "booking_receipt_allocations"("bookingId");

-- CreateIndex
CREATE INDEX "booking_receipt_allocations_voucherId_idx" ON "booking_receipt_allocations"("voucherId");

-- CreateIndex
CREATE INDEX "booking_receipt_allocations_allocationDate_idx" ON "booking_receipt_allocations"("allocationDate");

-- AddForeignKey
ALTER TABLE "bookable_items" ADD CONSTRAINT "bookable_items_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bookableItemId_fkey" FOREIGN KEY ("bookableItemId") REFERENCES "bookable_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_installments" ADD CONSTRAINT "booking_installments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_receipt_allocations" ADD CONSTRAINT "booking_receipt_allocations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_receipt_allocations" ADD CONSTRAINT "booking_receipt_allocations_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
