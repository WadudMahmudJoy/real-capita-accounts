# Phase 2M: Customer Booking & Receivable Control Acceptance Criteria

This document defines the acceptance criteria for the Phase 2M implementation.

## 1. Documentation Lock (Phase 2M-1)

- [ ] Requirement lock created (`docs/requirements/phase-2m-customer-booking-receivable-control-requirement-lock.md`).
- [ ] Implementation plan created (`docs/plans/phase-2m-customer-booking-receivable-control-plan.md`).
- [ ] Acceptance criteria created (this file).
- [ ] Client portal explicitly deferred in requirement lock.
- [ ] Accounting-first rules stated: posted vouchers are source of truth, DRAFT does not affect reports.
- [ ] AGM open decisions listed.
- [ ] Status files updated (`AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`).
- [ ] No database schema changes, migrations, backend code, frontend code, or demo data changes.

## 2. Data Model & Backend Foundation (Phase 2M-2)

- [ ] Prisma models created for `Customer`, `BookableItem`, `Booking`, `BookingInstallment`, and `BookingReceipt`.
- [ ] Database migration created and applied successfully.
- [ ] `CustomerModule` with CRUD endpoints (`GET/POST/GET :id/PATCH`) implemented and guarded.
- [ ] `BookableItemModule` with CRUD endpoints implemented and guarded.
- [ ] `BookingModule` with CRUD endpoints implemented and guarded.
- [ ] `BookingReceiptModule` with link/unlink endpoints implemented and guarded.
- [ ] Auto-generated codes (CUST-00001, BOOK-00001, ITEM-00001) work correctly.
- [ ] Status transition validation prevents invalid state changes.
- [ ] DTO validation (class-validator) catches invalid input.
- [ ] All endpoints return 401 for unauthenticated requests.
- [ ] `pnpm prisma:generate` completes without errors.
- [ ] `pnpm typecheck` finds no TypeScript errors.
- [ ] `pnpm lint` passes.
- [ ] `pnpm build:api` and `pnpm build:web` complete successfully.
- [ ] No frontend changes made.

## 3. Internal Customer/Booking UI (Phase 2M-3)

- [ ] Customer list page (`/app/customers`) renders with search, filter, pagination.
- [ ] Customer create page (`/app/customers/new`) with all fields, validation, and submit.
- [ ] Customer detail/edit page (`/app/customers/[id]`) with read-only view and edit mode.
- [ ] Bookable item list page (`/app/bookable-items`) grouped by project, filterable by category and status.
- [ ] Bookable item create page (`/app/bookable-items/new`) with project selector, category, fields.
- [ ] Bookable item detail/edit page (`/app/bookable-items/[id]`).
- [ ] Booking list page (`/app/bookings`) with search, filter by status/customer/project.
- [ ] Booking create page (`/app/bookings/new`) with customer selector, project selector, bookable item selector, price/schedule fields.
- [ ] Booking detail page (`/app/bookings/[id]`) showing booking info, payment schedule, collection history, status badge.
- [ ] Booking status badges are color-coded (DRAFT=gray, ACTIVE=blue, PARTIALLY_PAID=orange, FULLY_PAID=green, CANCELLED=red, REFUNDED=purple).
- [ ] Payment schedule table displays installments with due dates, amounts, paid status.
- [ ] Booking status transitions work with confirmation dialogs.
- [ ] Navigation links added under "Customers & Bookings" section in sidebar.
- [ ] `pnpm typecheck` finds no TypeScript errors.
- [ ] `pnpm lint` passes.
- [ ] `pnpm build:web` and `pnpm build:api` complete successfully.
- [ ] No collection linkage or report changes made.

## 4. Collection/Receipt Voucher Linkage (Phase 2M-4)

- [ ] "Record Collection" button on booking detail page opens collection form.
- [ ] Collection form creates a receipt voucher (DRAFT or POSTED) and links it to the booking.
- [ ] Receipt voucher narration includes booking reference: `[Booking {bookingNumber}] - {customerName}`.
- [ ] "Link Existing Voucher" button allows searching and linking an existing RECEIPT voucher.
- [ ] Cannot link a non-RECEIPT voucher to a booking.
- [ ] Cannot unlink a posted voucher from a booking.
- [ ] Collection history table on booking detail shows: date, voucher number (clickable), amount, status (DRAFT/POSTED).
- [ ] Running totals displayed: total collected, total due.
- [ ] Booking collected amount updates when linked voucher is posted.
- [ ] DRAFT receipts do not affect booking collected amount or reports.
- [ ] Booking payment status updates correctly: ON_TRACK, OVERDUE, FULLY_PAID (derived, not manual).
- [ ] Customer payment history is visible on customer detail page.
- [ ] `pnpm demo:audit` and `pnpm demo:verify` pass.
- [ ] No report changes made.

## 5. Customer Statement & Receivable Reports (Phase 2M-5)

### Backend Report APIs

- [ ] `GET /reports/customer-ledger` returns customer-wise date/debit/credit/balance, filterable by project and date range.
- [ ] `GET /reports/booking-receivable` returns all bookings with value, collected, due, status, next installment.
- [ ] `GET /reports/customer-due` returns customers with outstanding dues, overdue amounts.
- [ ] `GET /reports/project-collection` returns total collections per project, grouped by customer or booking.
- [ ] `GET /reports/project-receivable` returns total outstanding per project, grouped by customer or booking.
- [ ] `GET /reports/overdue-installments` returns bookings with overdue installments, days overdue, amount.
- [ ] All report endpoints are guarded (`AuthGuard + RolesGuard + ACCOUNTANT`).
- [ ] All reports derive from posted voucher lines + booking data (no DRAFT contamination).

### Frontend Report Pages

- [ ] `/app/reports/customer-ledger` -- customer selector, date range, transaction table, running balance, browser print.
- [ ] `/app/reports/booking-receivable` -- filterable table of bookings with receivable summary, browser print.
- [ ] `/app/reports/customer-due` -- filterable table of customers with due amounts, browser print.
- [ ] `/app/reports/project-collection` -- project selector, collection summary, browser print.
- [ ] `/app/reports/project-receivable` -- project selector, receivable summary, browser print.
- [ ] `/app/reports/overdue-installments` -- overdue bookings list, browser print.
- [ ] Navigation links added under Reports section in sidebar.
- [ ] Browser print works on all report pages (print layout includes Real Capita Group heading, report title, filters, data, totals, timestamp).

### Report Correctness

- [ ] Customer statement shows correct running balance.
- [ ] Booking receivable report shows correct total collected, total due.
- [ ] Customer due report shows correct outstanding amounts.
- [ ] Project collection report shows correct totals per project.
- [ ] Project receivable report shows correct outstanding per project.
- [ ] Overdue installment report shows correct overdue amounts and days.
- [ ] No double-counting between customer reports and existing accounting reports.
- [ ] DRAFT bookings and DRAFT receipts do not affect any report totals.

### Regression

- [ ] All 12 existing accounting reports continue to work correctly.
- [ ] Existing report totals are unchanged.
- [ ] `pnpm demo:audit` and `pnpm demo:verify` pass.

## 6. Regression, Docs, Review Walkthrough (Phase 2M-6)

- [ ] All 12 existing accounting reports verified working correctly.
- [ ] Phase 2L reversal workflow verified working correctly.
- [ ] `pnpm demo:audit` 62 PASS, 0 FAIL.
- [ ] `pnpm demo:verify` 47 PASS, 0 FAIL.
- [ ] `pnpm prisma:generate` completes without errors.
- [ ] `pnpm typecheck` finds no TypeScript errors.
- [ ] `pnpm lint` passes.
- [ ] `pnpm build:web` and `pnpm build:api` complete successfully.
- [ ] `pnpm check:all` passes.
- [ ] `pnpm doctor` passes (port warnings acceptable).
- [ ] Status files (`AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`) updated.
- [ ] `docs/review/agm-md-review-walkthrough.md` updated with Phase 2M customer booking walkthrough section.
- [ ] Working tree clean.
- [ ] Ready for user-created tag `phase-2m-complete` (agent does not tag).

## Non-Acceptance Conditions

Phase 2M is NOT accepted if:

- Any existing accounting report is broken or shows incorrect totals.
- Phase 2L reversal workflow is broken.
- DRAFT bookings or DRAFT receipts affect accounting reports.
- Collections can be recorded without a receipt voucher.
- Posted receipt vouchers can be unlinked from bookings.
- Customer balances are derived from anything other than posted voucher lines.
- A client portal or customer login page exists.
- Revenue recognition journal entries are automatically generated.
- The `pnpm demo:audit` or `pnpm demo:verify` baseline is broken.
- Schema changes break existing voucher, ledger, or report functionality.
