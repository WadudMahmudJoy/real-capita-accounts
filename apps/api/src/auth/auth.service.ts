import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";
import { compare } from "bcryptjs";
import type { CookieOptions, Request } from "express";
import {
  ACCOUNTANT_ROLE,
  AUTH_COOKIE_DEFAULT_NAME,
  roleLabels,
} from "./auth.constants";
import type {
  AuthenticatedUser,
  AuthTokenPayload,
  RequestContext,
} from "./auth.types";
import { PrismaService } from "../prisma/prisma.service";

type UserWithRoles = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  passwordHash: string;
  roles: Array<{
    role: {
      code: string;
      name: string;
    };
  }>;
};

type LoginResult = {
  cookieName: string;
  cookieOptions: CookieOptions;
  token: string;
  user: AuthenticatedUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  getCookieName(): string {
    return process.env.COOKIE_NAME ?? AUTH_COOKIE_DEFAULT_NAME;
  }

  buildClearCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    };
  }

  async login(email: string, password: string, request: Request): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const requestContext = this.getRequestContext(request);
    const user = await this.prisma.user.findUnique({
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      await this.recordLoginFailure(user?.id ?? null, requestContext);
      throw new UnauthorizedException("Invalid email or password.");
    }

    const passwordMatches = await compare(password, user.passwordHash);

    if (!passwordMatches || !this.hasAccountantRole(user)) {
      await this.recordLoginFailure(user.id, requestContext);
      throw new UnauthorizedException("Invalid email or password.");
    }

    const expiresInMs = parseDurationToMs(process.env.JWT_EXPIRES_IN ?? "8h");
    const expiresAt = new Date(Date.now() + expiresInMs);
    const tokenId = randomUUID();

    const session = await this.prisma.authSession.create({
      data: {
        expiresAt,
        tokenId,
        userId: user.id,
      },
    });

    await this.prisma.user.update({
      data: { lastLoginAt: new Date() },
      where: { id: user.id },
    });

    await this.prisma.auditEvent.create({
      data: {
        action: "LOGIN_SUCCESS",
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        userId: user.id,
      },
    });

    const payload: AuthTokenPayload = {
      jti: tokenId,
      sid: session.id,
      sub: user.id,
    };
    const token = await this.jwtService.signAsync(payload, {
      expiresIn: Math.max(1, Math.floor(expiresInMs / 1000)),
      secret: this.getJwtSecret(),
    });

    return {
      cookieName: this.getCookieName(),
      cookieOptions: {
        ...this.buildClearCookieOptions(),
        expires: expiresAt,
        maxAge: expiresInMs,
      },
      token,
      user: this.toAuthenticatedUser(user),
    };
  }

  async logout(
    user: AuthenticatedUser,
    sessionId: string,
    request: Request,
  ): Promise<{ message: string; status: "ok" }> {
    const requestContext = this.getRequestContext(request);

    await this.prisma.authSession.updateMany({
      data: { revokedAt: new Date() },
      where: {
        id: sessionId,
        revokedAt: null,
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        action: "LOGOUT",
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        userId: user.id,
      },
    });

    return {
      message: "Logout successful.",
      status: "ok",
    };
  }

  buildSessionResponse(user: AuthenticatedUser, expiresAt: Date) {
    return {
      expiresAt: expiresAt.toISOString(),
      status: "ok" as const,
      user,
    };
  }

  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new InternalServerErrorException("JWT_SECRET is not configured.");
    }

    return secret;
  }

  private getRequestContext(request: Request): RequestContext {
    return {
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    };
  }

  private async recordLoginFailure(
    userId: string | null,
    context: RequestContext,
  ): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        action: "LOGIN_FAILED",
        ipAddress: context.ipAddress,
        metadata: { reason: "invalid_credentials" },
        userAgent: context.userAgent,
        userId,
      },
    });
  }

  private hasAccountantRole(user: UserWithRoles): boolean {
    return user.roles.some(({ role }) => role.code === ACCOUNTANT_ROLE);
  }

  private toAuthenticatedUser(user: UserWithRoles): AuthenticatedUser {
    return {
      email: user.email,
      fullName: user.fullName,
      id: user.id,
      roles: user.roles
        .filter(({ role }) => role.code === ACCOUNTANT_ROLE)
        .map(() => ({
          code: ACCOUNTANT_ROLE,
          name: roleLabels.ACCOUNTANT,
        })),
    };
  }
}

function parseDurationToMs(value: string): number {
  const match = value.trim().match(/^(\d+)(ms|s|m|h|d)?$/);

  if (!match) {
    return 8 * 60 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? "s";

  switch (unit) {
    case "ms":
      return amount;
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
      return amount * 24 * 60 * 60 * 1000;
    default:
      return 8 * 60 * 60 * 1000;
  }
}
