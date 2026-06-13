import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ACCOUNTANT_ROLE,
  AUTH_COOKIE_DEFAULT_NAME,
  roleLabels,
} from "../auth.constants";
import type { AuthenticatedRequest, AuthTokenPayload } from "../auth.types";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookieName = process.env.COOKIE_NAME ?? AUTH_COOKIE_DEFAULT_NAME;
    const token = getCookieValue(request, cookieName);

    if (!token) {
      throw new UnauthorizedException("Authentication required.");
    }

    const payload = await this.verifyToken(token);
    const session = await this.prisma.authSession.findUnique({
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
      where: { id: payload.sid },
    });

    if (
      !session ||
      session.tokenId !== payload.jti ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.isActive
    ) {
      throw new UnauthorizedException("Authentication required.");
    }

    const roles = session.user.roles
      .map(({ role }) => role)
      .filter((role) => role.code === ACCOUNTANT_ROLE)
      .map(() => ({
        code: ACCOUNTANT_ROLE,
        name: roleLabels.ACCOUNTANT,
      }));

    request.user = {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      roles,
    };
    request.authSession = {
      id: session.id,
      tokenId: session.tokenId,
      expiresAt: session.expiresAt,
    };

    return true;
  }

  private async verifyToken(token: string): Promise<AuthTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(
        token,
        {
          secret: process.env.JWT_SECRET,
        },
      );

      if (!payload.sub || !payload.sid || !payload.jti) {
        throw new UnauthorizedException("Authentication required.");
      }

      return payload;
    } catch {
      throw new UnauthorizedException("Authentication required.");
    }
  }
}

function getCookieValue(
  request: AuthenticatedRequest,
  cookieName: string,
): string | undefined {
  const cookies: unknown = request.cookies;

  if (!cookies || typeof cookies !== "object") {
    return undefined;
  }

  const value = (cookies as Record<string, unknown>)[cookieName];

  return typeof value === "string" ? value : undefined;
}
