# Phase 2M-3: Frontend / Internal UI Scope Lock

## Purpose

Phase 2M-3 locks the internal frontend scope for Customer Booking & Receivable Control before any UI implementation starts. This is a docs-only scope lock for authenticated `/app` screens only. It does not implement frontend code.

The UI must remain accounting-first: booking and receipt allocation screens are internal control/subledger views, while posted receipt vouchers remain the accounting source of truth.

## Hard Boundary

- Documentation only in this chunk.
- Do not edit `apps/web`, `apps/api`, or `prisma`.
- Do not run migrations or mutate the database.
- Do not commit, tag, or push.
- Start implementation only after review and explicit user confirmation.

## Locked Routes

- `/app/customers`
- `/app/customers/new`
- `/app/customers/[id]`
- `/app/customers/[id]/edit`
- `/app/bookable-items`
- `/app/bookable-items/new`
- `/app/bookable-items/[id]`
- `/app/bookable-items/[id]/edit`
- `/app/bookings`
- `/app/bookings/new`
- `/app/bookings/[id]`
- `/app/bookings/[id]/edit`

## Locked Screens

- Customer list/create/detail/edit.
- Bookable item list/create/detail/edit.
- Booking list/create/detail/edit.
- Installment editor inside booking create/edit only where backend allows.
- Receipt allocation panel inside booking detail.
- Read-only derived booking summary panel inside booking detail.

## Navigation

- Internal `/app` area only.
- Add under authenticated sidebar navigation as `Customer Booking` / `Customers & Bookings`.
- Link only to Customer, Bookable Item, and Booking pages.
- Never show this module in a public navbar or unauthenticated page.

## Customer UI

### Customer List

Table columns:

- Customer code
- Name
- Type
- Phone
- Email
- NID / Passport
- Status
- Created date
- Actions

Allowed actions:

- Search/filter by customer identity fields where backend/data shape supports it.
- Filter by Active, Inactive, and All.
- View customer detail.
- Create customer.
- Edit customer.

Disabled/deferred actions:

- Delete customer.
- Merge duplicates.
- Customer portal invite.
- Public customer statement.
- Public customer registration.

### Customer Detail

Route contract: `/app/customers/[id]` is a read-only customer receivable/control view with customer metadata and links to related bookings if available.

Sections:

- Customer identity and contact summary.
- Internal notes.
- Related bookings summary/list where safely available.
- Empty state when no booking exists.

Disabled/deferred actions:

- Customer login activation.
- Public statement print.
- Legal ownership status.
- CRM/lead pipeline activity.

### Customer Create

Form fields:

- Customer type: Individual or Business.
- Name: required.
- Phone: required.
- Email: optional.
- NID / Passport: optional.
- Address: required.
- Profession / Business: optional.
- Nominee / Reference: optional.
- Notes: optional.
- Active status where backend supports it.

Validation rules:

- Name, phone, and address cannot be blank.
- Email must be valid if supplied.
- NID/passport is optional; backend uniqueness errors must be shown clearly.
- Phone is required but not globally unique.
- Customer code is backend-generated and never entered by the user.
- Address is required and cannot be blank.
- Phone is required but not unique.
- NID/passport is optional; uniqueness is surfaced from backend errors.

### Customer Edit

Route contract: `/app/customers/[id]/edit` is the editable customer form only.

Form fields:

- Same editable fields as customer create.
- Customer code shown as read-only/generated metadata only.

Validation rules:

- Name, phone, and address cannot be blank.
- Phone is required but not unique.
- NID/passport is optional; uniqueness is surfaced from backend errors.
- Customer code remains read-only/generated.
- Edit cannot blank-clear address when supplied.

## Bookable Item UI

### Bookable Item List

Table columns:

- Item code
- Project
- Category
- Block / Zone / Phase
- Item identifier
- Size / Area / Share quantity
- Base price
- Status
- Actions

Allowed actions:

- Filter by project, category, status, and search text where backend/data shape supports it.
- View item detail.
- Create item.
- Edit item.

Disabled/deferred actions:

- Bulk inventory import.
- Legal deed/registration state.
- Automated availability timer.
- Handover or ownership transfer.

### Bookable Item Create/Edit

Form fields:

- Project: required.
- Category: required; LAND, PLOT, FLAT, UNIT, SHARE, OTHER.
- Block: optional.
- Zone: optional.
- Phase: optional.
- Item identifier: required.
- Size / Area / Share quantity: optional.
- Base price: required.
- Status where backend allows it.

Validation rules:

- Project, category, item identifier, and base price are required.
- Base price must be positive.
- Duplicate project/category/item identifier conflicts must show backend errors clearly.
- SHARE is generic only; no legal/shareholder/investment wording.
- Item code is backend-generated, display-only, and immutable.

Status selectability rules:

- On create, default status should be AVAILABLE unless backend/business rule requires another valid status.
- UI must not allow manual BOOKED selection during normal create as a shortcut for booking.
- BOOKED should be reached through successful booking creation, not manual status manipulation.
- Edit may show current status.
- Manual status changes must be conservative and follow backend constraints.
- If status editing is included, allowed options must be documented before implementation and must not conflict with existing bookings.
- SOLD, CANCELLED, and HOLD must not imply revenue recognition, ownership transfer, or legal completion.

### Bookable Item Detail

Sections:

- Item identity.
- Project reference.
- Price/status metadata.
- Related booking summary where available.

Disabled/deferred actions:

- Mark handed over.
- Mark transferred.
- Legal registration workflow.

## Booking UI

### Booking List

Table columns:

- Booking number
- Booking date
- Customer
- Project
- Bookable item
- Administrative status
- Financial status
- Net booking value
- Total collected from posted allocations
- Total due
- Next installment date
- Overdue amount
- Actions

Allowed actions:

- Search by booking/customer/item/project where backend/data shape supports it.
- Filter by administrative status, customer, and project.
- View booking detail.
- Create booking.
- Edit booking where backend allows it.

Disabled/deferred actions:

- Reports.
- Print public customer statement.
- Auto-post collection voucher.
- Cancellation/refund automation.
- Approval workflow.

### Booking Create/Edit

Form fields:

- Customer: required.
- Project: required.
- Bookable item: required and scoped to selected project where possible.
- Booking date: required.
- Total agreed price: required.
- Discount / adjustment: optional.
- Net booking value: read-only computed preview.
- Booking money / down payment: required according to backend rules.
- Administrative status where backend allows it.
- Remarks: optional.
- Installments: optional repeating rows where backend allows edits.

Installment editor fields:

- Sequence / installment number.
- Due date.
- Amount.
- Notes/reference.

Validation rules:

- Customer, project, bookable item, booking date, and total agreed price are required.
- Money fields must satisfy backend non-negative/positive rules.
- Each installment row requires due date and positive amount.
- Installment sequence must be unique within the booking payload.
- Paid flags are never editable; paid/due state is derived from posted receipt allocations.
- Booking number is backend-generated, display-only, and immutable.
- Derived financial fields are read-only and excluded from edit payloads.
- Backend material-edit restrictions after allocations must be shown without client-side bypass.

Disabled/deferred actions:

- Create receipt voucher during booking create.
- Auto-post booking money.
- Recognize revenue.
- GL receivable control posting.
- Approval submission.

### Booking Detail

Sections:

- Booking identity and administrative status.
- Customer summary.
- Project and bookable item summary.
- Price summary.
- Read-only derived booking summary panel.
- Installment schedule table.
- Receipt allocation panel.
- Internal remarks.

Derived booking summary panel fields:

- Net booking value.
- Booking money / down payment recorded on booking.
- Posted collected amount.
- Pending allocation amount from DRAFT receipt vouchers.
- Total due.
- Overdue amount.
- Overdue installment count.
- Next installment date.
- Derived financial status.

Installment table columns:

- Sequence
- Due date
- Scheduled amount
- Posted paid amount
- Due amount
- Derived status
- Notes/reference

Summary rules:

- Label posted totals as voucher-backed totals.
- Label DRAFT allocation totals as pending only.
- Do not mix pending allocations into collected, due, overdue, or financial status.
- Do not claim GL-recognized receivable or revenue recognition.

## Receipt Allocation UX Rules

Receipt allocation UI lives only inside booking detail for Phase 2M-3.

Phase boundary rules:

- Phase 2M-3 includes a receipt allocation panel inside booking detail.
- Phase 2M-3 may show existing allocations and their DRAFT/POSTED effect.
- Phase 2M-3 may include minimal link/create/delete UI only for the already-existing Phase 2M-2 allocation endpoints if approved in the implementation chunk.
- Phase 2M-3 must not create a broader collection workflow.
- Phase 2M-3 must not create receipt vouchers.
- Phase 2M-3 must not post vouchers.
- Phase 2M-3 must not change voucher posting behavior.
- Phase 2M-3 must not implement customer ledger/statement reports or due reports.
- Full collection workflow/reporting remains deferred to a later phase, likely Phase 2M-4.

Table columns:

- Allocation date
- Voucher number
- Voucher status
- Allocation amount
- Allocation reference/note
- Posted effect
- Reversal/reference note when available
- Actions

Allowed actions:

- View existing receipt allocations for the booking.
- Allocate an existing RECEIPT voucher only through minimal UI approved in the implementation chunk and only against existing Phase 2M-2 allocation endpoints.
- Delete/unlink only DRAFT-voucher allocations where backend allows deletion and only if approved in the implementation chunk.
- Navigate to linked internal voucher detail.

Pending/posted display rules:

- DRAFT voucher allocations are shown as `Pending allocation`.
- DRAFT allocations do not affect collected, due, overdue, or financial status totals.
- POSTED receipt allocations are shown as `Posted receipt collection`.
- POSTED allocations affect posted collected amount and derived due values.
- Posted reversal vouchers net down collection effect when backend returns net/effective summary.
- Draft reversal vouchers are pending only and do not net down totals.
- Posted allocations cannot be unlinked from the UI.

Receipt allocation validation rules:

- Allocation amount is required and must be positive.
- Allocation date is required if backend requires it.
- Allocation reference/note is optional unless backend requires it.
- Only RECEIPT vouchers may be linked; show backend errors for non-RECEIPT vouchers.
- Allocation must not exceed backend-calculated remaining booking capacity.
- Never infer project movement from allocation rows.

Required wording:

- `Receipt allocation panel`
- `Existing RECEIPT voucher allocation`
- `Pending allocation`
- `Posted receipt collection`

Avoid wording:

- `Collection module`
- `Full collection linkage workflow`
- `Customer payment workflow`
- `Receivable report`
- `Ledger report`

## BDT And Date Formatting Rules

- Monetary values must display as BDT amounts.
- Display money with thousands separators and two decimal places where practical.
- Example: `BDT 200,000.00`.
- Example: `BDT 0.00`.
- Formatting applies to `totalAgreedPrice`, `discountAmount`, `netBookingValue`, `bookingMoney`, installment amount, `totalReceivable`, `totalCollected`, `totalDue`, `overdueAmount`, and allocation amount.
- Date inputs should use ISO-compatible HTML date input format where applicable.
- Display dates consistently as readable day-month-year or the existing app date convention, but do not invent multiple formats.
- Booking date, installment due date, next installment date, voucher date/allocation date should use the same display convention.
- Empty/unknown dates should show a neutral dash, not misleading text.

## Error, Loading, And Empty State Rules

- Each list page must show loading, error, and empty states.
- Forms must surface backend validation errors through the existing internal `Notice`/error pattern.
- Empty customer, bookable item, and booking tables must explain the next allowed action.
- Receipt allocation panel must show an empty state when no allocations exist.
- Failed save/delete/allocation actions must preserve entered form data where practical.
- Backend rejection messages must not be hidden behind generic `Something went wrong` text only.

## Accounting-First Wording

Use these labels and descriptions:

- Customer Booking
- Customers & Bookings
- Customer receivable/control view
- Bookable Item
- Booking Control
- Receipt Allocation
- Pending allocation
- Posted receipt collection
- Voucher-backed collection
- Derived financial status
- Administrative booking status
- Net booking value
- Posted collected amount
- Pending allocation amount
- Total due
- Overdue amount
- Internal accounting control
- Source of truth: posted receipt voucher

Required explanatory copy:

- `Posted receipt vouchers are the accounting source of truth.`
- `Pending allocations linked to draft vouchers do not affect collected or due totals.`
- `This screen is an internal accounting control view, not a customer portal.`

## Banned Wording

Do not use these labels or claims in Phase 2M-3 UI:

- Client portal
- Customer login
- Public statement
- Customer self-service
- Pay online
- Payment gateway
- Auto-post
- Auto-posted receipt
- Revenue recognized
- GL receivable recognized
- Statutory receivable
- Ownership transferred
- Deed completed
- Registration completed
- Handover completed
- Legal owner
- Shareholder
- Investment share
- Dividend
- Sales pipeline
- Lead conversion
- Agent commission
- Approval workflow
- Admin approval
- Manager approval

## Hard Non-Scope

- Client portal/customer login.
- Public customer statement.
- Reports.
- PDF/Excel export.
- Dashboard analytics.
- Payment gateway.
- SMS/email/WhatsApp reminders.
- Auto-posting receipt vouchers.
- Voucher posting changes.
- Project Fund Movement changes.
- Revenue recognition.
- GL receivable control policy.
- Legal ownership transfer/deed/registration/handover.
- Approval workflow.
- New roles.
- Mobile app.
- Agent commission.
- CRM/lead pipeline.

## Implementation Chunks

### 2M-3A

- Route/navigation skeleton.
- API client helpers/types.
- Customer list/create/detail/edit.

### 2M-3B

- Bookable item list/create/detail/edit.

### 2M-3C

- Booking list/create/detail/edit.
- Installment editor.
- Derived summary panel.

### 2M-3D

- Receipt allocation panel.
- Pending/posted allocation UI.
- Browser/API smoke verification.

### 2M-3E

- Polish/accessibility/responsive/internal review.
- Final smoke.
- Docs cleanup.

## Verification Plan

For this docs-only scope lock:

- `git diff --check`
- `pnpm typecheck`
- `pnpm lint`

For later implementation:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build:web`
- `pnpm build:api`
- Browser smoke for all locked routes.
- API smoke for customer, bookable item, booking, and receipt allocation calls.
- Verify no public navbar links exist.
- Verify no DB migrations are created by UI work.
- Verify no voucher posting, report, or Project Fund Movement behavior changes are made.

## Acceptance Criteria

- Scope lock exists with route list, screen list, table columns, form fields, allowed actions, disabled/deferred actions, validation rules, receipt allocation UX rules, accounting-first wording, banned wording, implementation chunks, verification plan, and acceptance criteria.
- Phase 2M-3 plan exists.
- Phase 2M-3 acceptance criteria document exists.
- `docs/ai/CURRENT_STATE.md` and `docs/handoff.md` state Phase 2M-3 is docs-only scoped and not implemented.
- No `apps/web`, `apps/api`, or `prisma` files are edited.
- No migrations are run.
- No database mutations are made.
- No commit, tag, or push is made.
