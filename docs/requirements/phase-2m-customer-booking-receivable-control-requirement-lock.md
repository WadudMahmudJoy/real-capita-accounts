# Phase 2M: Customer Booking & Receivable Control Requirement Lock

## Purpose

Phase 2M locks the requirements, business logic, accounting rules, data model boundaries, and UX scope for **Customer Booking & Receivable Control**. This phase adds an internal, accounting-first workflow for recording customers, their bookings (land, plot, flat, unit, share, or other project-based assets/interests), agreed values, payment schedules, money received, due amounts, voucher-backed transaction history, and customer statements.

This is an internal accounting module. It is not a CRM, not a sales automation tool, not a client portal, and not a public-facing customer login system. Client portal is explicitly deferred until internal accounting/customer-booking workflow is stable and AGM confirms the final business wording.

## Business Context

Real Capita Group sells/allocates land, plots, flats, units, shares, or similar real-estate/project-based assets/interests. Accounts need customer-wise booking and payment control. Today, when a customer wants to buy a plot, the accountant needs to:

1. Record the customer's identity and contact details.
2. Record the booking: what they are buying, from which project, at what price.
3. Record the payment schedule or installment plan.
4. Record booking money / down payment received.
5. Link every collection to an accounting receipt voucher.
6. Track how much is still due.
7. See the customer's complete payment history.
8. Print a customer statement showing debits, credits, and balance.
9. See project-wise collection and receivable reports.

Phase 2M answers the business question: "When a customer wants to buy a plot, how does Real Capita record the customer, booking, agreed value, payment schedule, money received, due amount, voucher-backed transaction history, and customer statement?"

## Current Status

**Requirement lock plus Phase 2M-1B clarification patch only. Not implemented.** The Phase 2M-1 requirement lock exists at `522416e`. Phase 2M-1B resolves schema-shaping clarification blockers before Phase 2M-2 starts. No schema changes, migrations, backend API endpoints, frontend pages, database mutations, or demo data changes have been made for Phase 2M.

Phase 2M-2 may start only after the Phase 2M-1B clarification patch is reviewed and committed.

## Scope Included

### A. Customer Master

A customer record captures identity and contact information for internal accounting use.

Fields:
- **Customer code** (auto-generated, e.g., `CUST-00001`)
- **Customer type** (individual or business/company, if required by implementation)
- **Name** (required, full name or business name)
- **Phone** (required, primary contact number)
- **Email** (optional)
- **NID / Passport** (optional, national ID or passport number for identity reference)
- **Address** (required, present or permanent address)
- **Profession / Business** (optional)
- **Nominee / Reference** (optional, nominee name and contact)
- **Notes** (optional, free-text internal notes)
- **Status**: `ACTIVE` or `INACTIVE`

Rules:
- Customer code is auto-generated and immutable after creation.
- Customer code is unique.
- Name and phone are required at minimum.
- Phone is required but not globally unique. Families, offices, or business contacts may share a phone number.
- NID/passport is optional. If present, it should be unique where practical, but missing ID must not block customer creation.
- Duplicate customer warning/search can be added later; it is not required for Phase 2M-2 schema foundation.
- Business/company customers must be supported either through a `customerType` field or through clear notes/business-name handling if no separate company model exists.
- Deactivating a customer does not delete the record; it prevents new bookings.
- Customer master is internal-only. No public-facing customer registration or login.
- Only the `ACCOUNTANT` role can create, view, edit, and deactivate customers.

### B. Bookable Item / Product Reference

A minimal bookable item reference records what is being sold or allocated. This is attached to a Project, not a full inventory management system.

Supported booking item categories:
- `LAND`
- `PLOT`
- `FLAT`
- `UNIT`
- `SHARE`
- `OTHER`

Fields:
- **Project** (required, links to the existing `Project` model)
- **Block / Zone / Phase** (optional)
- **Item identifier** (required, e.g., plot number, flat number, share lot ID)
- **Size / Area / Share quantity** (optional, e.g., katha, sqft, number of shares)
- **Base price** (required, the listed or reference price)
- **Status**: `AVAILABLE`, `BOOKED`, `SOLD`, `HOLD`, `CANCELLED`

Rules:
- If the current system does not have full inventory/unit management, Phase 2M starts with a minimal bookable item reference attached to Project, not a full inventory module.
- Within a project, `category + itemIdentifier` must be unique.
- Block, zone, and phase are optional metadata/search fields unless AGM/accounts confirms they are part of the real item identity.
- If block, zone, or phase are part of the real item identity, they must be included in the displayed item code/reference so accountants can distinguish units clearly.
- No two `ACTIVE`, `BOOKED`, or `SOLD` records should represent the same real plot, flat, unit, land, or share reference.
- `SHARE` remains a generic bookable item category in Phase 2M. It has no special company-share, investment-share, legal ownership, dividend, or securities behavior until AGM/accounts confirms the business meaning.
- Item status transitions: `AVAILABLE` → `BOOKED` (when booking created) → `SOLD` (when fully paid and handed over, future) or `CANCELLED` (when booking cancelled).
- `HOLD` status may be used for temporary reservation (manual status change, no automated timer).
- Only the `ACCOUNTANT` role can manage bookable items.

### C. Booking Record

A booking is the core record linking a customer to a bookable item at an agreed price with a payment schedule.

Fields:
- **Booking number** (auto-generated, e.g., `BOOK-00001`)
- **Customer** (required, links to Customer)
- **Project** (required, links to Project)
- **Bookable item** (required, links to Bookable Item)
- **Booking date** (required, defaults to today)
- **Total agreed price** (required, the negotiated total price)
- **Discount / Adjustment** (optional, any discount or price adjustment)
- **Net booking value** (computed: total agreed price minus discount/adjustment)
- **Booking money / Down payment** (required, the initial payment amount)
- **Payment schedule / Installment plan** (optional at creation, can be defined as a list of installment dates and amounts)
- **Administrative booking status** (stored):
  - `DRAFT` -- booking created but not yet confirmed/active
  - `ACTIVE` -- booking confirmed, payment tracking begins
  - `CANCELLED` -- booking cancelled
  - `REFUNDED` -- booking cancelled and payments refunded
  - `HOLD` -- optional manual hold/reservation status
  - `TRANSFERRED` / `HANDED_OVER` -- deferred to future phase
- **Financial booking status** (derived):
  - `UNPAID`
  - `PARTIALLY_PAID`
  - `FULLY_PAID`
  - `OVERDUE`
- **Remarks** (optional, free-text notes)

Rules:
- Booking number is auto-generated and immutable after creation.
- Net booking value is computed, not manually entered.
- Booking money / down payment is recorded as part of the booking record but does not automatically create a receipt voucher; the accountant must explicitly create or link a receipt voucher.
- Administrative status and financial status are separate. Do not store `PARTIALLY_PAID`, `FULLY_PAID`, or `OVERDUE` as administrative booking statuses.
- Financial status is derived from the payment schedule and posted receipt allocations only.
- `DRAFT` bookings are excluded from receivable totals.
- `ACTIVE` bookings are included in receivable and due reports.
- `CANCELLED` and `REFUNDED` bookings are excluded from active receivable totals but remain visible in history/status reports.
- `TRANSFERRED` and `HANDED_OVER` are deferred and must not be implemented in Phase 2M unless separately approved.
- Only the `ACCOUNTANT` role can create, view, edit, and manage bookings.

### D. Receivable / Due Tracking

For every active booking, the system tracks:

- **Total receivable** (net booking value)
- **Total collected** (sum of posted receipt voucher amounts linked to this booking)
- **Total due** (total receivable minus total collected)
- **Overdue amount** (sum of installment amounts past their due date that remain unpaid)
- **Overdue installment count** (count of unpaid installments past due date)
- **Next installment date** (earliest unpaid installment due date)
- **Financial status** (derived: `UNPAID`, `PARTIALLY_PAID`, `FULLY_PAID`, `OVERDUE`)

Rules:
- Receivable/due values are derived from posted voucher lines only. DRAFT receipts do not affect these calculations.
- Installment paid/due status is derived from posted receipt allocations. Manual paid flags must not be trusted as the source of truth.
- Paid amount, due amount, overdue amount, overdue installment count, and next installment date are calculated from the payment schedule plus posted receipt allocations.
- If cached/display fields exist later, they must be recomputable and not authoritative.
- Overdue amount and overdue installment count are computed against the payment schedule; if no schedule is defined, overdue amount and count are zero.
- Advanced aging buckets (30/60/90), aging analytics, and automated reminders are deferred.

### E. Collection / Receipt Linkage

Collections (money received from customers) must link to accounting. The receipt voucher remains the accounting source of truth.

Options (both must be supported):
1. **Create receipt voucher from booking collection**: The accountant enters a collection against a booking, and the system generates a linked receipt voucher as `DRAFT`.
2. **Link existing receipt voucher to booking/customer**: The accountant can link an already-created receipt voucher to a booking and/or customer.

Rules:
- Receipt voucher remains the accounting source of truth after posting.
- Use a separate allocation/link table model for receipt-to-booking linkage.
- One receipt voucher may be allocated to one or more bookings.
- One booking may receive collections from many receipt vouchers.
- Every allocation stores `bookingId`, `voucherId`, `amount`, allocation date, and allocation/reference note.
- Generated collection receipt vouchers are always `DRAFT` first. No auto-posting is allowed.
- Normal voucher review and posting remains required before customer collection totals change.
- Allocation linked to a `DRAFT` voucher is visible as pending but must not affect collected, due, overdue, or financial status totals.
- Allocation counts as collected only when the linked receipt voucher is `POSTED`.
- DRAFT collections must not affect reports or customer due balance.
- POSTED receipt vouchers update customer payment history, booking collected amount, and accounting reports.
- If a linked voucher is rejected, deleted, or reversed, customer collection totals must reflect only the net posted voucher effect.
- Collection history must show voucher number, voucher status (DRAFT/POSTED), date, amount, linked booking(s), and allocation reference.
- Unlinking a receipt voucher from a booking is not allowed after the voucher is posted.
- A receipt voucher can be linked to multiple bookings only through explicit allocation rows; do not model this as a single nullable `bookingId` on `Voucher`.
- If a receipt voucher linked to customer collection is reversed through Phase 2L, reports net down according to posted voucher effect: original posted receipt increases collected, posted reversal decreases/net-offs collected, and a draft reversal has no report effect.
- Customer history should show both the original and reversal voucher references.

### F. Customer Transaction History

A customer-wise view showing all accounting-relevant events:

- Booking created (date, booking number, item, project, net value)
- Receipts / payments (date, voucher number, amount, status)
- Adjustments (future, deferred)
- Cancellations / refunds (future, deferred)
- Voucher links (clickable to voucher detail)
- Running balance (total paid to date, total due)

Rules:
- Transaction history is derived from posted voucher lines plus booking records.
- History is read-only; no manual entries.
- History can be filtered by date range and project.
- Pending allocations linked to draft vouchers may be shown separately, but they must be labelled pending and excluded from paid/due totals.
- Reversed linked receipts must show both original and reversal voucher references so the net effect is auditable.

### G. Customer Statement

A printable/viewable statement showing:

- Customer info (name, code, phone, address)
- Booking info (booking number, item, project, total price, payment schedule summary)
- Date-wise transactions (date, description, voucher reference, debit/credit, balance)
- Summary section: Total Price, Total Paid, Due Amount, Overdue Amount
- Voucher references with clickable links

Rules:
- Statement is derived from posted vouchers and booking data.
- Statement supports browser print (no PDF/Excel export in this phase).
- Statement format follows accounting conventions: date, particular, voucher ref, debit, credit, balance.
- Pending draft receipt allocations may appear in a separate pending section only; they must not affect statement paid/due totals.

### H. Reports

Minimum reports for Phase 2M:

1. **Customer Ledger / Statement** -- date-wise debit/credit/balance per customer, filterable by project and date range.
2. **Booking-wise Receivable Report** -- all bookings with total value, total collected, total due, status, next installment.
3. **Customer-wise Due Report** -- customers with outstanding dues, overdue amounts, overdue installment count, and next installment date.
4. **Project-wise Collection Report** -- total collections received per project, grouped by customer or booking.
5. **Project-wise Receivable Report** -- total outstanding receivables per project, grouped by customer or booking.
6. **Overdue / Installment Due Report** -- bookings with overdue installments, days overdue, amount overdue.

Deferred reports (not in Phase 2M):
- Cancelled / refunded booking report
- Aging analysis (30/60/90 day buckets)
- Advanced aging analytics
- Customer acquisition / conversion report
- Sales pipeline / lead report

Report inclusion policy:
- `DRAFT` bookings do not affect receivable or collection report totals.
- `DRAFT` receipt vouchers and allocations do not affect collected, due, overdue, or financial status totals.
- `ACTIVE` bookings affect receivable and due reports.
- `POSTED` linked receipt vouchers affect collected totals through allocation rows.
- `CANCELLED` and `REFUNDED` bookings appear only in separate status/history reporting unless a report explicitly includes them.
- Every report must state whether it includes or excludes cancelled/refunded bookings.
- Customer/project collection reports may use booking allocation links.
- Project Fund Movement remains separate and continues strict same-line Option A: no sibling-line inference and no voucher-level project shortcut.
- A generated single-booking receipt voucher may tag the fund line with the booking project/cost center.
- Multi-booking or multi-project receipt allocations must not fake Project Fund Movement by inference.
- If a receipt voucher covers multiple projects, project-wise customer collection reports allocate by booking allocation amounts, while Project Fund Movement only reflects actual voucher line project tags.

## Accounting Rules

These rules are non-negotiable and must be preserved throughout Phase 2M implementation:

1. **Accounting reports continue to derive from POSTED VoucherLine records.** The customer/booking module must not bypass voucher posting.
2. **Customer/booking module must not bypass voucher posting.** No collection can update accounting reports without a posted receipt voucher.
3. **Receipt collection should create or link to receipt vouchers.** The receipt voucher is the accounting entry; the customer/booking module is a control layer on top.
4. **DRAFT booking or DRAFT receipt must not affect ledger/trial balance.** Only posted vouchers affect accounting reports.
5. **Posted receipt voucher should update customer payment history and accounting reports.** The customer/booking module reads from posted voucher state.
6. **Phase 2M customer receivable reports are subledger/control reports.** Do not claim statutory revenue recognition or GL receivable recognition unless voucher accounts support and AGM/accounts approve that policy.
7. **Revenue recognition is policy-sensitive** and must be confirmed by AGM/accounts before recognizing revenue for land/flat/unit sales. Phase 2M does not implement revenue recognition.
8. **Booking money may be treated as liability/advance or receivable settlement** depending on accounting policy. Do not hardcode policy without AGM/accounts approval. Phase 2M records the collection; the accounting treatment of the receipt voucher (which ledger account is credited) is determined by the accountant when creating the voucher.
9. **Project Fund Movement Option A remains unchanged.** Customer/project collection reports can allocate collections by booking allocation rows, but Project Fund Movement includes only actual Cash/Bank/MFS voucher lines that carry the project tag on the same line.
10. **Legal ownership transfer is not claimed.** Phase 2M stores booking/control information only and does not implement deed, registration, handover, securities, or legal ownership behavior.

## What Is Deferred

These items are explicitly deferred and must not be implemented in Phase 2M:

- **Client portal / customer login** -- no public-facing customer access
- **SMS / Email / WhatsApp notifications** -- no automated customer communication
- **Sales lead CRM** -- no lead tracking, pipeline, or conversion metrics
- **Marketing pipeline** -- no campaign or marketing module
- **Agent commission** -- no broker/agent commission calculation
- **Legal deed / registration workflow** -- no legal document management
- **Handover workflow** -- no possession/handover tracking
- **Cancellation / refund accounting automation** -- cancellation and refund are manual processes; automated refund voucher generation is deferred
- **Ownership transfer** -- no title/ownership transfer workflow
- **Multi-role approval workflow** -- no maker-checker for bookings or collections
- **Public payment gateway** -- no online payment integration
- **Mobile app** -- no mobile application
- **PDF / Excel export** -- browser print only; no file export
- **Dashboard analytics** -- no charts, KPIs, or graphical dashboards for customer/booking data
- **Aging analysis** -- no 30/60/90 day receivable aging buckets
- **Advanced aging analytics** -- no detailed aging dashboards beyond simple overdue amount/count and next installment date
- **Revenue recognition** -- no automatic revenue recognition journal entries
- **Automated installment reminders** -- no automated due date alerts or reminders

## Non-Goals

Phase 2M must not:

- Replace the voucher engine
- Create report values from customer tables directly when accounting posting is required
- Infer accounting entries without voucher approval/posting
- Implement full real-estate inventory ERP in this phase
- Implement revenue recognition policy without business approval
- Claim GL receivable recognition without an approved control-account policy and voucher-account design
- Claim legal ownership transfer, deed completion, registration, securities ownership, or investment-share behavior
- Create a CRM or sales automation system
- Build a public-facing customer portal
- Change the existing role model (only `ACCOUNTANT` role is confirmed)

## AGM Questions This Phase Must Answer

Q: **If a customer books a plot, where is it recorded?**
A: In the Customer Booking module. The accountant creates a customer record, then creates a booking linking the customer, the project, and the bookable item (plot). The booking records the agreed price, down payment, and payment schedule.

Q: **How do we see how much the customer paid?**
A: On the Customer Statement or Customer Transaction History page. Every payment is linked to a posted receipt voucher. The total collected amount is derived from posted voucher lines.

Q: **How do we see how much is due?**
A: On the Customer Statement, Booking-wise Receivable Report, or Customer-wise Due Report. The due amount is the net booking value minus total collected from posted receipt vouchers.

Q: **Can we see customer payment history?**
A: Yes. The Customer Transaction History shows every booking, receipt, and linked voucher in chronological order with a running balance.

Q: **Is every payment connected to a voucher?**
A: Yes. Every collection must be linked to a receipt voucher. The voucher is the accounting source of truth. DRAFT collections do not affect reports.

Q: **Can we print a customer statement?**
A: Yes. The Customer Statement page renders a printable statement with customer info, booking info, date-wise transactions, voucher references, and a summary of total price, total paid, and due amount. Browser print is supported.

Q: **Can we see project-wise collection?**
A: Yes. The Project-wise Collection Report shows total collections received per project, grouped by customer or booking.

Q: **Can the customer login later?**
A: Not in Phase 2M. Client portal / customer login is explicitly deferred. The customer statement can be printed and shared physically or via email manually.

Q: **Is client portal included now?**
A: No. Client portal is deferred until internal accounting/customer-booking workflow is stable and AGM confirms the final business wording.

## Beginner-Friendly Business Flow

```
Customer comes to book a plot
  → Accountant creates customer record (if new)
  → Accountant creates bookable item (if not already defined)
  → Accountant creates booking: links customer + project + item, enters agreed price, down payment, payment schedule
  → Customer pays booking money / down payment
  → Accountant records collection: either creates a new receipt voucher from the booking, or links an existing receipt voucher
  → Accountant posts the receipt voucher
  → Posted voucher updates accounting reports (Cash Book, Bank Book, MFS Book, Ledger, Trial Balance)
  → Customer statement shows paid amount and due amount
  → Reports show project-wise collection and receivable
  → Customer makes subsequent installment payments
  → Accountant records each collection with a receipt voucher
  → Customer due balance decreases with each posted receipt
  → When fully paid, derived financial status becomes FULLY_PAID while administrative status remains ACTIVE unless separately changed
```

## Open Decisions for AGM / Accounts

The following decisions require AGM/accounts confirmation before or during Phase 2M implementation. These are documented here so they are not forgotten, and so the implementation team knows which questions to ask.

1. **Booking item types and exact naming** -- Are the proposed categories (LAND, PLOT, FLAT, UNIT, SHARE, OTHER) correct? Should any be added, removed, or renamed? What does Real Capita call these in day-to-day business?

2. **Whether "share" means land share, company share, project share, or investment unit** -- The term "share" is ambiguous. Does Real Capita sell shares in land/projects? Are these ownership shares, investment shares, or something else?

3. **Accounting treatment of booking money** -- When a customer pays booking money, should the receipt voucher credit a "Customer Advance" liability account, or should it directly settle a "Customer Receivable" asset account? This determines the chart of accounts setup.

4. **Revenue recognition timing** -- At what point is revenue from a land/plot/flat/unit sale recognized? On booking? On full payment? On handover/registration? This affects when income entries are posted.

5. **Cancellation / refund policy** -- What is the refund policy when a customer cancels? Is there a deduction/penalty? How is the refund processed (full reversal, partial refund with deduction as income)?

6. **Transfer / handover policy** -- What is the process when a booking is transferred to another customer? What is the process for handover/possession?

7. **Discount approval policy** -- Who can approve discounts on the agreed price? Is there a maximum discount percentage? Is discount tracked separately?

8. **Receipt numbering format** -- Should receipt vouchers use the same voucher numbering sequence as other vouchers (`PAYMENT-00001`, `RECEIPT-00001`), or should customer receipts have a separate numbering scheme?

9. **Customer statement format** -- What columns and layout should the customer statement use? Should it follow the ledger statement format (date, particular, voucher ref, debit, credit, balance)?

10. **Whether customer portal should show only posted/confirmed receipts** -- When a customer portal is eventually built, should customers see DRAFT receipts or only POSTED receipts? (This decision is recorded now to guide the data model, even though portal is deferred.)

11. **Installment plan structure** -- Should installments be fixed-date (e.g., "15th of every month"), fixed-interval (e.g., "every 30 days"), or custom (arbitrary dates and amounts per installment)?

12. **Customer identification** -- Is NID/passport the primary identity document? Should the system support multiple ID types? Is there a business requirement for ID verification?

## Acceptance Summary

Phase 2M is successful when:

- Internal users (Accountant role) can record customers and bookings
- Bookings connect to projects and bookable items
- Collections link to receipt vouchers (create new or link existing)
- Customer payment history is visible and derived from posted vouchers
- Customer due balance is visible and computed correctly
- Project-wise collection and receivable reports are visible
- Customer statement is printable via browser print
- No client portal exists
- No revenue recognition automation exists
- Accounting-first invariants are preserved (posted vouchers are source of truth, DRAFT does not affect reports, voucher posting is the only path to accounting reports)
- Existing reports (Ledger, Trial Balance, Cash Book, Bank Book, MFS Book, Income Statement, Balance Sheet, Project Ledger, Project Cost, Cost Center Summary, Project Financial Summary, Project Fund Movement) continue to work correctly
- Phase 2L reversal workflow continues to work correctly
- No schema changes to existing voucher, ledger, or report models that would break existing functionality
