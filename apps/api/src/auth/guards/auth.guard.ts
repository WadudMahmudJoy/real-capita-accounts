import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PATH_METADATA } from '@nestjs/common/constants';
import { enforceBusinessPermission } from '../business-permissions';
import {effectiveAccountant} from '../onboarding-access';
import { JwtService } from "@nestjs/jwt";
import {
  ACCOUNTANT_ROLE,
  AUTH_COOKIE_DEFAULT_NAME,
  READ_ONLY_AUTH_CONTEXT_METADATA_KEY,
  roleLabels,
} from "../auth.constants";
import type {
  ActiveCompanyContext,
  AuthenticatedRequest,
  AuthTokenPayload,
} from "../auth.types";
import { PrismaService } from "../../prisma/prisma.service";

const ACTIVE_COMPANY_SELECT = {
  id: true,
  name: true,
  legalName: true,
  isActive: true,
  officeLogoPath: true,
  brandAccentColor: true,
  backgroundMode: true,
  customBackgroundPath: true,
} as const;

type ActiveCompanyRow = {
  id: string;
  name: string;
  legalName: string | null;
  isActive: boolean;
  officeLogoPath: string | null;
  brandAccentColor: string | null;
  backgroundMode: "DEFAULT_PREMIUM" | "CUSTOM";
  customBackgroundPath: string | null;
};

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
        activeCompany: {
          select: ACTIVE_COMPANY_SELECT,
        },
        user: {
          select: {
            id:true,email:true,fullName:true,isActive:true,
            roles: {
              include: {
                role: {select:{code:true,name:true}},
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

    const accountant=await effectiveAccountant(this.prisma,session.user.id,session.user.roles.some(({role})=>role.code===ACCOUNTANT_ROLE));
    const roles = session.user.roles
      .map(({ role }) => role)
      .filter((role) => role.code === ACCOUNTANT_ROLE&&accountant)
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

    // Multi-office session context. An explicit, non-null selection is always
    // preserved — even when that company is inactive — so the user can reach
    // the future office switch flow instead of being silently moved to
    // another office. Only legacy sessions with a NULL activeCompanyId get a
    // one-time fallback to the oldest active company, persisted to this exact
    // session row.
    let activeCompanyId: string | null = session.activeCompanyId;
    let activeCompany: ActiveCompanyRow | null = session.activeCompany;

    const readOnlyContext: unknown =
      Reflect.getMetadata(READ_ONLY_AUTH_CONTEXT_METADATA_KEY, context.getHandler()) ??
      Reflect.getMetadata(READ_ONLY_AUTH_CONTEXT_METADATA_KEY, context.getClass());

    if (session.activeCompanyId === null && readOnlyContext !== true) {
      const defaultCompany = await this.prisma.company.findFirst({
        orderBy: { createdAt: "asc" },
        select: ACTIVE_COMPANY_SELECT,
        where: { isActive: true },
      });

      if (defaultCompany) {
        await this.prisma.authSession.update({
          data: { activeCompanyId: defaultCompany.id },
          where: { id: session.id },
        });
        activeCompanyId = defaultCompany.id;
        activeCompany = defaultCompany;
      }
    }

    request.authSession = {
      id: session.id,
      tokenId: session.tokenId,
      expiresAt: session.expiresAt,
      activeCompanyId,
    };
    request.activeCompany = activeCompany satisfies ActiveCompanyContext | null;

    const controllerPath: unknown = Reflect.getMetadata(PATH_METADATA, context.getClass()) ?? '';
    const handlerPath: unknown = Reflect.getMetadata(PATH_METADATA, context.getHandler()) ?? '';
    if (typeof controllerPath !== 'string' || typeof handlerPath !== 'string') {
      throw new ForbiddenException('Unsupported authorization route metadata.');
    }
    request.businessPermission = await enforceBusinessPermission(this.prisma, request.user.id,
      controllerPath, handlerPath, request.method ?? 'GET');
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
