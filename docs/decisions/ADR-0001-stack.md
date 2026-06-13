# ADR-0001: Application Stack

## Status

Accepted

## Decision

Use Next.js App Router, NestJS, Prisma, PostgreSQL, pnpm workspace, and Docker Compose.

## Context

The system needs a maintainable web frontend, a structured backend API, a typed database layer, and a reproducible local development environment.

## Consequences

- Frontend code lives in `apps/web`.
- Backend code lives in `apps/api`.
- Shared packages can live in `packages/*`.
- PostgreSQL runs through Docker Compose.
- Prisma is the source of truth for application database models.

