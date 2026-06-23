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
- **Status**: **COMPLETE** at `522416e`; Phase 2M-1B clarification patch follows before implementation

## Chunk 2M-1B: Requirement Clarification Patch

- **Goal**: Resolve independent requirement quality review blockers before Phase 2M-2 schema/data-model work starts.
- **Actions**:
  - Clarify receipt-to-booking cardinality as an allocation/link table model.
  - Clarify generated collection receipt vouchers are always `DRAFT` first and never auto-posted.
  - Clarify installment paid/due state is derived from posted receipt allocations, not manual paid flags.
  - Split stored administrative booking status from derived financial status.
  - Lock report inclusion/exclusion rules for draft, active, cancelled, refunded, and posted entities.
  - Lock customer uniqueness, bookable item uniqueness, SHARE category boundary, Project Fund Movement Option A separation, aging scope, reversal netting behavior, and GL/control-account boundary.
  - Update status files (`docs/ai/CURRENT_STATE.md`, `docs/handoff.md`) to show Phase 2M-1B docs-only clarification state.
- **In-Scope**: Documentation only.
- **Out-of-Scope**: No schema changes, migrations, backend code, frontend code, tests, demo data changes, database mutations, commits, tags, or pushes.
- **Acceptance Checks**:
  - [ ] Requirement lock reflects all Phase 2M-1B decisions.
  - [ ] Plan and acceptance criteria no longer contain schema-shaping contradictions.
  - [ ] Phase 2M-2 remains `NOT STARTED`.
  - [ ] Docs state Phase 2M-2 may start only after this patch is reviewed and committed.
  - [ ] No source, Prisma schema, migration, test, or DB changes are made.
- **Verification Commands**: `git diff --check`, `git status --short --branch`, `git diff --stat`.
- **Recommended Model**: GPT-5.5 (or Claude Opus 4.8 as backup if available).
- **Stop Condition**: Docs clarified and verified. Do not commit.
- **Status**: **IN PROGRESS** (docs-only clarification patch)

## Chunk 2M-2: Data Model & Backend Foundation

- **Goal**: Design and implement the Prisma schema models, database migration, and NestJS backend API endpoints for customer, bookable item, and booking management.
- **Precondition**: Do not start until Phase 2M-1B is reviewed and committed.
- **Actions**:
  - Design Prisma models:
    - `Customer` model with fields: code, customer type or business/customer handling, name, phone, email, nid/passport, address, profession/business, nominee/reference, notes, isActive/status. `customerCode` must be unique; phone is required but not globally unique; NID/passport is optional and unique where practical.
    - `BookableItem` model with fields: code, projectId, category (enum: LAND, PLOT, FLAT, UNIT, SHARE, OTHER), optional block/zone/phase metadata, itemIdentifier, size/area/share quantity, basePrice, status (enum: AVAILABLE, BOOKED, SOLD, HOLD, CANCELLED). Enforce uniqueness within project by `category + itemIdentifier`; include block/zone/phase in displayed code if they are real identity fields.
    - `Booking` model with fields: bookingNumber, customerId, projectId, bookableItemId, bookingDate, totalAgreedPrice, discount, netBookingValue, bookingMoney, administrative status (enum: DRAFT, ACTIVE, CANCELLED, REFUNDED, optional HOLD), remarks. Do not store `PARTIALLY_PAID`, `FULLY_PAID`, or `OVERDUE` as administrative statuses.
    - `BookingInstallment` model with fields: bookingId, dueDate, amount, sequence/reference, notes. Do not make manual `isPaid`/`paidDate` flags authoritative; paid/due values are derived from posted receipt allocations.
    - `BookingReceiptAllocation` (or similarly named allocation/link table) with fields: bookingId, voucherId (FK to Voucher), amount, allocationDate, allocationReference/notes, createdAt. This supports one receipt voucher allocated to one or more bookings and one booking collected by many receipt vouchers.
  - Create and apply database migration.
  - Create NestJS modules:
    - `CustomerModule` with CRUD endpoints (`GET /customers`, `POST /customers`, `GET /customers/:id`, `PATCH /customers/:id`).
    - `BookableItemModule` with CRUD endpoints (`GET /bookable-items`, `POST /bookable-items`, `GET /bookable-items/:id`, `PATCH /bookable-items/:id`).
    - `BookingModule` with CRUD endpoints (`GET /bookings`, `POST /bookings`, `GET /bookings/:id`, `PATCH /bookings/:id`).
    - `BookingReceiptAllocationModule` (or equivalent) with allocation/link endpoints (`POST /bookings/:id/receipt-allocations`, `GET /bookings/:id/receipt-allocations`).
  - Implement auto-generated codes (CUST-00001, BOOK-00001, ITEM-00001).
  - Implement status transition validation.
  - Implement derived financial status calculation (`UNPAID`, `PARTIALLY_PAID`, `FULLY_PAID`, `OVERDUE`) from schedule plus posted allocations.
  - Keep `SHARE` as a generic category with no special legal/investment behavior.
  - Add DTO validation (class-validator).
  - Guard all endpoints with `AuthGuard + RolesGuard + ACCOUNTANT`.
- **In-Scope**: Prisma schema, migration, backend modules, DTOs, validation, guards.
- **Out-of-Scope**: Frontend pages, client portal, voucher posting changes, report changes, demo data changes.
- **Acceptance Checks**:
  - [ ] Prisma models defined according to Phase 2M-1B clarification and migration applied.
  - [ ] Receipt-to-booking allocation/link table supports many-to-many allocation with amount/date/reference.
  - [ ] Stored booking status is administrative only; financial status is derived.
  - [ ] Installment paid/due values are derived from posted receipt allocations, not authoritative manual flags.
  - [ ] Customer uniqueness and bookable item uniqueness rules are enforced.
  - [ ] All CRUD endpoints return correct responses.
  - [ ] Auto-generated codes work correctly.
  - [ ] Status transitions are validated.
  - [ ] All endpoints are guarded (401 for unauthenticated).
  - [ ] `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:api` pass.
- **Verification Commands**: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:api`, `pnpm build:web`, `pnpm check:all`.
- **Recommended Model**: DeepSeek V4 Pro Max (or Claude Opus 4.8 as backup).
- **Stop Condition**: All backend endpoints implemented and verified. No frontend changes.
- **Status**: **CANDIDATE IMPLEMENTED / UNCOMMITTED WIP; REVIEW BLOCKERS FIXED**. Backend/data-model foundation is implemented and locally verified. Added `Customer`, `BookableItem`, `Booking`, `BookingInstallment`, and `BookingReceiptAllocation` models plus guarded customer/bookable-item/booking/receipt-allocation API endpoints. Local migration `20260623000000_phase_2m_customer_booking_foundation` is applied and `pnpm exec prisma migrate status` reports the schema is up to date. Independent review blockers were fixed: booking creation updates item status to `BOOKED`; cancellation/refund without posted allocations releases the item back to `AVAILABLE` if no other open booking exists; material booking edits are blocked once allocations exist; cancellation/refund is blocked when posted allocations exist; receipt allocation capacity is effective/net posted allocation aware so posted reversals allow replacement allocations. Final Opus 4.8 blockers were fixed: customer address is required in schema/migration/create DTO/create service and cannot be blank/null-cleared on PATCH when supplied; boolean query filters explicitly parse only `true`/`false` strings for customer `isActive`, bookable-item `includeDeleted`, and booking `includeDeleted`. Voucher-level global allocation cap remains deferred/non-blocking; Phase 2M-2 keeps booking-level effective/net allocation validation only. Demo reset compatibility was fixed by clearing Phase 2M tables before vouchers/projects in FK-safe order (`booking_receipt_allocations`, `booking_installments`, `bookings`, `bookable_items`, `customers`); no Phase 2M demo seed data was added. Verification passed: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:api`, `pnpm build:web`, `pnpm demo:reset`, `pnpm demo:audit` (62 PASS / 0 FAIL / 1 WARN), `pnpm demo:verify` (47 PASS / 0 FAIL), and `pnpm exec prisma migrate status`. Targeted Prisma smoke verified the blocker scenarios and DRAFT allocation pending behavior; reset-specific smoke created temporary Phase 2M rows, then `demo:reset` succeeded and baseline was reverified. No frontend, reports, voucher posting changes, Project Fund Movement changes, auto-posting receipt vouchers, client portal, revenue recognition, legal workflow, approval workflow, or new roles were added. Recommended next step before commit: final independent review; guarded HTTP endpoint smoke remains useful if time permits.

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
  - Implement payment schedule display (table of installments with due dates, amounts, derived paid/due status).
  - Implement booking status transitions (DRAFT → ACTIVE, ACTIVE → CANCELLED, etc.) with confirmation dialogs.
- **In-Scope**: Frontend pages for customer, bookable item, and booking CRUD.
- **Out-of-Scope**: Collection/receipt voucher linkage UI, customer statement, reports, client portal.
- **Acceptance Checks**:
  - [ ] Customer list/create/edit/detail pages work correctly.
  - [ ] Bookable item list/create/edit/detail pages work correctly.
  - [ ] Booking list/create/detail pages work correctly.
  - [ ] Administrative booking status transitions work with validation.
  - [ ] Financial status badges display derived values (`UNPAID`, `PARTIALLY_PAID`, `FULLY_PAID`, `OVERDUE`).
  - [ ] Payment schedule displays derived paid/due status correctly.
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
    - Create `POST /bookings/:id/collections` endpoint to record a collection and create a linked receipt voucher as `DRAFT` only.
    - Create `POST /bookings/:id/receipt-allocations` endpoint to allocate an existing RECEIPT voucher to one or more bookings with explicit amounts.
    - Create `DELETE /bookings/:id/receipt-allocations/:allocationId` endpoint to unlink only if voucher is `DRAFT`.
    - Update `GET /bookings/:id` to include collection history with voucher status.
    - Implement validation: cannot unlink posted voucher; cannot link non-RECEIPT vouchers; allocation amounts must be explicit; draft allocations are pending only; posted reversal vouchers net down collected totals.
  - Frontend:
    - Add "Record Collection" button on booking detail page.
    - Collection form: enter amount, date, payment mode (cash/bank/MFS), optional narration -> creates `DRAFT` receipt voucher + pending allocation to booking.
    - Add "Link Existing Voucher" button to search and link an existing RECEIPT voucher.
    - Show collection history table on booking detail: date, voucher number (clickable), amount, allocation reference, status (DRAFT/POSTED), and reversal references when applicable.
    - Show running total: total collected, total due.
  - Voucher integration:
    - When creating a receipt voucher from a collection, the voucher narration should reference the booking: `[Booking {bookingNumber}] - {customerName}`.
    - The receipt voucher is a standard RECEIPT voucher; no special voucher type is created.
    - Posted voucher status changes update derived collected amount, due amount, overdue amount/count, next installment date, and financial status.
    - Draft vouchers and draft reversal vouchers have no collected/due report effect.
    - Posted reversal vouchers net down collected totals and remain visible in customer history.
- **In-Scope**: Collection creation, voucher linkage, collection history display, running totals.
- **Out-of-Scope**: Customer statement, reports, automated installment tracking, refund workflow.
- **Acceptance Checks**:
  - [ ] Can create a DRAFT receipt voucher from booking collection; no auto-posting occurs.
  - [ ] Can allocate an existing RECEIPT voucher to one or more bookings with explicit allocation rows.
  - [ ] Cannot unlink posted voucher from booking.
  - [ ] Collection history shows all linked vouchers, allocation references, statuses, and reversal references.
  - [ ] Booking collected amount updates only when linked voucher is posted.
  - [ ] DRAFT receipts and DRAFT allocations are visible as pending but do not affect collected, due, overdue, financial status, or reports.
  - [ ] Posted reversal vouchers net down customer collection totals.
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
  - All reports derive from posted receipt allocation links + booking data, with existing accounting reports still deriving from posted VoucherLine records.
  - State in each report whether cancelled/refunded bookings are excluded by default or explicitly included.
  - Keep customer/project collection reports separate from Project Fund Movement Option A.
  - Add navigation links under Reports section.
  - Browser print foundation for all report pages.
- **In-Scope**: Six report APIs, six frontend report pages, print foundation.
- **Out-of-Scope**: PDF/Excel export, dashboard analytics, 30/60/90 aging buckets, advanced aging analytics, automated reminders, cancelled/refunded booking report.
- **Acceptance Checks**:
  - [ ] All six report endpoints return correct data.
  - [ ] All six frontend report pages render and filter correctly.
  - [ ] Reports derive from posted voucher lines only.
  - [ ] DRAFT collections do not affect report totals.
  - [ ] DRAFT bookings do not affect receivable/collection totals.
  - [ ] ACTIVE bookings affect receivable/due totals.
  - [ ] CANCELLED/REFUNDED bookings are excluded from active receivable totals unless explicitly included and labelled.
  - [ ] Project collection reports allocate by booking allocation amounts; Project Fund Movement only reflects same-line voucher project tags.
  - [ ] Overdue report includes simple overdue amount, overdue installment count, and next installment date, without 30/60/90 buckets.
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
