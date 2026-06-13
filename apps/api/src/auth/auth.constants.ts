export const ACCOUNTANT_ROLE = "ACCOUNTANT" as const;
export const AUTH_COOKIE_DEFAULT_NAME = "rcg_auth";
export const ROLES_METADATA_KEY = "roles";

export type RoleCode = typeof ACCOUNTANT_ROLE;

export const roleLabels: Record<RoleCode, string> = {
  ACCOUNTANT: "Accountant",
};
