# Phase 0 Architecture

## Monorepo Structure

```text
real-capita-accounts/
  apps/
    web/
    api/
  packages/
    shared/
    ui/
    config/
  prisma/
    schema.prisma
    migrations/
    seed/
  docs/
    requirements/
    architecture/
  scripts/
```

## Frontend Responsibility

`apps/web` is the Next.js App Router frontend. In Phase 0 it only provides the placeholder page and UI foundation. It does not contain authentication, navigation, dashboards, accounting screens, or business workflows.

## Backend Responsibility

`apps/api` is the NestJS API. In Phase 0 it only exposes `GET /health`.

## Shared Packages Responsibility

`packages/shared` exports project constants only. Zod is installed there for future shared validation, but no validation schemas or business logic are defined yet.

`packages/ui` is a minimal placeholder for future shared UI structure.

`packages/config` exports minimal environment defaults only. It does not include role matrices, navigation matrices, permissions, or business configuration.

## Database Responsibility

PostgreSQL 17 is configured through Docker Compose. Prisma is configured with a PostgreSQL datasource and generated client output. No business-domain schema models are included in Phase 0.

## Intentionally Deferred

- Authentication and authorization
- Role-based access control
- Voucher workflow
- Journal, ledger, cash book, bank book, trial balance, and financial statements
- Dashboard and navigation matrix
- Parties, projects, payroll, reports, and full ERP modules
- Seed data and migrations for business entities
