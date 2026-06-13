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

export type AuthenticatedRequest = Request & {
  authSession: {
    id: string;
    tokenId: string;
    expiresAt: Date;
  };
  cookies?: Record<string, string | undefined>;
  user: AuthenticatedUser;
};

export type RequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
};
