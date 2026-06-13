# ADR-0003: PostgreSQL Host Port Isolation

## Status

Accepted

## Decision

Publish this project's PostgreSQL container on host port `55432`, mapped to container port `5432`.

## Context

The old ERP project may still own `localhost:5432`. Using the same host port can accidentally connect tools or Prisma commands to the old database.

## Consequences

- Local host tools must use `localhost:55432`.
- PostgreSQL still listens on `5432` inside the container.
- `.env.example` must keep `DATABASE_URL` on port `55432`.

