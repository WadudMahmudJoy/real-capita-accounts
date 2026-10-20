export const ACCOUNTANT_ROLE = "ACCOUNTANT" as const;
export const AUTH_COOKIE_DEFAULT_NAME = "rcg_auth";
export const ROLES_METADATA_KEY = "roles";
// Opt-in for endpoints whose ownership is independent of office selection.
// Authentication/session checks still run, but legacy office initialization
// must not turn these reads into session writes.
export const READ_ONLY_AUTH_CONTEXT_METADATA_KEY = "auth:read-only-context";

export type RoleCode = typeof ACCOUNTANT_ROLE;

export const roleLabels: Record<RoleCode, string> = {
  ACCOUNTANT: "Accountant",
};
