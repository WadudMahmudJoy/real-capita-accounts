# Phase 2M: Customer Booking & Receivable Control Implementation Plan

This plan breaks down the Phase 2M requirements into executable chunks.

## Chunk 2M-1: Requirement Lock

- **Goal**: Lock requirements, business logic, data model boundaries, accounting rules, scope, and deferred items. Create all planning and acceptance documentation.
- **Actions**:
  - Create Phase 2M requirement lock (`docs/requirements/phase-2m-customer-booking-receivable-control-requirement-lock.md`).
  - Create Phase 2M acceptance criteria (`docs/acceptance/phase-2m-acceptance-criteria.md`).
  - Create Phase 2M implementation plan (this file).
  - Update status files (`AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`).
- **In-Scope**: Documentation only.
- **Out-of-Scope**: No schema changes, migrations, backend code, frontend code, demo data changes, or runtime logic.
- **Acceptance Checks**:
  - [ ] Requirement lock created and reviewed.
  - [ ] Plan created with all chunks defined.
  - [ ] Acceptance criteria created with checklist.
  - [ ] Client portal explicitly deferred.
  - [ ] Accounting-first rules stated.
  - [ ] AGM open decisions listed.
  - [ ] Status files updated.
- **Verification Commands**: `git diff --check`, `git status --short --branch`, `git diff --stat`.
- **Recommended Model**: DeepSeek V4 Pro Max (or Claude Opus 4.8 as backup).
- **Stop Condition**: All docs created and verified. No code changes. Working tree is clean aside from new docs.
- **Status**: **IN PROGRESS** (current chunk)

## Chunk 2M-2: Data Model & Backend Foundation

- **Goal**: Design and implement the Prisma schema models, database migration, and NestJS backend API endpoints for customer, bookable item, and booking management.
- **Actions**:
  - Design Prisma models:
    - `Customer` model with fields: code, name, phone, email, nid/passport, address, profession, nominee, notes, isActive.
    - `BookableItem` model with fields: code, projectId, category (enum: LAND, PLOT, FLAT, UNIT, SHARE, OTHER), block/zone/phase, itemIdentifier, size/area, basePrice, status (enum: AVAILABLE, BOOKED, SOLD, HOLD, CANCELLED).
    - `Booking` model with fields: bookingNumber, customerId, projectId, bookableItemId, bookingDate, totalAgreedPrice, discount, netBookingValue, bookingMoney, status (enum: DRAFT, ACTIVE, PARTIALLY_PAID, FULLY_PAID, CANCELLED, REFUNDED), remarks.
    - `BookingInstallment` model with fields: bookingId, dueDate, amount, isPaid, paidDate, paidAmount, receiptVoucherId (nullable FK to Voucher).
    - `BookingReceipt` model (junction/link table) with fields: bookingId, voucherId (FK to Voucher), amount, linkedAt.
  - Create and apply database migration.
  - Create NestJS modules:
    - `CustomerModule` with CRUD endpoints (`GET /customers`, `POST /customers`, `GET /customers/:id`, `PATCH /customers/:id`).
    - `BookableItemModule` with CRUD endpoints (`GET /bookable-items`, `POST /bookable-items`, `GET /bookable-items/:id`, `PATCH /bookable-items/:id`).
    - `BookingModule` with CRUD endpoints (`GET /bookings`, `POST /bookings`, `GET /bookings/:id`, `PATCH /bookings/:id`).
    - `BookingReceiptModule` with link/unlink endpoints (`POST /bookings/:id/receipts`, `GET /bookings/:id/receipts`).
  - Implement auto-generated codes (CUST-00001, BOOK-00001, ITEM-00001).
  - Implement status transition validation.
  - Add DTO validation (class-validator).
  - Guard all endpoints with `AuthGuard + RolesGuard + ACCOUNTANT`.
- **In-Scope**: Prisma schema, migration, backend modules, DTOs, validation, guards.
- **Out-of-Scope**: Frontend pages, client portal, voucher posting changes, report changes, demo data changes.
- **Acceptance Checks**:
  - [ ] Prisma models defined and migration applied.
  - [ ] All CRUD endpoints return correct responses.
  - [ ] Auto-generated codes work correctly.
  - [ ] Status transitions are validated.
  - [ ] All endpoints are guarded (401 for unauthenticated).
  - [ ] `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:api` pass.
- **Verification Commands**: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:api`, `pnpm build:web`, `pnpm check:all`.
- **Recommended Model**: DeepSeek V4 Pro Max (or Claude Opus 4.8 as backup).
- **Stop Condition**: All backend endpoints implemented and verified. No frontend changes.
- **Status**: **NOT STARTED**

## Chunk 2M-3: Internal Customer/Booking UI

- **Goal**: Build the frontend pages for managing customers, bookable items, and bookings.
- **Actions**:
  - Create customer pages:
    - `/app/customers` -- list page with search, filter by status, pagination.
    - `/app/customers/new` -- create form with all fields.
    - `/app/customers/[id]` -- detail/edit page.
  - Create bookable item pages:
    - `/app/bookable-items` -- list page grouped by project, filter by category and status.
    - `/app/bookable-items/new` -- create form with project selector, category, fields.
    - `/app/bookable-items/[id]` -- detail/edit page.
  - Create booking pages:
    - `/app/bookings` -- list page with search, filter by status, customer, project.
    - `/app/bookings/new` -- create form: select customer, project, bookable item, enter price/schedule.
    - `/app/bookings/[id]` -- detail page showing booking info, payment schedule, collection history, status badge.
  - Add navigation links in app sidebar under new "Customers & Bookings" section.
  - Implement booking status badges (color-coded).
  - Implement payment schedule display (table of installments with due dates, amounts, paid status).
  - Implement booking status transitions (DRAFT → ACTIVE, ACTIVE → CANCELLED, etc.) with confirmation dialogs.
- **In-Scope**: Frontend pages for customer, bookable item, and booking CRUD.
- **Out-of-Scope**: Collection/receipt voucher linkage UI, customer statement, reports, client portal.
- **Acceptance Checks**:
  - [ ] Customer list/create/edit/detail pages work correctly.
  - [ ] Bookable item list/create/edit/detail pages work correctly.
  - [ ] Booking list/create/detail pages work correctly.
  - [ ] Booking status transitions work with validation.
  - [ ] Payment schedule is displayed correctly.
  - [ ] Navigation links are present in sidebar.
  - [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build:web` pass.
- **Verification Commands**: `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `pnpm check:all`.
- **Recommended Model**: DeepSeek V4 Pro Max (or Claude Opus 4.8 as backup).
- **Stop Condition**: All frontend pages implemented and verified. No report or collection linkage changes.
- **Status**: **NOT STARTED**

## Chunk 2M-4: Collection/Receipt Voucher Linkage

- **Goal**: Implement the ability to create receipt vouchers from booking collections or link existing receipt vouchers to bookings. Ensure accounting source of truth is preserved.
- **Actions**:
  - Backend:
    - Create `POST /bookings/:id/collections` endpoint to record a collection and optionally create a linked receipt voucher.
    - Create `POST /bookings/:id/link-voucher` endpoint to link an existing receipt voucher to a booking.
    - Create `DELETE /bookings/:id/receipts/:receiptId` endpoint to unlink (only if voucher is DRAFT).
    - Update `GET /bookings/:id` to include collection history with voucher status.
    - Implement validation: cannot unlink posted voucher; cannot link non-RECEIPT vouchers; cannot link the same voucher to multiple bookings (if 1:1 is chosen).
  - Frontend:
    - Add "Record Collection" button on booking detail page.
    - Collection form: enter amount, date, payment mode (cash/bank/MFS), optional narration → creates receipt voucher + links to booking.
    - Add "Link Existing Voucher" button to search and link an existing RECEIPT voucher.
    - Show collection history table on booking detail: date, voucher number (clickable), amount, status (DRAFT/POSTED).
    - Show running total: total collected, total due.
  - Voucher integration:
    - When creating a receipt voucher from a collection, the voucher narration should reference the booking: `[Booking {bookingNumber}] - {customerName}`.
    - The receipt voucher is a standard RECEIPT voucher; no special voucher type is created.
    - Posted voucher status changes update the booking's collected amount and payment status.
- **In-Scope**: Collection creation, voucher linkage, collection history display, running totals.
- **Out-of-Scope**: Customer statement, reports, automated installment tracking, refund workflow.
- **Acceptance Checks**:
  - [ ] Can create receipt voucher from booking collection.
  - [ ] Can link existing receipt voucher to booking.
  - [ ] Cannot unlink posted voucher from booking.
  - [ ] Collection history shows all linked vouchers with status.
  - [ ] Booking collected amount updates when voucher is posted.
  - [ ] DRAFT receipts do not affect booking collected amount.
  - [ ] Customer payment history is visible.
  - [ ] `pnpm demo:audit` and `pnpm demo:verify` pass.
- **Verification Commands**: `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `pnpm check:all`, `pnpm demo:audit`, `pnpm demo:verify`.
- **Recommended Model**: DeepSeek V4 Pro Max (or Claude Opus 4.8 as backup).
- **Stop Condition**: Collection linkage fully implemented and verified. No report changes.
- **Status**: **NOT STARTED**

## Chunk 2M-5: Customer Statement & Receivable Reports

- **Goal**: Implement customer statement, booking-wise due, project-wise collection, project-wise receivable, and overdue/installment due reports.
- **Actions**:
  - Backend report endpoints:
    - `GET /reports/customer-ledger` -- customer-wise date/debit/credit/balance, filterable by project, date range.
    - `GET /reports/booking-receivable` -- all bookings with value, collected, due, status, next installment.
    - `GET /reports/customer-due` -- customers with outstanding dues, overdue amounts.
    - `GET /reports/project-collection` -- total collections per project, grouped by customer or booking.
    - `GET /reports/project-receivable` -- total outstanding per project, grouped by customer or booking.
    - `GET /reports/overdue-installments` -- bookings with overdue installments, days overdue, amount.
  - Frontend report pages:
    - `/app/reports/customer-ledger` -- customer selector, date range, transaction table, running balance, print.
    - `/app/reports/booking-receivable` -- filterable table of bookings with receivable summary, print.
    - `/app/reports/customer-due` -- filterable table of customers with due amounts, print.
    - `/app/reports/project-collection` -- project selector, collection summary, print.
    - `/app/reports/project-receivable` -- project selector, receivable summary, print.
    - `/app/reports/overdue-installments` -- overdue bookings list, print.
  - All reports derive from posted voucher lines + booking data.
  - Add navigation links under Reports section.
  - Browser print foundation for all report pages.
- **In-Scope**: Six report APIs, six frontend report pages, print foundation.
- **Out-of-Scope**: PDF/Excel export, dashboard analytics, aging analysis, cancelled/refunded booking report.
- **Acceptance Checks**:
  - [ ] All six report endpoints return correct data.
  - [ ] All six frontend report pages render and filter correctly.
  - [ ] Reports derive from posted voucher lines only.
  - [ ] DRAFT collections do not affect report totals.
  - [ ] Customer statement shows correct running balance.
  - [ ] Browser print works on all report pages.
  - [ ] Existing 12 reports continue to work correctly.
  - [ ] `pnpm demo:audit` and `pnpm demo:verify` pass.
- **Verification Commands**: `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `pnpm check:all`, `pnpm demo:audit`, `pnpm demo:verify`.
- **Recommended Model**: DeepSeek V4 Pro Max (or Claude Opus 4.8 as backup).
- **Stop Condition**: All reports implemented and verified. Ready for final review.
- **Status**: **NOT STARTED**

## Chunk 2M-6: Regression, Docs, Review Walkthrough

- **Goal**: Final integration verification, regression testing, documentation cleanup, and AGM review script update.
- **Actions**:
  - Verify all existing 12 accounting reports still work correctly.
  - Verify Phase 2L reversal workflow still works correctly.
  - Verify `pnpm demo:audit` (62 PASS) and `pnpm demo:verify` (47 PASS) still pass.
  - Verify no double-counting between customer reports and existing reports.
  - Verify accounting invariants: posted vouchers are source of truth, DRAFT does not affect reports.
  - Clean up status files (`AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`).
  - Update `docs/review/agm-md-review-walkthrough.md` with Phase 2M customer booking walkthrough section.
  - Confirm readiness for user-created tag `phase-2m-complete`.
- **In-Scope**: Verification, docs cleanup, AGM review script update.
- **Out-of-Scope**: No new features, no schema changes, no code changes beyond docs.
- **Acceptance Checks**:
  - [ ] All 12 existing reports verified working.
  - [ ] Phase 2L reversal workflow verified working.
  - [ ] `pnpm demo:audit` 62 PASS, 0 FAIL.
  - [ ] `pnpm demo:verify` 47 PASS, 0 FAIL.
  - [ ] `pnpm check:all` passes.
  - [ ] Status files updated.
  - [ ] AGM review walkthrough updated.
  - [ ] Working tree clean.
- **Verification Commands**: `pnpm check:all`, `pnpm demo:audit`, `pnpm demo:verify`, `git diff --check`, `git status --short --branch`.
- **Recommended Model**: DeepSeek V4 Pro Max (or Claude Opus 4.8 as backup).
- **Stop Condition**: All verification passes. Docs updated. Ready for user tag.
- **Status**: **NOT STARTED**
