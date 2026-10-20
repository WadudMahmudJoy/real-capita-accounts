import {Injectable,ServiceUnavailableException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {permission} from '../auth/hr-access';
import {verifiedOnboardingClaim} from '../auth/onboarding-access';
import {OnboardingGateway} from './onboarding.gateway';
import {validateCommand} from './onboarding.dto';
import type {AuthenticatedRequest} from '../auth/auth.types';

@Injectable()
export class OnboardingService{
 constructor(private readonly db:PrismaService,private readonly gateway:OnboardingGateway){}
 async status(actor:string){
  const unavailable={installed:false,configured:false,canManage:false,canReview:false,canRequestSpecialized:false,own:{userId:actor,version:0,state:'UNAVAILABLE',emailVerified:false,identityVerified:false,employeeBound:false,mdActivated:false},items:[],requests:[],history:[],blockers:['ONBOARDING_MIGRATION_NOT_DEPLOYED']};
  const installed=await this.db.$queryRaw<{installed:boolean}[]>`SELECT to_regclass('public.onboarding_identities') IS NOT NULL AND to_regclass('public.onboarding_invitations') IS NOT NULL AND to_regclass('public.onboarding_authorizations') IS NOT NULL AND to_regclass('public.onboarding_events') IS NOT NULL installed`;
  if(!installed[0]?.installed)return unavailable;
  const md=await this.db.$queryRaw<{live:boolean}[]>`SELECT EXISTS(SELECT 1 FROM authority_mandates m WHERE m."userId"=${actor} AND m.kind='MD' AND authority_live_mandate(m)) live`;
  const canReview=md[0]?.live===true,canManage=canReview||!!await permission(this.db,actor,'SYSTEM_ADMIN');
  const ownRows=await this.db.$queryRaw<{emailVerified:boolean;identityVerified:boolean;employeeBound:boolean;active:boolean;version:number}[]>`SELECT (i."emailVerifiedAt" IS NOT NULL) "emailVerified",(i."verifiedAt" IS NOT NULL) "identityVerified",(i."employeeId" IS NOT NULL AND EXISTS(SELECT 1 FROM employee_account_bindings b JOIN employees e ON e.id=b."employeeId" WHERE b."userId"=i."userId" AND b."employeeId"=i."employeeId" AND b."unboundAt" IS NULL AND e."isActive" AND NOT e."isDeleted")) "employeeBound",u."isActive" active,u."adminVersion" version FROM onboarding_identities i JOIN users u ON u.id=i."userId" WHERE i."userId"=${actor}`;
  const own=ownRows[0];
  const validOwnClaim=own?await verifiedOnboardingClaim(this.db,actor):false;
  const items=canManage?await this.db.$queryRaw`SELECT i."userId" id,i."userId",u.email,u."fullName",CASE WHEN NOT u."isActive" AND i."verifiedAt" IS NOT NULL THEN 'SUSPENDED' WHEN i."verifiedAt" IS NOT NULL THEN 'VERIFIED' WHEN i."emailVerifiedAt" IS NOT NULL THEN 'EMAIL_VERIFIED' ELSE 'PENDING' END state,(i."emailVerifiedAt" IS NOT NULL) "emailVerified",(i."verifiedAt" IS NOT NULL) "identityVerified",i."employeeId",u."adminVersion" version,(SELECT v.id FROM onboarding_invitations v WHERE v."userId"=i."userId" AND v.status='DELIVERED' ORDER BY v."createdAt" DESC LIMIT 1) "invitationId" FROM onboarding_identities i JOIN users u ON u.id=i."userId" JOIN companies c ON c.id=i."companyId" WHERE c."singletonKey"='PRIMARY' ORDER BY u.email LIMIT 100`:[];
  const requests=await this.db.$queryRaw`SELECT a.id,a."targetUserId",a.scope permission,a.state status,a.reason,a.version FROM onboarding_authorizations a JOIN companies c ON c.id=a."companyId" WHERE c."singletonKey"='PRIMARY' AND a.kind='SPECIALIZED' AND (${canManage} OR a."actorId"=${actor} OR a."targetUserId"=${actor}) ORDER BY a."createdAt" DESC LIMIT 100`;
  const history=canManage?await this.db.$queryRaw`SELECT id,action,"createdAt" FROM onboarding_events ORDER BY "createdAt" DESC LIMIT 100`:await this.db.$queryRaw`SELECT id,action,"createdAt" FROM onboarding_events WHERE "targetUserId"=${actor} ORDER BY "createdAt" DESC LIMIT 50`;
  const configured=await this.gateway.ready();
  return {installed:true,configured,canManage,canReview,canRequestSpecialized:!!(validOwnClaim&&own?.active),own:{userId:actor,version:own?.version??0,state:own?(own.identityVerified&&!own.active?'SUSPENDED':own.identityVerified?'VERIFIED':own.emailVerified?'EMAIL_VERIFIED':'PENDING'):'NOT_INVITED',emailVerified:own?.emailVerified??false,identityVerified:own?.identityVerified??false,employeeBound:own?.employeeBound??false,mdActivated:canReview},items,requests,history,blockers:configured?[]:['TRUSTED_IDENTITY_DELIVERY_AND_PRIVATE_EXECUTOR_REQUIRED']};
 }
 private envelope(request:AuthenticatedRequest,input:unknown){
  if(!request.authSession?.id||!request.authSession.tokenId||!request.user?.id)throw new ServiceUnavailableException('Authenticated session context required.');
  return {actorId:request.user.id,sessionId:request.authSession.id,tokenId:request.authSession.tokenId,...validateCommand(input)};
 }
 execute(request:AuthenticatedRequest,input:unknown){return this.gateway.execute(this.envelope(request,input));}
 prepare(request:AuthenticatedRequest,input:unknown){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['command','payload'].includes(k)))throw new ServiceUnavailableException('Invalid evidence preparation request.');
  const envelope=this.envelope(request,{...input,proof:{}});return this.gateway.prepare(envelope);
 }
}
