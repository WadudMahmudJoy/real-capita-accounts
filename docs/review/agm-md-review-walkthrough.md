# AGM/MD Review Walkthrough -- Real Capita Accounting & Project Finance System

## 1. Purpose of the Review

This is a controlled, milestone-based walkthrough of the accounting and project finance workflow currently implemented and verified in the Real Capita Accounting & Project Finance System. It is not a speculative demo or a sales pitch. Every screen, report, and workflow shown has been:

- Implemented against locked requirements.
- Verified through automated regression testing.
- Confirmed against a deterministic demo dataset.
- Tagged and accepted at the `phase-2l-complete` milestone.

The purpose is to give AGM, MD, Accounts & Finance, and Project/Operations stakeholders a clear picture of what the system does today, what rules it enforces, and what is intentionally deferred.

---

## 2. Audience

| Role | Interest |
|---|---|
| **Managing Director / AGM** | Overall system capability, accounting integrity, project finance visibility, audit trail, correction safety |
| **Accounts & Finance** | Day-to-day voucher workflow, posting, reports, reversal workflow, book accuracy |
| **Project/Operations stakeholders** | Project cost visibility, project fund movement, cost center tracking |
| **Internal technical reviewer** | Architecture decisions, schema boundaries, deferred items, verification evidence |

---

## 3. Demo Rules

These rules must be followed during the walkthrough to maintain credibility and accuracy:

1. **Use deterministic local demo data only.** The demo dataset is a known, verified baseline. Do not create live/ad-hoc vouchers that could misrepresent system capability.
2. **Do not improvise new workflows.** Show only what is implemented and verified. If a stakeholder asks about a feature not yet built, use the safe answers in Section 11.
3. **Do not show unfinished modules as complete.** Deferred items are listed in Section 12. Do not open or demo those screens.
4. **Keep focus on accounting correctness.** Every screen should tie back to the core principle: posted vouchers are the single source of truth for all reports.
5. **Keep browser tabs and terminal prepared.** Pre-load the login page, the app shell, and 2-3 key report pages before the walkthrough begins.
6. **Run health checks before presentation.** Follow the pre-demo checklist in Section 4.
7. **Keep backup screenshots or CLI proof ready.** If the live app or database has an issue, fall back to `pnpm demo:audit` and `pnpm demo:verify` output or pre-captured screenshots.

---

## 4. Pre-Demo Checklist

Run these commands in the project root before the walkthrough. All must pass.

```powershell
# 1. Confirm repo is clean and synced
git status --short --branch
git log --oneline --decorate --max-count=10

# 2. Confirm expected tag is present
git tag --list "phase-2l*"

# 3. Verify demo dataset integrity (read-only)
pnpm demo:audit

# 4. Verify demo dataset assertions (read-only)
pnpm demo:verify

# 5. Build both apps
pnpm build:web
pnpm build:api
```

**Expected results:**

| Check | Expected |
|---|---|
| `git status --short --branch` | `main` branch, synced with `origin/main` at `95333d5` |
| `git log --oneline --decorate --max-count=10` | HEAD at `95333d5` with `tag: phase-2l-complete` |
| `git tag --list "phase-2l*"` | `phase-2l-complete` present |
| `pnpm demo:audit` | **62 PASS / 0 FAIL** |
| `pnpm demo:verify` | **47 PASS / 0 FAIL** |
| `pnpm build:web` | Build succeeds |
| `pnpm build:api` | Build succeeds |

**Start the dev servers before the walkthrough:**

```powershell
# Terminal 1: API
pnpm dev:api

# Terminal 2: Web app
pnpm dev:web
```

**Demo login credentials (local development only):**

- URL: `http://localhost:3000/login`
- Email: `accountant@realcapita.local`
- Password: `ChangeMe123!`
- Role: Accountant

---

## 5. Suggested 30-45 Minute Walkthrough Agenda

| Time | Segment | What to Cover |
|---|---|---|
| **0-5 min** | System purpose and scope | What the system is, what phase we are at, what is and is not included |
| **5-10 min** | Accounting master data | Chart of Accounts, Cash/Bank/MFS setup, Projects, Cost Centers, Fiscal Year |
| **10-20 min** | Voucher lifecycle | Create draft voucher, validate debit/credit, post voucher, show posted immutability |
| **20-30 min** | Reports | Ledger, Trial Balance, Cash Book, Bank Book, MFS Book, Income Statement, Balance Sheet, Project Ledger, Project Cost, Cost Center Summary, Project Financial Summary, Project Fund Movement |
| **30-38 min** | Reversal workflow | Create reversal from posted voucher, review draft, post reversal, show report netting |
| **38-45 min** | Limitations, next phase, Q&A | What is deferred, what is recommended next, open questions |

---

## 6. Main Business Story to Tell

> Real Capita Group needs a controlled accounting system where posted vouchers become the single source of truth for all financial reports. Every entry in the Ledger, every balance in the Trial Balance, every line in the Cash Book, Bank Book, MFS Book, Income Statement, and Balance Sheet is derived from posted voucher lines only. Draft vouchers do not affect reports.
>
> Project and cost-center tagging on voucher lines allows project-level finance visibility. The Project Ledger shows every project-tagged transaction. The Project Cost Report breaks down project expenses by cost center and account class. The Cost Center Summary groups activity by cost center. The Project Financial Summary gives a high-level financial picture of any project. The Project Fund Movement View tracks cash, bank, and MFS money movement tied to projects using strict same-line tagging.
>
> The reversal workflow protects accounting integrity. Posted vouchers are immutable -- they cannot be edited or deleted. When a mistake is discovered, the accountant creates a reversal voucher that exactly mirrors the original entry with debit and credit sides swapped. Once posted, the reversal nets out the original in all reports. The audit trail is preserved: both the original and the reversal remain in the system permanently.
>
> This milestone proves the accounting core is correct, the reports are consistent, and the correction workflow is safe.

---

## 7. Screen-by-Screen Walkthrough

### 7.1 Login Page

- **Route:** `/login`
- **What to show:** The login form with email and password fields.
- **What to say:** "Access is restricted to authorized users. The system uses secure HttpOnly cookie-based authentication. No tokens are stored in the browser's localStorage. Only the Accountant role is currently configured."
- **Stakeholder may ask:** "Can we add more roles like Admin or Checker?"
- **Safe answer:** "The role model is designed to be extended. Currently only the Accountant role is confirmed. Additional roles like Admin, Checker, or Data Entry can be scoped and implemented in a future phase when Real Capita confirms exact responsibilities."

### 7.2 Dashboard / App Shell

- **Route:** `/app`
- **What to show:** The protected app shell with sidebar navigation. Point out the navigation sections: Vouchers, Accounting Master Data (Chart of Accounts, Cash, Bank & MFS, Projects, Cost Centers, Fiscal Years), and Reports.
- **What to say:** "This is the main application shell. Every page behind this is protected. The sidebar is organized by accounting workflow: first set up master data, then create vouchers, then view reports."
- **Stakeholder may ask:** "Where is the dashboard with charts and KPIs?"
- **Safe answer:** "Dashboard analytics with charts and KPIs are deferred. The current focus is accounting correctness and report accuracy. A dashboard can be built on top of verified report data in a future phase."

### 7.3 Chart of Accounts

- **Route:** `/app/chart-of-accounts`
- **What to show:** The list of ledger accounts with account codes, names, account groups, account classes, and active/inactive status. Show the standard accounting classification: Assets (1xxx), Liabilities (2xxx), Equity (3xxx), Income (4xxx), Expenses (5xxx).
- **What to say:** "The Chart of Accounts follows standard accounting classification. Each account belongs to an account group and an account class. The `isCashBank` flag marks accounts that represent cash, bank, or MFS balances."
- **Stakeholder may ask:** "Can we add more accounts?"
- **Safe answer:** "Yes. The Accountant can create, edit, and deactivate ledger accounts through this interface. All changes are reflected immediately in voucher line dropdowns."

### 7.4 Cash, Bank & MFS Setup

- **Route:** `/app/cash-bank`
- **What to show:** The account list with type labels (CASH, BANK, MFS). For MFS accounts, show the provider (bKash, Nagad, Rocket, etc.), wallet number, and optional account holder name. Demonstrate the create/edit form.
- **What to say:** "This page manages all cash, bank, and MFS accounts. MFS accounts like bKash, Nagad, and Rocket are treated as separate account types alongside traditional Cash and Bank. Each MFS account records its provider and wallet/account identifier."
- **Stakeholder may ask:** "Can MFS transactions be recorded in vouchers?"
- **Safe answer:** "Yes. PAYMENT, RECEIPT, and CONTRA vouchers accept MFS accounts. JOURNAL vouchers do not accept MFS -- MFS money movement is recorded through the proper voucher types."

### 7.5 Voucher List

- **Route:** `/app/vouchers`
- **What to show:** The list of vouchers with system voucher number, date, type, narration, status (DRAFT / POSTED), and reversal badges. Show the status filter and the distinction between draft and posted vouchers.
- **What to say:** "Vouchers are the core transaction records. Each voucher has a type -- PAYMENT, RECEIPT, CONTRA, or JOURNAL. Draft vouchers are editable but do not affect any report. Only posted vouchers feed into the general ledger and all reports."
- **Stakeholder may ask:** "Can we delete a posted voucher?"
- **Safe answer:** "No. Posted vouchers are immutable. They cannot be edited or deleted. If a mistake is made, the correction is done through the reversal workflow, which we will demonstrate shortly."

### 7.6 Voucher Create / Edit Draft

- **Route:** `/app/vouchers/new` or `/app/vouchers/[id]` (draft)
- **What to show:**
  1. Create a new PAYMENT voucher.
  2. Add lines: select ledger accounts, enter debit/credit amounts.
  3. Show dynamic field visibility: when a cash/bank ledger is selected, the Cash/Bank/MFS account field appears. When an expense ledger is selected, Project and Cost Center fields appear.
  4. Show the debit/credit balance indicator.
  5. Save as draft.
- **What to say:** "The voucher form is context-aware. It shows only the fields relevant to the selected ledger account. For cash/bank ledgers, you must select which cash, bank, or MFS account the money moves through. For expense ledgers, you can optionally tag a project and cost center. The system ensures debits equal credits before posting."
- **Stakeholder may ask:** "Can I tag a project on the cash line too?"
- **Safe answer:** "Yes. For PAYMENT, RECEIPT, and CONTRA vouchers, project and cost center are optional on cash, bank, and MFS lines. Tagging the fund line makes it visible in the Project Fund Movement report. This is optional and the accountant decides whether to tag."

### 7.7 Voucher Posting

- **What to show:** Click "Post" on a balanced draft voucher. Show the confirmation. Show the voucher status change to POSTED.
- **What to say:** "Posting validates the voucher against all accounting rules: the debit and credit must balance, the date must be in an open accounting period, all ledger accounts must exist and be active, and voucher-type-specific rules must be satisfied. Once posted, the voucher is locked."
- **Stakeholder may ask:** "What happens if the period is closed?"
- **Safe answer:** "The system rejects posting into a closed or locked accounting period. The voucher must be dated within an open period."

### 7.8 Voucher Detail / Read-Only Posted State

- **Route:** `/app/vouchers/[id]` (posted)
- **What to show:** A posted voucher detail page. Show that all fields are read-only. Show the "Create Reversal" button. Show the print button.
- **What to say:** "Once posted, every field is locked. The voucher is a permanent record. The only action available is to create a reversal if a correction is needed."
- **Stakeholder may ask:** "Can I at least fix a typo in the narration?"
- **Safe answer:** "No. Even the narration is locked after posting. This preserves the complete audit trail. If a correction is needed, you reverse the entire voucher and create a new correct one."

### 7.9 Ledger Statement

- **Route:** `/app/reports/ledger`
- **What to show:** Select a ledger account (e.g., 1010 Cash in Hand), fiscal year, and date range. Show the running balance, opening balance, and transaction lines with drill-down links to vouchers.
- **What to say:** "The Ledger Statement shows every posted transaction for a specific ledger account in chronological order, with a running balance. This is the fundamental accounting record. Every line links back to its source voucher."
- **Stakeholder may ask:** "Does this include draft vouchers?"
- **Safe answer:** "No. Only posted voucher lines appear in the Ledger and all other reports. Draft vouchers are excluded."

### 7.10 Trial Balance

- **Route:** `/app/reports/trial-balance`
- **What to show:** Select fiscal year. Show the trial balance with debit and credit totals for each ledger account, total debits, total credits, and the difference. Confirm the difference is 0.00.
- **What to say:** "The Trial Balance proves the fundamental accounting equation: total debits equal total credits across all posted transactions. A zero difference means the books are in balance."
- **Stakeholder may ask:** "What if the difference is not zero?"
- **Safe answer:** "A non-zero difference would indicate a data integrity issue. The system enforces debit-credit balance at posting time, so an unbalanced trial balance should not occur under normal operation."

### 7.11 Cash Book

- **Route:** `/app/reports/cash-book`
- **What to show:** Select fiscal year. Show the cash book with opening balance, cash transactions, and closing balance. Confirm only CASH-type accounts appear.
- **What to say:** "The Cash Book shows all money movement through cash accounts. It is filtered to CASH-type accounts only. Bank and MFS movements are excluded and appear in their own separate books."
- **Stakeholder may ask:** "Why are bank transactions not here?"
- **Safe answer:** "Cash Book, Bank Book, and MFS Book are kept separate intentionally. This follows standard accounting practice where each type of money account has its own book for clarity and reconciliation."

### 7.12 Bank Book

- **Route:** `/app/reports/bank-book`
- **What to show:** Similar to Cash Book, filtered to BANK-type accounts only.
- **What to say:** "The Bank Book shows all bank account movements. Same structure as Cash Book, but scoped to bank accounts."

### 7.13 MFS Book

- **Route:** `/app/reports/mfs-book`
- **What to show:** MFS Book filtered to MFS-type accounts. Show provider and wallet details in the transaction lines.
- **What to say:** "The MFS Book tracks all mobile financial service transactions -- bKash, Nagad, Rocket, etc. Each line shows the provider and wallet identifier for traceability."
- **Stakeholder may ask:** "Can we reconcile MFS statements here?"
- **Safe answer:** "The MFS Book shows posted MFS voucher transactions. Automated statement import and reconciliation against provider APIs is not yet implemented. It is a future enhancement."

### 7.14 Income Statement

- **Route:** `/app/reports/income-statement`
- **What to show:** Select fiscal year. Show the income and expense sections with totals, net income, and profit/loss indicator.
- **What to say:** "The Income Statement shows revenue and expenses for the period, derived from posted INCOME and EXPENSE ledger lines. The net income is calculated as total income minus total expenses."
- **Stakeholder may ask:** "Does this include project-level breakdown?"
- **Safe answer:** "This is the organization-wide Income Statement. Project-level income and expense details are available in the Project Ledger and Project Financial Summary."

### 7.15 Balance Sheet

- **Route:** `/app/reports/balance-sheet`
- **What to show:** Select fiscal year. Show Assets, Liabilities, and Equity sections with totals. Point out the Current Period Net Profit/Loss line under Equity. Confirm the Balance Sheet is balanced (difference = 0.00).
- **What to say:** "The Balance Sheet shows the financial position. Assets equal liabilities plus equity. The Current Period Net Profit/Loss is automatically included under Equity, so the Balance Sheet reflects the Income Statement result without manual adjustment."
- **Stakeholder may ask:** "Is retained earnings tracked separately?"
- **Safe answer:** "The Balance Sheet includes current period profit/loss automatically. Multi-period retained earnings tracking is a future enhancement."

### 7.16 Project Ledger

- **Route:** `/app/reports/project-ledger`
- **What to show:** Select a project (e.g., SK-001 Shanti Kutir), fiscal year. Show all project-tagged voucher lines with running balance, drill-down links to source vouchers.
- **What to say:** "The Project Ledger is like a mini general ledger for a single project. Every posted voucher line tagged with this project appears here, regardless of account type. This gives complete project-level transaction visibility."
- **Stakeholder may ask:** "Does this include cash/bank movements?"
- **Safe answer:** "It includes any line tagged with the project, including cash, bank, and MFS lines if they were tagged. The Project Fund Movement View specifically focuses on cash/bank/MFS movement."

### 7.17 Project Cost Report

- **Route:** `/app/reports/project-cost`
- **What to show:** Select project, fiscal year. Show cost breakdown by cost center, account class, account group, and ledger. Highlight the expense-only filter option.
- **What to say:** "The Project Cost Report breaks down all project costs by cost center and account. The expense-only toggle filters to just EXPENSE and ASSET class lines. This report does not double-count cash/bank lines -- it only shows expense and asset ledger lines."
- **Stakeholder may ask:** "What is the difference between Project Expense and Project Asset/Capitalized Cost?"
- **Safe answer:** "Project Expense represents operational costs that are expensed immediately. Project Asset/Capitalized Cost represents costs that are capitalized as project assets. The report separates them so you can see both."

### 7.18 Cost Center Summary

- **Route:** `/app/reports/cost-center-summary`
- **What to show:** Select project, fiscal year. Show summary grouped by cost center with debit, credit, and net amounts. Drill-down to Project Ledger.
- **What to say:** "The Cost Center Summary groups all project activity by cost center. Each line shows the total debit, credit, and net movement for that cost center. Lines without a cost center appear as 'Unassigned' only when they exist."
- **Stakeholder may ask:** "Can we compare cost centers across projects?"
- **Safe answer:** "The Cost Center Summary is scoped to one project at a time. Cross-project cost center comparison is a future enhancement."

### 7.19 Project Financial Summary

- **Route:** `/app/reports/project-financial-summary`
- **What to show:** Select project, fiscal year. Show the three sections: Account Class Breakdown, Cost Center Breakdown, Top Ledger Movement. Point out management totals.
- **What to say:** "The Project Financial Summary is the high-level financial view of a project. It shows the breakdown by account class (Assets, Liabilities, Equity, Income, Expense), by cost center, and the top 10 most active ledger accounts. This is the report most useful for management review."
- **Stakeholder may ask:** "Can this be exported to Excel?"
- **Safe answer:** "PDF and Excel export are not yet implemented. All reports support browser-based printing. Export features are planned for a future phase."

### 7.20 Project Fund Movement View

- **Route:** `/app/reports/project-fund-movement`
- **What to show:** Select project, fiscal year. Show the fund movement lines with inflow (debit), outflow (credit), and running balance. Show the account type filter (CASH, BANK, MFS, ALL). Point out the warning notice about same-line tracking.
- **What to say:** "The Project Fund Movement View tracks cash, bank, and MFS money movement for a project using strict same-line tracking. A fund movement appears here only if the cash, bank, or MFS voucher line itself was explicitly tagged with the project. This is intentional -- we do not infer project movement from expense lines. This prevents hidden allocation errors."
- **Stakeholder may ask:** "Why is this project showing empty fund movement?"
- **Safe answer:** "If the project's vouchers tagged the expense line but not the cash/bank line, the fund movement will be empty. This is correct under Option A. The accountant must explicitly tag the fund line during voucher creation to see it here. This is explained in the on-screen notice."

### 7.21 Voucher Reversal -- Create

- **Route:** `/app/vouchers/[id]` (posted voucher detail)
- **What to show:**
  1. Open a posted voucher detail page.
  2. Click "Create Reversal".
  3. Show the modal asking for a reversal reason (minimum 10 characters).
  4. Enter a reason and submit.
  5. Show the generated draft reversal voucher with swapped debit/credit sides.
  6. Show the banner linking back to the original voucher.
- **What to say:** "Reversal is the safe way to correct a posted voucher. The system generates a draft reversal that exactly mirrors the original: every debit becomes a credit, every credit becomes a debit. All ledger accounts, amounts, projects, and cost centers are preserved. The accountant reviews the draft, and if it looks correct, posts it."
- **Stakeholder may ask:** "Can I change the reversal lines before posting?"
- **Safe answer:** "The reversal draft can be reviewed, but the system enforces exact line-level equivalence at posting time. You cannot change amounts, accounts, projects, or cost centers on reversal lines. The reversal must exactly mirror the original to maintain accounting integrity."

### 7.22 Voucher Reversal -- Post and Verify

- **What to show:**
  1. Post the reversal draft.
  2. Go back to the original voucher detail -- show the "Reversed by" badge.
  3. Go to the Ledger -- show both the original and reversal entries, netting to zero.
  4. Go to the Trial Balance -- confirm still balanced.
  5. Go to any relevant project report -- confirm the net effect is zero.
- **What to say:** "Once the reversal is posted, the original voucher shows a 'Reversed by' badge with the reversal voucher number and reason. Both entries remain in the system permanently. In every report, the original and reversal net to zero. The audit trail is complete and the books remain balanced."
- **Stakeholder may ask:** "What if I need to reverse only part of a voucher?"
- **Safe answer:** "Partial reversal, also called rectification, is not yet implemented. Currently, you reverse the entire voucher and create a new correct one. Rectification is deferred to a future phase."

---

## 8. Voucher Flow Script

Use this spoken script when walking through the voucher lifecycle. Speak in plain business language.

---

**Step 1: Create a draft voucher**

> "Let me record a payment. I'll create a new PAYMENT voucher. I select today's date. The first line is the expense -- I choose 'Land Development Expense' from the ledger dropdown, enter 50,000 taka as debit. Because this is an expense ledger, the system shows me optional Project and Cost Center fields. I'll tag it to Shanti Kutir project, SK-LD cost center. The second line is the cash outflow -- I choose 'Cash in Hand' from the ledger dropdown, enter 50,000 taka as credit. Because this is a cash ledger, the system shows me the Cash/Bank/MFS account selector. I choose 'Office Cash'. I can also optionally tag this cash line with the project for fund movement visibility. The debit and credit totals both show 50,000 -- the voucher is balanced. I save it as draft."

**Step 2: Post the voucher**

> "I review the draft. Everything looks correct. I click Post. The system validates that the debit and credit balance, the date is in an open accounting period, and all accounts are active. The voucher is now posted. Notice that all fields are now locked -- I cannot edit anything. This voucher is a permanent record."

**Step 3: Show the report effect**

> "Let me check the Ledger for 'Cash in Hand'. The 50,000 credit appears. The Trial Balance still balances. The Cash Book shows the cash outflow. The Project Ledger shows the 50,000 expense tagged to Shanti Kutir. If I tagged the cash line with the project, the Project Fund Movement View would also show the 50,000 outflow."

**Step 4: Create a reversal**

> "Now suppose I realize I used the wrong expense account. I cannot edit the posted voucher. Instead, I click 'Create Reversal'. The system asks me for a reason -- I'll enter 'Wrong expense account used -- should be Site Development'. The system generates a draft reversal. Notice that the 50,000 debit on Land Development Expense is now a 50,000 credit. The 50,000 credit on Cash in Hand is now a 50,000 debit. Every line is exactly mirrored."

**Step 5: Post the reversal**

> "I review the reversal draft. It matches the original exactly. I post it. Going back to the original voucher, I see a badge: 'Reversed by PAYMENT-00003 on 22 Jun 2026. Reason: Wrong expense account used'. The Trial Balance is still balanced. The Ledger for Cash in Hand shows both the original 50,000 credit and the reversal 50,000 debit -- they net to zero. The original expense is also netted out. The books are clean."

**Step 6: Explain why reversal is safer than editing**

> "This is why we use reversal instead of editing. If I had edited the posted voucher directly, there would be no record of the original mistake. The audit trail would be broken. With reversal, both the original entry and the correction are permanent. Any auditor can see exactly what happened: the original entry, the reason for correction, and the reversal. After reversal, I would create a new correct voucher with the right expense account. The books remain accurate and the audit trail is complete."

---

## 9. Accounting Integrity Talking Points

Use these points when stakeholders ask about system reliability.

| Principle | Explanation |
|---|---|
| **Reports derive from POSTED voucher lines only.** | Draft vouchers do not affect the Ledger, Trial Balance, or any report. Only posted transactions are source of truth. |
| **DRAFT vouchers do not affect reports.** | You can create and edit drafts freely without worrying about report contamination. |
| **Posted vouchers are read-only.** | Once posted, no field can be changed -- not even the narration. Immutability is enforced at the database and API level. |
| **Corrections are done by reversal, not silent editing.** | There is no backdoor to edit posted data. Every correction is a new posted voucher that reverses the original. |
| **Reversal lines must exactly mirror original lines with sides swapped.** | You cannot change amounts, accounts, projects, or cost centers on a reversal. The system enforces exact line-level equivalence at posting. |
| **Trial Balance remains balanced.** | The system enforces debit-credit balance at posting. Reversals preserve balance because they are themselves balanced entries. |
| **Project Fund Movement follows strict same-line Option A.** | A fund movement is project-related only if the cash/bank/MFS line itself is project-tagged. No inference from sibling lines. |
| **No sibling-line project inference.** | The system does not guess or copy project tags between lines. The accountant decides what to tag. |
| **No voucher-level project shortcut.** | Project tagging is per-line, not per-voucher. This supports multi-project vouchers where different lines belong to different projects. |

---

## 10. Evidence / Proof Section

The following evidence is available in the repository to support the claims made in this walkthrough:

| Evidence | Detail |
|---|---|
| **Git tag** | `phase-2l-complete` at commit `95333d5` |
| **demo:audit** | 62 PASS / 0 FAIL -- read-only audit of deterministic demo dataset |
| **demo:verify** | 47 PASS / 0 FAIL -- read-only assertion checks against demo dataset |
| **Phase 2L report regression** | All 12 accounting reports verified: original+reversal pairs net to zero correctly |
| **PAYMENT reversal** | Verified: reversal draft posts, report nets to zero |
| **RECEIPT reversal** | Verified: reversal draft posts, report nets to zero |
| **CONTRA reversal** | Verified: reversal draft posts, report nets to zero |
| **JOURNAL reversal** | Verified: reversal draft posts, report nets to zero |
| **Reversal line equivalence** | Verified: edited reversal drafts (changed amount, account, extra line) are correctly rejected at posting |
| **Reversal-of-reversal** | Verified: correctly rejected (chains not supported) |
| **DB baseline** | Restored to deterministic baseline after all testing |
| **12 reports** | Ledger, Cash Book, Bank Book, MFS Book, Trial Balance, Income Statement, Balance Sheet, Project Ledger, Project Cost, Cost Center Summary, Project Financial Summary, Project Fund Movement |

---

## 11. Safe Answers to Likely Questions

**Q: Can a posted voucher be edited?**
A: No. Posted vouchers are immutable. Neither the accountant nor any administrator can edit a posted voucher. Correction is done through the reversal workflow.

**Q: Why reversal instead of edit?**
A: Audit trail and accounting integrity. Editing a posted voucher would destroy the record of the original transaction. Reversal preserves both the original and the correction permanently, which is essential for audit and compliance.

**Q: Does reversal affect reports?**
A: Yes. Once a reversal is posted, its entries appear in all reports alongside the original. The net effect is zero -- the original and reversal cancel each other out. The Trial Balance remains balanced throughout.

**Q: Can Project Fund Movement infer from expense lines?**
A: No. It uses strict same-line tagging only. The cash/bank/MFS line must be explicitly tagged with the project. This is intentional to prevent hidden allocation errors.

**Q: Is rectification (partial reversal) implemented?**
A: No. Full voucher reversal is complete. Rectification -- adjusting specific lines or amounts without reversing the entire voucher -- is deferred to a future phase.

**Q: Is this system production-ready?**
A: This is a production-intended, review-ready milestone. The accounting core is verified and the reports are consistent. Full deployment, security hardening, operational procedures, backup strategy, and production environment setup should be completed before live production use.

**Q: Can more roles be added?**
A: Yes. The role model is designed to be extended. Currently only the Accountant role is implemented. Additional roles like Admin, Checker, Data Entry, or MD Viewer can be scoped and implemented in a future phase when Real Capita confirms exact responsibilities.

**Q: Can we add approval workflow?**
A: Yes. Multi-level approval (e.g., maker-checker) is a deferred feature that can be scoped separately. The current system allows the Accountant to create and post vouchers directly.

**Q: Can we export reports to Excel or PDF?**
A: Not yet. All reports support browser-based printing. PDF and Excel export are planned for a future phase. For now, the browser print function can save as PDF.

**Q: Does the system handle payroll?**
A: No. Payroll, salary sheets, and employee-related accounting are not implemented. They are outside the current scope.

**Q: Can we import bank statements?**
A: No. Bank statement import and reconciliation are not implemented. They are future enhancements.

**Q: What about dashboard analytics?**
A: Dashboards with charts, KPIs, and graphical analytics are deferred. The current focus is accounting correctness and report accuracy. Dashboards can be built on top of verified report data.

**Q: Is the demo data real?**
A: No. The demo data is a small, deterministic dataset for testing and demonstration only. It uses fictional project names and amounts. Real business data has never been used in development.

---

## 12. What Not to Show

The following features are **not implemented** and should not be presented as complete during the walkthrough:

| Feature | Status |
|---|---|
| Rectification (partial reversal / line-level adjustment) | Deferred |
| Multi-role approval workflow (maker-checker) | Deferred |
| Admin, Checker, Data Entry, MD Viewer, or other roles | Deferred |
| Payroll / salary sheets | Not in scope |
| Parties / customers / vendors | Not in scope |
| File uploads / attachments on vouchers | Not in scope |
| PDF / Excel export | Deferred |
| Dashboard analytics with charts and KPIs | Deferred |
| Bank statement import / reconciliation | Not in scope |
| MFS provider API integration (bKash/Nagad payment gateway) | Not in scope |
| Customer wallet integration | Not in scope |
| Production deployment / security hardening | Deferred |
| Automated backup and restore | Deferred |
| Business seed data beyond the demo dataset | Not in scope |

If a stakeholder asks about any of these, use the safe answers from Section 11. Do not improvise a demo or suggest that these features are "almost done."

---

## 13. If Something Goes Wrong During Review

| Problem | Fallback |
|---|---|
| **API or web app won't start** | Show the `pnpm demo:audit` and `pnpm demo:verify` output as CLI proof. Show the `phase-2l-complete` tag and git log as evidence of the verified state. |
| **Database is in wrong state** | Run `pnpm demo:reset` (with `CONFIRM_DEMO_RESET=YES`) to restore the deterministic baseline. But only do this after confirming there is no important data in the local database. |
| **A page fails to load** | Move to the next page. Record the issue. Do not try to debug or fix during the presentation. |
| **Stakeholder asks for a feature not yet built** | Use the safe answers from Section 11. Do not improvise. Do not promise a delivery date. |
| **Browser or network issue** | Have pre-captured screenshots of the key screens ready as backup. Show the CLI proof (`demo:audit`, `demo:verify`, `git log`) as evidence. |
| **Unexpected data appears** | Explain that the demo dataset is deterministic and small. If the data looks wrong, it may be from a previous manual test. Fall back to CLI proof and screenshots. |

---

## 14. Final Closing Statement

Use this script to close the walkthrough:

> "This milestone proves the accounting core of the Real Capita Accounting & Project Finance System. The system handles the full voucher lifecycle -- from draft creation through posting to immutable record. All 12 reports derive directly from posted voucher lines, ensuring a single source of truth. Project and cost-center tagging provides project-level financial visibility across four dedicated project reports, plus the Project Fund Movement View for cash, bank, and MFS money movement tracking.
>
> The reversal workflow protects accounting integrity. Posted vouchers cannot be edited or deleted. Corrections are made through balanced reversal vouchers that preserve the complete audit trail. The system enforces exact line-level equivalence so that reversals cannot drift from the original entries.
>
> The Trial Balance is balanced. The Income Statement and Balance Sheet are consistent. All books -- Cash, Bank, and MFS -- are separated correctly. All project reports are verified and free of double-counting.
>
> The next recommended phase is review polish, print/export presentation, and controlled stakeholder feedback. Additional features like rectification, approval workflow, dashboard analytics, and expanded roles can be scoped and prioritized based on the feedback from this review.
>
> Thank you for your time. I am happy to answer any questions."

---

## Appendix A: Verification Commands Reference

```powershell
# Full verification suite
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:web
pnpm build:api
docker compose config
pnpm check:all
pnpm doctor

# Demo dataset verification (read-only)
pnpm demo:audit      # Expected: 62 PASS / 0 FAIL
pnpm demo:verify     # Expected: 47 PASS / 0 FAIL

# Safe demo reset (destructive -- only with confirmation)
# $env:CONFIRM_DEMO_RESET = "YES"
# pnpm demo:reset

# Git state verification
git status --short --branch
git log --oneline --decorate --max-count=10
git tag --list "phase-2l*"
git remote -v
```

---

## Appendix B: Implemented Reports Summary

| # | Report | Route | Description |
|---|---|---|---|
| 1 | Ledger Statement | `/app/reports/ledger` | Chronological ledger account transactions with running balance |
| 2 | Cash Book | `/app/reports/cash-book` | Cash account movements (CASH only) |
| 3 | Bank Book | `/app/reports/bank-book` | Bank account movements (BANK only) |
| 4 | MFS Book | `/app/reports/mfs-book` | MFS account movements (MFS only) |
| 5 | Trial Balance | `/app/reports/trial-balance` | Debit/credit totals per account, balanced check |
| 6 | Income Statement | `/app/reports/income-statement` | Income minus expenses = net profit/loss |
| 7 | Balance Sheet | `/app/reports/balance-sheet` | Assets = Liabilities + Equity, includes current P/L |
| 8 | Project Ledger | `/app/reports/project-ledger` | All project-tagged transactions with running balance |
| 9 | Project Cost | `/app/reports/project-cost` | Project costs by cost center, class, group, ledger |
| 10 | Cost Center Summary | `/app/reports/cost-center-summary` | Activity grouped by cost center |
| 11 | Project Financial Summary | `/app/reports/project-financial-summary` | High-level project financial view |
| 12 | Project Fund Movement | `/app/reports/project-fund-movement` | Cash/bank/MFS movement by project (Option A) |

---

## Appendix C: Voucher Types and Rules

| Voucher Type | Purpose | Cash/Bank/MFS Required | MFS Allowed | Project/Cost Center on Fund Lines |
|---|---|---|---|---|
| PAYMENT | Cash/bank/MFS outflow | Yes (credit side) | Yes | Optional (Phase 2K) |
| RECEIPT | Cash/bank/MFS inflow | Yes (debit side) | Yes | Optional (Phase 2K) |
| CONTRA | Transfer between cash/bank/MFS | Yes (both sides) | Yes | Optional (Phase 2K) |
| JOURNAL | Non-cash adjustments | No | No | N/A |

---

*Document generated for the Phase 2L milestone review. Commit `95333d5`, tag `phase-2l-complete`.*
