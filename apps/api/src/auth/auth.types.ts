import type { Request } from "express";
import type { RoleCode } from "./auth.constants";

export type AuthTokenPayload = {
  sub: string;
  sid: string;
  jti: string;
};

export type AuthenticatedRole = {
  code: RoleCode;
  name: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  fullName: string;
  roles: AuthenticatedRole[];
};

export type ActiveCompanyContext = {
  id: string;
  name: string;
  legalName: string | null;
  isActive: boolean;
  officeLogoPath: string | null;
  brandAccentColor: string | null;
  backgroundMode: "DEFAULT_PREMIUM" | "CUSTOM";
  customBackgroundPath: string | null;
};

export type AuthSessionRequestContext = {
  id: string;
  tokenId: string;
  expiresAt: Date;
  activeCompanyId: string | null;
};

export type AuthenticatedRequest = Request & {
  authSession: AuthSessionRequestContext;
  activeCompany: ActiveCompanyContext | null;
  cookies?: Record<string, string | undefined>;
  user: AuthenticatedUser;
};

export type RequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
};
