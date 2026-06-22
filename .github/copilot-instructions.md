# Copilot Instructions

This repository is the Real Capita Accounting & Project Finance System.

## Stack

- pnpm workspace
- Next.js App Router in `apps/web`
- NestJS API in `apps/api`
- Prisma ORM
- PostgreSQL 17 through Docker Compose
- Local PostgreSQL host port `55432`

## Source Of Truth

Read these files before making non-trivial changes:

- `AGENTS.md`
- `docs/ai/START_HERE.md`
- `docs/ai/CURRENT_STATE.md`
- `docs/ai/WORKFLOW.md`
- `docs/handoff.md`
- `prisma/schema.prisma`

## Current Boundary

The project has implemented the accounting foundation, voucher engine, core accounting reports (Ledger, Cash Book, Bank Book, MFS Book, Trial Balance, Income Statement, Balance Sheet), project financial reporting (Project Ledger, Project Cost Report, Cost Center Summary, Project Financial Summary, Project Fund Movement View), MFS account setup and voucher posting, Phase 2K voucher fund-line project tagging, and Phase 2L voucher reversal workflow. The only confirmed role is ACCOUNTANT, displayed as Accountant.

Do not implement new modules or phases without explicit user confirmation. Deferred items include: rectification (partial corrections), salary/payroll, role expansion beyond ACCOUNTANT, approval workflow, PDF/Excel export, dashboard analytics, parties/customers/vendors, file uploads, MFS provider API/payment gateway/customer wallet integration, and extra business seed data.

## Role Rule

Only one role is confirmed: `ACCOUNTANT`, displayed as `Accountant`.

Do not invent office roles. Do not create Admin, Super Admin, Checker, Data Entry, MD Viewer, HR, Sales, Payroll, or other role enums, seed records, UI labels, or permission matrices until Real Capita confirms them.

## Auth Rule

Backend auth and authorization are authoritative. Use HttpOnly cookie-based JWT/session auth. Do not store tokens in localStorage. Use password hashing and backend guards.

## Data Rule

Never use real passwords, real employee names, salaries, customers, voucher amounts, private documents, or private operational data.

Keep the repo readable and portable for future AI agents and human developers.

