# ADR-0004: HttpOnly Cookie JWT Session Auth

## Status

Accepted

## Decision

Use HttpOnly cookie-based JWT/session authentication. Do not store auth tokens in localStorage.

## Context

The frontend and API may run on separate localhost ports. The app needs browser-friendly authentication with backend-enforced session validation and role checks.

## Consequences

- The API sets an HttpOnly cookie named `rcg_auth`.
- Cookies use `SameSite=Lax`.
- Cookies use `Secure` only in production.
- The JWT includes user and session identifiers.
- The backend verifies that the session exists, is not revoked, and has not expired.
- Logout revokes the session and clears the cookie.

