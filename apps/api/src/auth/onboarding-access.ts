import type {HrPermission,Prisma} from '../generated/prisma/client';

// Migration 20 is intentionally unapplied on salary-dev. Presence probes preserve
// existing migration-18 behavior; errors never fall back to legacy permission.
// Only an actual approval or its later revocation establishes governance. A
// pending/rejected request cannot suspend an otherwise effective legacy grant.
export async function effectiveAccountant(db:Prisma.TransactionClient,userId:string,storedRole:boolean):Promise<boolean>{
 if(!storedRole)return false;
 const installed=await db.$queryRaw<{installed:boolean}[]>`SELECT to_regclass('public.onboarding_authorizations') IS NOT NULL installed`;
 if(!installed[0]?.installed)return true;
 const rows=await db.$queryRaw<{governed:boolean;effective:boolean}[]>`SELECT
 EXISTS(SELECT 1 FROM onboarding_authorizations WHERE "targetUserId"=${userId} AND kind='SPECIALIZED' AND scope='ACCOUNTANT' AND state IN ('APPROVED','REVOKED')) governed,
 EXISTS(SELECT 1 FROM onboarding_authorizations a JOIN users target ON target.id=a."targetUserId" JOIN users reviewer ON reviewer.id=a."reviewerId" JOIN companies c ON c.id=a."companyId"
 WHERE a."targetUserId"=${userId} AND a.kind='SPECIALIZED' AND a.scope='ACCOUNTANT' AND a.state='APPROVED' AND a."revokedAt" IS NULL AND a."expiresAt">clock_timestamp()
 AND target."isActive" AND reviewer."isActive" AND c."isActive" AND c."singletonKey"='PRIMARY'
 AND EXISTS(SELECT 1 FROM authority_mandates m WHERE m."userId"=a."reviewerId" AND m."companyId"=a."companyId" AND m.kind='MD' AND authority_live_mandate(m))
 AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur."roleId" WHERE ur."userId"=target.id AND r.code='ACCOUNTANT')) effective`;
 return rows[0]?.governed===false||rows[0]?.effective===true;
}

export async function specializedPermissionAllowed(db:Prisma.TransactionClient,userId:string,code:HrPermission):Promise<boolean>{
 const installed=await db.$queryRaw<{installed:boolean}[]>`SELECT to_regclass('public.onboarding_authorizations') IS NOT NULL installed`;
 if(!installed[0]?.installed)return true;
 const rows=await db.$queryRaw<{governed:boolean;effective:boolean}[]>`SELECT
 EXISTS(SELECT 1 FROM onboarding_authorizations WHERE "targetUserId"=${userId} AND kind='SPECIALIZED' AND scope=${code} AND state IN ('APPROVED','REVOKED')) governed,
 EXISTS(SELECT 1 FROM onboarding_authorizations a JOIN users target ON target.id=a."targetUserId" JOIN users reviewer ON reviewer.id=a."reviewerId" JOIN companies c ON c.id=a."companyId"
 WHERE a."targetUserId"=${userId} AND a.kind='SPECIALIZED' AND a.scope=${code} AND a.state='APPROVED' AND a."revokedAt" IS NULL AND a."expiresAt">clock_timestamp()
 AND target."isActive" AND reviewer."isActive" AND c."isActive" AND c."singletonKey"='PRIMARY'
 AND EXISTS(SELECT 1 FROM authority_mandates m WHERE m."userId"=a."reviewerId" AND m."companyId"=a."companyId" AND m.kind='MD' AND authority_live_mandate(m))
 AND EXISTS(SELECT 1 FROM user_permissions p WHERE p."userId"=target.id AND p.code::text=${code} AND p."grantedById"=a."reviewerId" AND p."revokedAt" IS NULL AND p."expiresAt">clock_timestamp())) effective`;
 return rows[0]?.governed===false||rows[0]?.effective===true;
}

export async function verifiedOnboardingClaim(db:Prisma.TransactionClient,userId:string):Promise<boolean>{
 const installed=await db.$queryRaw<{installed:boolean}[]>`SELECT to_regclass('public.onboarding_identities') IS NOT NULL AND to_regclass('public.onboarding_invitations') IS NOT NULL installed`;
 if(!installed[0]?.installed)return false;
 const rows=await db.$queryRaw<{verified:boolean}[]>`SELECT EXISTS(
 SELECT 1 FROM onboarding_identities i JOIN users u ON u.id=i."userId" JOIN employee_account_bindings b ON b."userId"=u.id AND b."employeeId"=i."employeeId"
 JOIN employees e ON e.id=i."employeeId" JOIN companies c ON c.id=i."companyId"
 WHERE i."userId"=${userId} AND i."emailVerifiedAt" IS NOT NULL AND i."verifiedAt" IS NOT NULL AND b."unboundAt" IS NULL AND e."isActive" AND NOT e."isDeleted" AND c."singletonKey"='PRIMARY' AND c."isActive"
 AND EXISTS(SELECT 1 FROM onboarding_invitations v WHERE v."userId"=u.id AND v.status='CONSUMED' AND v."consumedAt" IS NOT NULL AND v."cancelledAt" IS NULL AND v.email=u.email)) verified`;
 return rows[0]?.verified===true;
}
