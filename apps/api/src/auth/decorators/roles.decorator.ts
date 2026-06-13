import { SetMetadata } from "@nestjs/common";
import { ROLES_METADATA_KEY, type RoleCode } from "../auth.constants";

export const Roles = (...roles: RoleCode[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);
