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

## 1B. Requirement Clarification Patch (Phase 2M-1B)

- [ ] Receipt-to-booking cardinality is locked as a separate allocation/link table model.
- [ ] One receipt voucher may be allocated to one or more bookings, and one booking may receive collections from many receipt vouchers.
- [ ] Every allocation stores booking ID, voucher ID, amount, allocation date, and allocation/reference note.
- [ ] Generated collection receipt vouchers are always `DRAFT` first; no auto-posting exists.
- [ ] Allocations linked to `DRAFT` vouchers are visible as pending but do not affect collected, due, overdue, or financial status totals.
- [ ] Installment paid/due state is derived from posted receipt allocations; manual paid flags are not authoritative.
- [ ] Stored booking status is administrative only (`DRAFT`, `ACTIVE`, `CANCELLED`, `REFUNDED`, optional `HOLD`); financial status is derived (`UNPAID`, `PARTIALLY_PAID`, `FULLY_PAID`, `OVERDUE`).
- [ ] Report inclusion rules are locked for `DRAFT`, `ACTIVE`, `CANCELLED`, `REFUNDED`, `DRAFT` receipt vouchers, and `POSTED` receipt vouchers.
- [ ] Customer uniqueness is locked: customer code unique, phone required but not globally unique, NID/passport optional and unique where practical.
- [ ] Bookable item uniqueness is locked: within a project, category + item identifier is unique, and no duplicate active/booked/sold real item reference exists.
- [ ] `SHARE` remains a generic bookable item category with no legal/investment/shareholder behavior in Phase 2M.
- [ ] Customer/project collection reports are explicitly separate from Project Fund Movement Option A.
- [ ] Aging scope is clarified: simple overdue amount, overdue installment count, and next installment date are included; 30/60/90 buckets, advanced analytics, and automated reminders are deferred.
- [ ] Reversal behavior is locked: original posted receipt increases collected, posted reversal decreases/nets collected, draft reversal has no report effect, and customer history shows both references.
- [ ] Control account/GL boundary is locked: Phase 2M reports are customer receivable/control subledger views, not revenue recognition, legal ownership transfer, or approved GL receivable recognition.
- [ ] Phase 2M-2 remains not started and may start only after this clarification patch is reviewed and committed.
- [ ] No source code, Prisma schema, migrations, tests, database changes, commits, tags, or pushes are made by the clarification patch.

## 2. Data Model & Backend Foundation (Phase 2M-2)

- [ ] Prisma models created for `Customer`, `BookableItem`, `Booking`, `BookingInstallment`, and `BookingReceiptAllocation` (or equivalent allocation/link table name).
- [ ] Database migration created and applied successfully.
- [ ] `Customer.customerCode` is unique; phone is required but not globally unique; optional NID/passport uniqueness is enforced where practical.
- [ ] Business/company customers are supported by customer type or clear business/customer-name handling.
- [ ] `BookableItem` enforces uniqueness within a project by category + item identifier, with block/zone/phase included in display code if they are part of real identity.
- [ ] `SHARE` is implemented only as a generic category.
- [ ] `Booking` stores administrative status only (`DRAFT`, `ACTIVE`, `CANCELLED`, `REFUNDED`, optional `HOLD`); `TRANSFERRED` and `HANDED_OVER` are not implemented.
- [ ] Derived financial status is calculated from schedule + posted allocations (`UNPAID`, `PARTIALLY_PAID`, `FULLY_PAID`, `OVERDUE`).
- [ ] `BookingInstallment` does not rely on authoritative manual paid flags; paid amount, due amount, overdue amount/count, and next installment are recomputable.
- [ ] Receipt allocation table supports many-to-many booking/voucher allocation and stores amount, allocation date, and reference.
- [ ] `CustomerModule` with CRUD endpoints (`GET/POST/GET :id/PATCH`) implemented and guarded.
- [ ] `BookableItemModule` with CRUD endpoints implemented and guarded.
- [ ] `BookingModule` with CRUD endpoints implemented and guarded.
- [ ] `BookingReceiptAllocationModule` (or equivalent) with link/unlink/allocation endpoints implemented and guarded.
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
- [ ] Administrative booking status badges are color-coded (DRAFT=gray, ACTIVE=blue, HOLD=yellow if implemented, CANCELLED=red, REFUNDED=purple).
- [ ] Financial status badges are shown separately for derived status (UNPAID, PARTIALLY_PAID, FULLY_PAID, OVERDUE).
- [ ] Payment schedule table displays installments with due dates, amounts, and derived paid/due status.
- [ ] Booking status transitions work with confirmation dialogs.
- [ ] Navigation links added under "Customers & Bookings" section in sidebar.
- [ ] `pnpm typecheck` finds no TypeScript errors.
- [ ] `pnpm lint` passes.
- [ ] `pnpm build:web` and `pnpm build:api` complete successfully.
- [ ] No collection linkage or report changes made.

## 4. Collection/Receipt Voucher Linkage (Phase 2M-4)

- [ ] "Record Collection" button on booking detail page opens collection form.
- [ ] Collection form creates a receipt voucher as `DRAFT` and links it to the booking through a pending allocation.
- [ ] No collection flow auto-posts a receipt voucher.
- [ ] Receipt voucher narration includes booking reference: `[Booking {bookingNumber}] - {customerName}`.
- [ ] "Link Existing Voucher" button allows searching and allocating an existing RECEIPT voucher to one or more bookings by explicit allocation amounts.
- [ ] Cannot link a non-RECEIPT voucher to a booking.
- [ ] Cannot unlink a posted voucher from a booking.
- [ ] Collection history table on booking detail shows: allocation date, voucher number (clickable), amount, allocation reference, status (DRAFT/POSTED), and reversal reference when applicable.
- [ ] Running totals displayed: total collected, total due.
- [ ] Booking collected amount updates only when linked voucher is posted.
- [ ] DRAFT receipts do not affect booking collected amount or reports.
- [ ] Posted reversal vouchers linked through Phase 2L net down collected totals and appear in customer history.
- [ ] Booking financial status updates correctly: UNPAID, PARTIALLY_PAID, FULLY_PAID, OVERDUE (derived, not manual).
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
- [ ] `GET /reports/overdue-installments` returns bookings with overdue installments, days overdue, overdue amount, overdue installment count, and next installment date.
- [ ] All report endpoints are guarded (`AuthGuard + RolesGuard + ACCOUNTANT`).
- [ ] All reports derive from posted voucher lines + booking data (no DRAFT contamination).
- [ ] Customer/project collection reports use receipt allocation links for booking/project allocation, while existing accounting reports continue to derive from posted VoucherLine records.
- [ ] Project Fund Movement remains strict same-line Option A and does not infer from customer allocation links.

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
- [ ] Overdue installment report does not include 30/60/90 aging buckets, advanced aging analytics, or automated reminders.
- [ ] No double-counting between customer reports and existing accounting reports.
- [ ] DRAFT bookings and DRAFT receipts do not affect any report totals.
- [ ] ACTIVE bookings affect receivable and due reports.
- [ ] CANCELLED/REFUNDED bookings are excluded from active receivable totals and appear only in separate status/history views unless explicitly included.
- [ ] Reports clearly state whether cancelled/refunded bookings are included or excluded.

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
- DRAFT receipt allocations affect collected, due, overdue, or financial status totals.
- Collections can be recorded without a receipt voucher.
- Generated collection receipt vouchers are auto-posted.
- Posted receipt vouchers can be unlinked from bookings.
- Customer balances are derived from draft vouchers, manual paid flags, or non-posted allocations.
- Project Fund Movement infers project movement from booking allocation links instead of same-line voucher tags.
- A client portal or customer login page exists.
- Revenue recognition journal entries are automatically generated.
- Legal ownership transfer, deed/registration, securities/shareholder, or investment-share behavior is claimed or implemented.
- GL receivable recognition is claimed without explicit AGM/accounts control-account approval and voucher-account policy.
- The `pnpm demo:audit` or `pnpm demo:verify` baseline is broken.
- Schema changes break existing voucher, ledger, or report functionality.
