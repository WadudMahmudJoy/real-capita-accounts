import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_METADATA_KEY, type RoleCode } from "../auth.constants";
import type { AuthenticatedRequest } from "../auth.types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<RoleCode[]>(ROLES_METADATA_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userRoles = new Set<RoleCode>(
      request.user.roles.map((role) => role.code),
    );
    const hasRequiredRole = requiredRoles.some((role) => userRoles.has(role));

    if (!hasRequiredRole) {
      throw new ForbiddenException("You do not have access to this resource.");
    }

    return true;
  }
}
