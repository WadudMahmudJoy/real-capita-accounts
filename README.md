# Real Capita Accounting & Project Finance System

Phase 0 technical foundation for a new accounting-first production system for Real Capita Group.

This repository is intentionally not a continuation of the previous Real Capita ERP prototype. Phase 0 establishes the clean technical base only.

## Stack

- Node.js LTS
- pnpm workspace monorepo
- Next.js App Router with TypeScript
- NestJS with TypeScript
- PostgreSQL 17 through Docker Compose
- Prisma ORM
- Tailwind CSS
- shadcn/ui project setup
- Zod installed through the shared package for future validation
- Git and GitHub from the beginning

## Prerequisites

- Node.js LTS, version 22 or newer
- pnpm 11
- Docker Desktop with Docker Compose
- Git

## Setup

```powershell
cd D:\real-capita-accounts
pnpm install
Copy-Item .env.example .env
pnpm prisma:generate
```

## Environment

`.env.example` contains local development defaults only:

```env
DATABASE_URL=postgresql://real_capita:real_capita_password@localhost:55432/real_capita_accounts?schema=public
API_PORT=4000
WEB_PORT=3000
NODE_ENV=development
```

Do not commit `.env` or real secrets.

## Development Commands

```powershell
pnpm dev
pnpm dev:web
pnpm dev:api
```

Frontend default: `http://localhost:3000`

API default: `http://localhost:4000`

Health endpoint:

```powershell
Invoke-RestMethod http://localhost:4000/health
```

## Docker and PostgreSQL

```powershell
docker compose config
docker compose up -d postgres
docker compose logs -f postgres
docker compose down
```

The Compose service uses `postgres:17`, a persistent `postgres_data` volume, and project-specific localhost port `55432` to avoid conflicts with the old ERP database. PostgreSQL still runs inside the container on port `5432`; connect from host tools with `localhost:55432`.

## Verification Commands

```powershell
pnpm install
pnpm prisma:generate
pnpm build:web
pnpm build:api
pnpm typecheck
pnpm lint
docker compose config
docker compose up -d postgres
```

## Strict Phase 0 Boundary

Phase 0 does not include authentication, role-based access, dashboards, vouchers, chart of accounts, parties, projects, payroll, salary sheets, reports, ledgers, cash book, bank book, trial balance, file uploads, ERP modules, fake business screens, or seed business data.

The next planned phase is Phase 1 authentication and role-based access.
