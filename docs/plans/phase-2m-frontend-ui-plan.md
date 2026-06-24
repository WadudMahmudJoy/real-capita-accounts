# Phase 2M-3: Frontend / Internal UI Implementation Plan

This plan breaks the Phase 2M-3 internal Customer Booking UI into implementation chunks. This document is part of a docs-only scope lock and does not implement frontend code.

## Preconditions

- Baseline is `main` at `24386ec` with tag `phase-2m-backend-data-model-foundation`.
- Phase 2M backend/data-model foundation is accepted as the source for available endpoints and validation behavior.
- User explicitly confirms Phase 2M-3 implementation after reviewing this docs-only scope lock.
- No implementation starts from this docs-only task.

## Shared Implementation Rules

- Internal `/app` routes only.
- No public navbar links.
- Use existing authenticated layout and shared UI primitives.
- Add navigation under internal/sidebar navigation as `Customer Booking` / `Customers & Bookings`.
- Preserve HttpOnly cookie auth through the existing API fetch pattern.
- Backend validation is authoritative.
- No schema, migration, backend, voucher posting, report, Project Fund Movement, role, or public-page changes.
- No auto-posting of receipt vouchers.
- No revenue recognition, GL receivable policy, legal ownership, CRM, approval, dashboard, export, reminder, gateway, or client portal behavior.

## Chunk 2M-3A: Route, Navigation, API Client, Customer Screens

Goal: Establish the frontend route skeleton, API client helpers/types, and customer management UI.

Actions:

- Add route folders/pages for `/app/customers`, `/app/customers/new`, `/app/customers/[id]`, and `/app/customers/[id]/edit`.
- Add internal sidebar navigation section for customer booking pages.
- Add API client types/helpers for Customer list/get/create/update.
- Add customer list page with search/status controls and columns: customer code, name, type, phone, email, NID/passport, status, created date, actions.
- Add customer create form with customer type, name, phone, email, NID/passport, address, profession/business, nominee/reference, notes, and active status where supported.
- Add customer detail screen with identity/contact summary, internal notes, and related booking summary where safely supported.
- Keep `/app/customers/[id]` as a read-only customer receivable/control view.
- Keep `/app/customers/[id]/edit` as the editable customer form only, with customer code read-only.

Validation:

- Name, phone, and address are required.
- Email format is validated if supplied.
- Phone is not treated as globally unique.
- Customer code is backend-generated and immutable.
- Address remains required and cannot be blank-cleared.
- Backend validation errors are surfaced through existing notice/error patterns.

Acceptance checks:

- Customer list/create/detail/edit routes render under `/app`.
- Customer create and edit call guarded backend endpoints through cookie-authenticated helpers.
- Customer detail clearly states internal accounting/customer booking context.
- No public navigation is added.

Verification:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build:web`

## Chunk 2M-3B: Bookable Item Screens

Goal: Add internal bookable item list, create, detail, and edit screens.

Actions:

- Add routes for `/app/bookable-items`, `/app/bookable-items/new`, `/app/bookable-items/[id]`, and `/app/bookable-items/[id]/edit`.
- Add API client types/helpers for Bookable Item list/get/create/update.
- Add list filters for project, category, status, and simple search where feasible.
- Add table columns: item code, project, category, block/zone/phase, item identifier, size/area/share quantity, base price, status, actions.
- Add create/edit forms with project, category, block, zone, phase, item identifier, size/area/share quantity, base price, and status where backend allows.
- Default create status to AVAILABLE unless backend/business rules require another valid status.
- Do not allow manual BOOKED selection during normal create as a shortcut for booking.
- If status editing is included, document allowed options and follow backend constraints without implying revenue recognition, ownership transfer, or legal completion.
- Add detail page with item identity, project reference, price/status metadata, and related booking summary where available.

Validation:

- Project, category, item identifier, and base price are required.
- Base price must be positive.
- SHARE is generic wording only.
- Duplicate/unsafe backend errors are shown clearly.

Acceptance checks:

- Bookable item list/create/detail/edit routes render under `/app`.
- Project/category/status labels are readable and accounting-neutral.
- No legal ownership, deed, registration, handover, commission, inventory import, or revenue recognition wording appears.

Verification:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build:web`

## Chunk 2M-3C: Booking Screens, Installment Editor, Derived Summary

Goal: Add booking list, create, detail, edit, installment editor, and read-only derived summary panel.

Actions:

- Add routes for `/app/bookings`, `/app/bookings/new`, `/app/bookings/[id]`, and `/app/bookings/[id]/edit`.
- Add API client types/helpers for Booking list/get/create/update.
- Add booking list with columns: booking number, date, customer, project, item, administrative status, financial status, net booking value, posted collected, total due, next installment, overdue amount, actions.
- Add filters for administrative status, customer, project, and search where backend supports them.
- Add create form with customer, project, bookable item, booking date, total agreed price, discount/adjustment, read-only net booking preview, booking money/down payment, administrative status where allowed, remarks, and installments.
- Add edit form with generated booking number read-only and derived fields excluded from payload.
- Add installment editor for create/edit only where backend allows: sequence, due date, amount, notes/reference.
- Add booking detail with identity, customer/project/item summary, price summary, derived summary panel, installment schedule, and remarks.

Validation:

- Customer, project, item, booking date, total agreed price, and booking money are required according to backend rules.
- Amounts must be non-negative/positive according to backend rules.
- Installment due date and amount are required for each installment row.
- Installment sequence must be unique.
- No manual paid flag exists.
- Backend rejection of material edits after allocations is displayed without client-side bypass.

Acceptance checks:

- Booking routes render under `/app`.
- Administrative status and derived financial status appear separately.
- Derived summary panel is read-only and distinguishes posted collected amount from pending allocation amount.
- Installments display derived paid/due state only; no manual paid checkbox exists.

Verification:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build:web`

## Chunk 2M-3D: Receipt Allocation Panel And Smoke Verification

Goal: Add booking-detail receipt allocation UI and verify pending/posted allocation behavior.

Actions:

- Add receipt allocation panel inside `/app/bookings/[id]` only.
- Add API client types/helpers for listing/creating/deleting booking receipt allocations where backend supports them.
- Show table columns: allocation date, voucher number, voucher status, allocation amount, allocation reference/note, posted effect, reversal/reference note, actions.
- Show DRAFT voucher allocations as `Pending allocation`.
- Show POSTED receipt allocations as `Posted receipt collection`.
- Disable unlink/delete action for posted allocations.
- Allow minimal existing RECEIPT voucher allocation link/create/delete UI only if approved in this implementation chunk and only against existing Phase 2M-2 allocation endpoints.
- Add clear helper text that pending draft allocations do not affect collected or due totals.
- Link voucher numbers to existing internal voucher detail routes.
- Do not create a broader collection workflow, receipt voucher creation flow, voucher posting flow, customer ledger/statement reports, or due reports.

Validation:

- Allocation amount is required and positive.
- Allocation date/reference follow backend requirements.
- Only receipt vouchers are eligible; surface backend errors for non-receipt vouchers.
- Allocation capacity errors are displayed as backend validation messages.
- No project movement is inferred from allocation rows.

Formatting and state rules:

- Display monetary values as BDT with thousands separators and two decimal places where practical.
- Use one consistent date display convention for booking, installment, next installment, voucher, and allocation dates.
- Show a neutral dash for empty/unknown dates.
- Preserve entered form data after failed save/delete/allocation actions where practical.
- Show loading, error, and empty states for list pages and the receipt allocation panel.
- Surface backend validation errors through the existing internal Notice/error pattern.

Smoke verification:

- Browser smoke for customer list/create/detail/edit.
- Browser smoke for bookable item list/create/detail/edit.
- Browser smoke for booking list/create/detail/edit.
- Browser smoke for receipt allocation pending/posted display where suitable test data exists.
- API smoke for guarded endpoint behavior where feasible.

Acceptance checks:

- Receipt allocation panel is visible only on booking detail.
- Pending allocations and posted collections are visually distinct.
- Posted allocations cannot be unlinked from the UI.
- No auto-posting action exists.

Verification:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build:web`
- `pnpm build:api`

## Chunk 2M-3E: Polish, Accessibility, Responsive Review, Docs Cleanup

Goal: Finalize the internal UI implementation and update docs/status files after verification.

Actions:

- Review empty, loading, error, and success states across all Phase 2M-3 routes.
- Verify responsive behavior on desktop and mobile widths.
- Verify labels, required markers, keyboard focus, semantic headings, and accessible button/link text.
- Verify internal navigation active states.
- Verify banned wording is absent.
- Verify no public navbar/client portal route exists.
- Run final smoke verification.
- Update docs/status files to record implementation completion.

Acceptance checks:

- All locked routes render under `/app`.
- Forms are usable with keyboard and screen-reader-friendly labels.
- Tables remain readable on desktop and degrade safely on smaller screens.
- No hard non-scope feature appears.
- No schema/migration/backend/voucher/report/Project Fund Movement changes exist.

Verification:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build:web`
- `pnpm build:api`
- `pnpm check:all`
- Browser smoke for all locked routes.
- `git diff --check`
- `git status --short --branch`

## Final Phase 2M-3 Stop Condition

- All customer, bookable item, and booking internal UI routes are implemented.
- Receipt allocation panel exists only inside booking detail.
- Derived booking summary is read-only and accounting-first.
- Pending/draft allocations are clearly excluded from collected/due totals.
- No hard non-scope items are added.
- Verification passes.
- Docs/status files are updated.
- User reviews before any Phase 2M-4 or report work starts.
