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

Phase 1A includes multi-agent continuity docs, secure login, one Accountant role, one development Accountant user, and a protected app shell.

Do not build accounting business modules yet. Do not implement vouchers, chart of accounts, ledger, cash book, bank book, trial balance, reports, payroll, project finance, parties, customers, vendors, dashboards, file uploads, ERP modules, or business seed data.

## Role Rule

Only one role is confirmed: `ACCOUNTANT`, displayed as `Accountant`.

Do not invent office roles. Do not create Admin, Super Admin, Checker, Data Entry, MD Viewer, HR, Sales, Payroll, or other role enums, seed records, UI labels, or permission matrices until Real Capita confirms them.

## Auth Rule

Backend auth and authorization are authoritative. Use HttpOnly cookie-based JWT/session auth. Do not store tokens in localStorage. Use password hashing and backend guards.

## Data Rule

Never use real passwords, real employee names, salaries, customers, voucher amounts, private documents, or private operational data.

Keep the repo readable and portable for future AI agents and human developers.

