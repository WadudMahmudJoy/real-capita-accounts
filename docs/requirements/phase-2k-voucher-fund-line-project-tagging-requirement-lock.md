# Phase 2K: Voucher Fund-Line Project Tagging Requirement Lock

## Purpose

Phase 2K locks requirements for **Voucher Fund-Line Project Tagging**. 

In Phase 2J, the **Project Fund Movement View** was built using Option A (strict same-line only logic). This means that a fund movement (Cash, Bank, or MFS) is visible in the Project Fund Movement View only if the fund line itself in the voucher is explicitly tagged with `projectId`. 

Currently, when accountants create vouchers, the frontend hides Project and Cost Center selectors on Cash/Bank/MFS lines. As a result, accountants cannot tag fund lines, causing the Project Fund Movement View to show empty rows for transactions (such as the base demo `PAYMENT-00001` which has the project tagged on the expense line but not the cash line). 

Phase 2K enables accountants to explicitly and optionally tag Cash/Bank/MFS lines with a project and cost center during voucher creation, so these movements can be reflected in the Project Fund Movement View.

## Current Status

**Requirement lock only. Not implemented.** No backend API modifications, frontend form updates, or demo data changes have been made for Phase 2K.

## Locked Accounting & Business Rules

1. **Explicit Tagging Only**: The project and cost center must be manually and explicitly selected by the accountant on the Cash/Bank/MFS line. 
2. **No Automatic Inference**: The system must not automatically copy the project or cost center from sibling lines (e.g. expense lines) to the fund line.
3. **No Silent Allocation**: The system must not attempt to automatically allocate fund lines in multi-project vouchers. If a payment relates to multiple projects, the accountant must manually split the fund lines (or create separate vouchers) to tag them individually.
4. **Strict Same-Line Rule Maintained**: The Project Fund Movement View continues to read strictly from posted `VoucherLine` records where `isCashBank = true` and `projectId` is present. No change to the report's underlying query logic.

## Scope for Phase 2K

### In-Scope

#### 1. Frontend Voucher Form UX Enhancement
* **Dynamic Field Visibility**: When the selected ledger account on a voucher line is Cash, Bank, or MFS (i.e. `isCashBank = true`):
  * Render optional "Project" and "Cost Center" selectors on that line.
  * The fields must be optional (not required), with a visual hint/text saying `"Optional for this ledger."`
* **Voucher Type Scope**: Apply to `PAYMENT`, `RECEIPT`, and `CONTRA` vouchers.
* **Helper Guidance**: Update the line's guidance/helper text to explain that tagging the fund line makes it visible in the Project Fund Movement report. For example:
  * *"Cash/Bank/MFS account is required. Project and cost center are optional for fund-line tagging (enables fund visibility in Project Fund Movement report)."*
* **Dynamic Cost Center Scoping**: Ensure the cost center dropdown on Cash/Bank/MFS lines is correctly scoped to the line's selected project, maintaining the standard behavior.

#### 2. Backend Validation Review & Audit
* **Audit Exist Validation**: Confirm if the backend currently accepts `projectId` and `costCenterId` on lines where `cashBankAccountId` is present. 
* **Validation Adjustments**: If the backend validation blocks `projectId` on cash/bank ledger accounts, adjust the validation logic in `voucher.service.ts` to allow it, while keeping all other rules intact (e.g., cost center must belong to the project if both are present).
* **JOURNAL Voucher Boundary**: Maintain the rule that MFS cash/bank accounts are completely blocked on `JOURNAL` vouchers. Do not weaken JOURNAL MFS restrictions.

### Out-of-Scope
* **No Database Schema Changes / Migrations**: The `VoucherLine` database model already has optional `projectId` and `costCenterId` fields; no database mutations or schema migrations are allowed.
* **No Auto-Inference / Copying**: No client-side or server-side copying of `projectId` from expense/income lines to Cash/Bank/MFS lines.
* **No Voucher-Level Project Field**: Fields remain line-level only.
* **No Allocation Engine**: No backend or frontend code to divide a single cash line among multiple projects.
* **No Editing Posted Vouchers**: Vouchers remain read-only once posted.
* **No Changes to Base Demo Dataset**: The deterministic demo dataset (`pnpm demo:reset`) remains unchanged. Any project fund movement verification will be done via manual UI testing or temporary smoke testing.

## Demo Dataset Decision

**Decision**: Keep the deterministic base demo dataset unchanged.
Do not add project-tagged cash/bank/MFS lines to the default database seed or reset logic. This ensures that the base demo `SK-001` continues to return empty fund movement rows by default, demonstrating the strict same-line rule. A demo dataset change is out of scope for the core Phase 2K implementation and may only be proposed as a separate optional chunk under user approval.

## Risk Assessment

1. **Accountant Training**: Accountants must understand that if they do not tag the cash/bank/MFS line, the money movement will not appear in the Project Fund Movement View, even if they tag the expense line. Clear helper text in the UI is critical to mitigate this.
2. **Imbalances in Multi-Project Vouchers**: If a PAYMENT voucher has one cash line tagged with Project A, but the expense lines are split between Project A and Project B, the Project Fund Movement View will only show inflow/outflow for Project A. This is correct under Option A, but could confuse users if they expect automatic voucher-level allocation.
3. **Double Counting Prevention**: Reports like Project Ledger and Project Cost only select expense/revenue lines. Project Fund Movement View only selects Cash/Bank/MFS lines. There is zero risk of double counting between these reports because their ledger account scopes are mutually exclusive.
