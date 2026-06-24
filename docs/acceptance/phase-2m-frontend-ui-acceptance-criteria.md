# Phase 2M-3: Frontend / Internal UI Acceptance Criteria

This document defines acceptance criteria for the Phase 2M-3 frontend/internal UI docs-only scope lock and later implementation.

## 1. Docs-Only Scope Lock Acceptance

- [ ] Scope lock document exists.
- [ ] Implementation plan document exists.
- [ ] Acceptance criteria document exists.
- [ ] Locked route list is documented.
- [ ] Locked screen list is documented.
- [ ] Table columns are documented for customer, bookable item, booking, installment, and receipt allocation views.
- [ ] Form fields are documented for customer, bookable item, and booking create/edit flows.
- [ ] Allowed actions are documented.
- [ ] Disabled/deferred actions are documented.
- [ ] Validation rules are documented.
- [ ] Receipt allocation UX rules are documented.
- [ ] Accounting-first wording is documented.
- [ ] Banned wording is documented.
- [ ] BDT/date formatting rules are documented.
- [ ] Error/loading/empty state rules are documented in the scope lock.
- [ ] Implementation chunks 2M-3A through 2M-3E are documented.
- [ ] Verification plan is documented.
- [ ] `docs/ai/CURRENT_STATE.md` states Phase 2M-3 is docs-only scoped and not implemented.
- [ ] `docs/handoff.md` states Phase 2M-3 is docs-only scoped and not implemented.
- [ ] No `apps/web`, `apps/api`, or `prisma` files are changed by the scope lock.
- [ ] No migrations are run.
- [ ] No database mutations are made.
- [ ] No commit, tag, or push is made.
- [ ] `git diff --check` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.

## 2. Route And Navigation Acceptance

- [ ] `/app/customers` exists and renders inside the authenticated app shell.
- [ ] `/app/customers/new` exists and renders inside the authenticated app shell.
- [ ] `/app/customers/[id]` exists and renders inside the authenticated app shell.
- [ ] `/app/customers/[id]/edit` exists and renders inside the authenticated app shell.
- [ ] `/app/bookable-items` exists and renders inside the authenticated app shell.
- [ ] `/app/bookable-items/new` exists and renders inside the authenticated app shell.
- [ ] `/app/bookable-items/[id]` exists and renders inside the authenticated app shell.
- [ ] `/app/bookable-items/[id]/edit` exists and renders inside the authenticated app shell.
- [ ] `/app/bookings` exists and renders inside the authenticated app shell.
- [ ] `/app/bookings/new` exists and renders inside the authenticated app shell.
- [ ] `/app/bookings/[id]` exists and renders inside the authenticated app shell.
- [ ] `/app/bookings/[id]/edit` exists and renders inside the authenticated app shell.
- [ ] Internal sidebar navigation adds Customer Booking / Customers & Bookings links.
- [ ] Navigation active states work for customer, bookable item, and booking subroutes.
- [ ] No public navbar, public route, customer login, or client portal navigation is added.

## 3. Customer Screen Acceptance

- [ ] Customer list table shows customer code, name, type, phone, email, NID/passport, status, created date, and actions.
- [ ] Customer list supports search/status controls where backend/data shape allows.
- [ ] Customer create form includes customer type, name, phone, email, NID/passport, address, profession/business, nominee/reference, notes, and active status where supported.
- [ ] Customer create validates required name, phone, and address.
- [ ] Customer create validates email format if email is supplied.
- [ ] Customer create does not treat phone as globally unique.
- [ ] Customer code is not entered by the user.
- [ ] Customer detail shows identity, contact, status, and notes.
- [ ] Customer detail shows related booking summary/list only where data is safely available.
- [ ] `/app/customers/[id]` is read-only detail/control view with customer metadata and related booking links where available.
- [ ] `/app/customers/[id]/edit` is an editable customer form only.
- [ ] Customer edit keeps customer code read-only.
- [ ] Customer edit cannot blank-clear required address when supplied.
- [ ] Phone is required but not unique.
- [ ] NID/passport is optional and uniqueness conflicts are surfaced from backend errors.
- [ ] Delete, merge, customer login, public statement, document upload, and reminder actions are absent.

## 4. Bookable Item Screen Acceptance

- [ ] Bookable item list table shows item code, project, category, block/zone/phase, item identifier, size/area/share quantity, base price, status, and actions.
- [ ] Bookable item list supports project, category, status, and search controls where backend/data shape allows.
- [ ] Bookable item create form includes project, category, block, zone, phase, item identifier, size/area/share quantity, base price, and status where backend allows.
- [ ] Project, category, item identifier, and base price are required.
- [ ] Base price must be positive.
- [ ] Duplicate project/category/item identifier backend errors display clearly.
- [ ] Bookable item detail shows item identity, project, price/status metadata, and related booking summary where available.
- [ ] Bookable item edit keeps item code read-only.
- [ ] `SHARE` is displayed only as a generic bookable category.
- [ ] On create, default status is AVAILABLE unless backend/business rule requires another valid status.
- [ ] UI does not allow manual BOOKED selection during normal create as a shortcut for booking.
- [ ] BOOKED is reached through successful booking creation, not manual status manipulation.
- [ ] Edit may show current status.
- [ ] Manual status changes are conservative and follow backend constraints.
- [ ] If status editing is included, allowed options are documented and do not conflict with existing bookings.
- [ ] SOLD, CANCELLED, and HOLD do not imply revenue recognition, ownership transfer, or legal completion.
- [ ] Legal ownership, deed, registration, handover, inventory batch import, commission, and revenue recognition actions are absent.

## 5. Booking Screen Acceptance

- [ ] Booking list table shows booking number, booking date, customer, project, bookable item, administrative status, financial status, net booking value, posted collected amount, total due, next installment date, overdue amount, and actions.
- [ ] Booking list supports status/customer/project/search controls where backend/data shape allows.
- [ ] Booking create includes customer, project, bookable item, booking date, total agreed price, discount/adjustment, read-only net booking preview, booking money/down payment, administrative status where allowed, remarks, and installments.
- [ ] Booking edit keeps booking number read-only.
- [ ] Derived financial fields are read-only and excluded from update payloads.
- [ ] Backend material-edit restrictions after allocations are shown clearly.
- [ ] Administrative status and derived financial status are displayed separately.
- [ ] DRAFT, ACTIVE, HOLD, CANCELLED, and REFUNDED are administrative statuses only.
- [ ] UNPAID, PARTIALLY_PAID, FULLY_PAID, and OVERDUE are derived financial statuses only.
- [ ] Booking UI does not implement TRANSFERRED or HANDED_OVER.

## 6. Installment Editor Acceptance

- [ ] Installment editor appears only inside booking create/edit.
- [ ] Installment editor appears only where backend allows installment writes.
- [ ] Installment rows include sequence, due date, amount, and notes/reference.
- [ ] Due date and amount are required for each installment row.
- [ ] Amount must be positive.
- [ ] Sequence must be unique within the booking payload.
- [ ] Paid amount, due amount, overdue amount, and installment status are displayed as derived/read-only values only.
- [ ] No manual paid checkbox, paid date override, or manual due override exists.

## 7. Booking Detail Summary Acceptance

- [ ] Booking detail includes a read-only derived booking summary panel.
- [ ] Summary panel shows net booking value.
- [ ] Summary panel shows booking money/down payment recorded on booking.
- [ ] Summary panel shows posted collected amount.
- [ ] Summary panel shows pending allocation amount separately.
- [ ] Summary panel shows total due.
- [ ] Summary panel shows overdue amount and overdue installment count.
- [ ] Summary panel shows next installment date.
- [ ] Summary panel shows derived financial status.
- [ ] Pending allocation amount does not appear inside posted collected amount.
- [ ] Copy states that posted receipt vouchers are the accounting source of truth.
- [ ] Copy states that pending draft allocations do not affect collected or due totals.

## 8. Receipt Allocation Panel Acceptance

- [ ] Receipt allocation panel exists only inside booking detail.
- [ ] Receipt allocation panel may show existing allocations and their DRAFT/POSTED effect.
- [ ] Minimal link/create/delete UI is included only for already-existing Phase 2M-2 allocation endpoints and only if approved in the implementation chunk.
- [ ] Allocation table shows allocation date, voucher number, voucher status, allocation amount, allocation reference/note, posted effect, reversal/reference note where available, and actions.
- [ ] DRAFT voucher allocations are labelled `Pending allocation`.
- [ ] DRAFT allocations do not affect collected, due, overdue, or financial status totals.
- [ ] POSTED receipt allocations are labelled `Posted receipt collection`.
- [ ] POSTED allocations affect posted collected amount and derived due values.
- [ ] Posted reversal voucher effect is represented from backend net/effective summary when available.
- [ ] Draft reversal vouchers do not net down totals.
- [ ] Posted allocations cannot be unlinked from the UI.
- [ ] DRAFT allocations can be deleted/unlinked only where backend allows.
- [ ] Only RECEIPT vouchers may be linked; non-RECEIPT backend errors are shown clearly.
- [ ] Allocation amount is required and positive.
- [ ] Allocation capacity errors are shown clearly.
- [ ] Voucher numbers link to internal voucher detail routes.
- [ ] No auto-post receipt action exists.
- [ ] Phase 2M-3 does not create a broader collection workflow.
- [ ] Phase 2M-3 does not create receipt vouchers.
- [ ] Phase 2M-3 does not post vouchers.
- [ ] Phase 2M-3 does not change voucher posting behavior.
- [ ] Phase 2M-3 does not implement customer ledger/statement reports or due reports.
- [ ] Full collection workflow/reporting remains deferred to a later phase, likely Phase 2M-4.

## 9. Accounting-First Wording Acceptance

- [ ] UI uses `Customer Booking` for module/section context.
- [ ] UI uses `Customers & Bookings` for navigation/group wording.
- [ ] UI uses `customer receivable/control view` wording where explaining the read-only customer/booking control context.
- [ ] UI uses `Bookable Item`, not legal/inventory ownership wording.
- [ ] UI uses `Receipt Allocation`, `existing RECEIPT voucher allocation`, `Pending allocation`, and `Posted receipt collection`.
- [ ] UI uses `Voucher-backed collection` or equivalent accounting-first explanation.
- [ ] UI uses `Administrative booking status` and `Derived financial status` separately where explanatory labels are needed.
- [ ] UI states that posted receipt vouchers are the accounting source of truth.
- [ ] UI states that pending allocations linked to draft vouchers do not affect collected or due totals.
- [ ] UI states that the screens are internal accounting control views, not a customer portal.

## 9A. BDT And Date Formatting Acceptance

- [ ] Monetary values display as BDT amounts.
- [ ] Money displays with thousands separators and two decimal places where practical.
- [ ] Example formatting is supported: `BDT 200,000.00`.
- [ ] Example formatting is supported: `BDT 0.00`.
- [ ] BDT formatting applies to `totalAgreedPrice`, `discountAmount`, `netBookingValue`, `bookingMoney`, installment amount, `totalReceivable`, `totalCollected`, `totalDue`, `overdueAmount`, and allocation amount.
- [ ] Date inputs use ISO-compatible HTML date input format where applicable.
- [ ] Display dates consistently as readable day-month-year or the existing app date convention, without inventing multiple formats.
- [ ] Booking date, installment due date, next installment date, voucher date/allocation date use the same display convention.
- [ ] Empty/unknown dates show a neutral dash, not misleading text.

## 9B. Error, Loading, And Empty State Acceptance

- [ ] Each list page shows loading, error, and empty states.
- [ ] Forms surface backend validation errors through the existing internal Notice/error pattern.
- [ ] Empty customer, bookable item, and booking tables explain the next allowed action.
- [ ] Receipt allocation panel shows an empty state when no allocations exist.
- [ ] Failed save/delete/allocation actions preserve entered form data where practical.
- [ ] Backend rejection messages are not hidden behind generic `Something went wrong` text only.

## 10. Banned Wording And Non-Scope Acceptance

- [ ] No client portal/customer login is added.
- [ ] No public customer statement is added.
- [ ] No reports are added.
- [ ] No customer ledger/statement reports or due reports are added.
- [ ] No PDF/Excel export is added.
- [ ] No dashboard analytics are added.
- [ ] No payment gateway is added.
- [ ] No SMS/email/WhatsApp reminder feature is added.
- [ ] No auto-posting receipt voucher feature is added.
- [ ] No voucher posting changes are made.
- [ ] No Project Fund Movement changes are made.
- [ ] No revenue recognition behavior is added.
- [ ] No GL receivable control policy is claimed or implemented.
- [ ] No legal ownership transfer/deed/registration/handover behavior is added.
- [ ] No approval workflow is added.
- [ ] No new roles are added.
- [ ] No mobile app behavior is added.
- [ ] No agent commission behavior is added.
- [ ] No CRM/lead pipeline behavior is added.
- [ ] Banned wording from the scope lock does not appear in UI labels, helper text, actions, or empty states.

## 11. Verification Acceptance For Later Implementation

- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `pnpm build:web` passes.
- [ ] `pnpm build:api` passes.
- [ ] Browser smoke covers all locked routes.
- [ ] API smoke covers customer, bookable item, booking, and receipt allocation helpers where feasible.
- [ ] Auth smoke confirms unauthenticated access redirects to login or receives guarded behavior.
- [ ] No migration is created.
- [ ] No database schema change is made.
- [ ] Existing voucher routes still work.
- [ ] Existing accounting reports are not changed.
- [ ] Project Fund Movement remains strict same-line Option A.

## Non-Acceptance Conditions

- Any public/customer-facing portal route is added.
- Any frontend page claims customer self-service or online payment.
- DRAFT allocations are included in collected/due/financial status totals.
- Manual paid flags or due overrides are editable.
- Receipt voucher posting is bypassed or auto-posted.
- Project Fund Movement infers project movement from booking receipt allocations.
- Revenue recognition, GL receivable recognition, or legal ownership is claimed.
- New roles or approval workflows are introduced.
- Reports, PDF/Excel export, dashboard analytics, reminders, payment gateway, CRM, agent commission, or mobile app features are added.
- The UI hides backend validation failures or rewrites accounting rules client-side.
