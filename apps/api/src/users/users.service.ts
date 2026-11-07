import {payrollPaymentErrorCode} from '../payroll/payroll-payment-error';
import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {hash} from 'bcryptjs';
import {randomBytes} from 'node:crypto';
import {Prisma} from '../generated/prisma/client';
import {PrismaService} from '../prisma/prisma.service';
import {binding,permission,requirePermission,unavailable} from '../auth/hr-access';
import {verifiedOnboardingClaim} from '../auth/onboarding-access';
import {CreateUserDto,PendingUserDto,UserActionDto,UserQueryDto} from './users.dto';
const safe={id:true,email:true,fullName:true,isActive:true,adminVersion:true,roles:{select:{role:{select:{code:true,name:true}}}},hrPermissions:{select:{id:true,code:true,grantedById:true,revokedById:true,reason:true,grantedAt:true,expiresAt:true,revokedAt:true}},employeeBindings:{select:{id:true,employeeId:true,verifiedById:true,verificationReference:true,unboundById:true,verifiedAt:true,unboundAt:true,employee:{select:{employeeCode:true,fullName:true}}}}} as const;
@Injectable()
export class UsersService {
 constructor(private readonly db:PrismaService){}
 async access(id:string){try{return await this.db.$transaction(async tx=>({systemAdmin:Boolean(await permission(tx,id,'SYSTEM_ADMIN')),hrAdmin:Boolean(await permission(tx,id,'HR_ADMIN')),employee:Boolean(await binding(tx,id))}));}catch(e){if(unavailable(e))return {systemAdmin:false,hrAdmin:false,employee:false};throw e;}}
 async list(q:UserQueryDto,actor:string){return this.db.$transaction(async tx=>{await requirePermission(tx,actor,'SYSTEM_ADMIN');const where:Prisma.UserWhereInput={...(q.status?{isActive:q.status==='ACTIVE'}:{}),...(q.search?{OR:[{fullName:{contains:q.search,mode:'insensitive'}},{email:{contains:q.search,mode:'insensitive'}}]}:{})};return {items:await tx.user.findMany({where,select:safe,orderBy:{id:'asc'},skip:(q.page-1)*q.pageSize,take:q.pageSize}),total:await tx.user.count({where}),page:q.page,pageSize:q.pageSize};});}
 async get(id:string,actor:string){return this.db.$transaction(async tx=>{await requirePermission(tx,actor,'SYSTEM_ADMIN');const row=await tx.user.findUnique({where:{id},select:safe});if(!row)throw new NotFoundException();return {...row,onboardingPending:Boolean(await tx.userAdminEvent.findFirst({where:{targetUserId:id,action:'PENDING_CREATED'},select:{id:true}}))&&!await verifiedOnboardingClaim(tx,id),history:await tx.userAdminEvent.findMany({where:{targetUserId:id},orderBy:{createdAt:'desc'},take:100,select:{id:true,actorId:true,action:true,snapshot:true,createdAt:true}})};});}
 async history(id:string,q:UserQueryDto,actor:string){return this.db.$transaction(async tx=>{await requirePermission(tx,actor,'SYSTEM_ADMIN');if(!await tx.user.findUnique({where:{id},select:{id:true}}))throw new NotFoundException();return {items:await tx.userAdminEvent.findMany({where:{targetUserId:id},orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(q.page-1)*q.pageSize,take:q.pageSize,select:{id:true,actorId:true,action:true,snapshot:true,createdAt:true}}),total:await tx.userAdminEvent.count({where:{targetUserId:id}})};});}
 async employees(q:UserQueryDto,actor:string){return this.db.$transaction(async tx=>{if(!await permission(tx,actor,'SYSTEM_ADMIN'))await requirePermission(tx,actor,'HR_ADMIN');return tx.employee.findMany({where:{isActive:true,isDeleted:false,...(q.search?{OR:[{fullName:{contains:q.search,mode:'insensitive'}},{employeeCode:{contains:q.search,mode:'insensitive'}}]}:{})},select:{id:true,employeeCode:true,fullName:true,department:{select:{id:true,name:true}}},take:q.pageSize,skip:(q.page-1)*q.pageSize,orderBy:{employeeCode:'asc'}});});}
 private async legacyElevationOpen(tx:Prisma.TransactionClient){
 const installed=await tx.$queryRaw<{present:string|null}[]>`SELECT to_regclass('public.authority_mandates')::text present`;
 if(installed[0]?.present){const roots=await tx.$queryRaw<{present:boolean}[]>`SELECT EXISTS(SELECT 1 FROM authority_mandates WHERE kind='MD') present`;if(roots[0]?.present)throw new ConflictException('MD_AUTHORITY_ROUTING_REQUIRED: protected legacy account operations remain closed until their MD approval integration is reviewed.');}
 }
 private async atomic<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>){try{return await this.db.$transaction(fn,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}catch(e){if(payrollPaymentErrorCode(e)==='42501')throw new ForbiddenException('MD authority or independent private identity ceremony required.');if(['P2002','P2034','23505','40001','40P01'].includes(payrollPaymentErrorCode(e)))throw new ConflictException('Duplicate or concurrently changed account/binding. Reload.');throw e;}}
 private async locks(tx:Prisma.TransactionClient,ids:string[]){await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id IN (${Prisma.join([...new Set(ids)].sort())}) ORDER BY id FOR UPDATE`);}
 private async audit(tx:Prisma.TransactionClient,actorId:string,targetUserId:string,action:string,before:unknown,after:unknown,reason:string){const snapshot=JSON.parse(JSON.stringify({before,after,reason})) as Prisma.InputJsonValue;await tx.userAdminEvent.create({data:{actorId,targetUserId,action,snapshot}});await tx.auditEvent.create({data:{userId:actorId,entityType:'User',entityId:targetUserId,action:`USER_ADMIN_${action}`,metadata:snapshot}});}
 async create(input:CreateUserDto,actor:string){if(!input.fullName.trim()||!input.reason.trim()||Buffer.byteLength(input.password,'utf8')>72)throw new BadRequestException('Name, reason and a password of at most 72 UTF-8 bytes are required.');await this.db.$transaction(async tx=>{await requirePermission(tx,actor,'SYSTEM_ADMIN');await this.legacyElevationOpen(tx);});const passwordHash=await hash(input.password,12);return this.atomic(async tx=>{await this.locks(tx,[actor]);await tx.$queryRaw`SELECT set_config('real_capita.user_admin_actor',${actor},true)`;await requirePermission(tx,actor,'SYSTEM_ADMIN');await this.legacyElevationOpen(tx);const created=await tx.user.create({data:{email:input.email.trim().toLowerCase(),fullName:input.fullName.trim(),passwordHash},select:safe});await this.audit(tx,actor,created.id,'CREATED',null,created,input.reason);return created;});}
 // No invitation token or password is issued. The discarded random value only
 // satisfies legacy passwordHash storage; it is never delivered or recoverable.
 async createPending(input:PendingUserDto,actor:string){
  if(!input.fullName.trim()||!input.reason.trim())throw new BadRequestException('Name and documented onboarding reason required.');
  await this.db.$transaction(async tx=>{await requirePermission(tx,actor,'SYSTEM_ADMIN');await this.legacyElevationOpen(tx);});
  const passwordHash=await hash(randomBytes(32).toString('base64url'),12);
  return this.atomic(async tx=>{
   await this.locks(tx,[actor]);await tx.$queryRaw`SELECT set_config('real_capita.user_admin_actor',${actor},true)`;
   await requirePermission(tx,actor,'SYSTEM_ADMIN');
   const created=await tx.user.create({data:{email:input.email.trim().toLowerCase(),fullName:input.fullName.trim(),passwordHash,isActive:false},select:safe});
   await this.audit(tx,actor,created.id,'PENDING_CREATED',null,created,input.reason);
   return created;
  });
 }
 async action(id:string,input:UserActionDto,actor:string){if(id===actor)throw new ForbiddenException('Self-administration and self-elevation are not permitted. Use another designated administrator.');if(!input.reason.trim())throw new BadRequestException('Document the reason.');return this.atomic(async tx=>{await this.locks(tx,[actor,id]);await tx.$queryRaw`SELECT set_config('real_capita.user_admin_actor',${actor},true)`;await requirePermission(tx,actor,'SYSTEM_ADMIN');const before=await tx.user.findUnique({where:{id},select:safe});if(!before)throw new NotFoundException();if(before.adminVersion!==input.expectedVersion)throw new ConflictException('Stale account version.');
 if(['ACTIVATE','SET_ACCOUNTANT','GRANT_PERMISSION','BIND'].includes(input.action)&&await tx.userAdminEvent.findFirst({where:{targetUserId:id,action:'PENDING_CREATED'},select:{id:true}})&&!await verifiedOnboardingClaim(tx,id))throw new ForbiddenException('IDENTITY_VERIFICATION_UNAVAILABLE: pending accounts require a verified personal claim and authoritative global Employee binding.');
 if(['ACTIVATE','SET_ACCOUNTANT','GRANT_PERMISSION','BIND'].includes(input.action))await this.legacyElevationOpen(tx);
 const data:Prisma.UserUpdateInput={adminVersion:{increment:1}};
 switch(input.action){
 case 'EDIT':if(!input.fullName?.trim()||!input.email)throw new BadRequestException('Name and email required.');data.fullName=input.fullName.trim();data.email=input.email.trim().toLowerCase();break;
 case 'ACTIVATE':data.isActive=true;break;
 case 'DEACTIVATE':data.isActive=false;break;
 case 'SET_ACCOUNTANT':{const role=await tx.role.findUnique({where:{code:'ACCOUNTANT'},select:{id:true}});if(!role)throw new ConflictException('Existing ACCOUNTANT configuration missing.');await tx.userRole.upsert({where:{userId_roleId:{userId:id,roleId:role.id}},create:{userId:id,roleId:role.id},update:{}});break;}
 case 'REMOVE_ACCOUNTANT':await tx.userRole.deleteMany({where:{userId:id,role:{code:'ACCOUNTANT'}}});break;
 case 'GRANT_PERMISSION':{if(!input.permission)throw new BadRequestException('Select an approved permission.');const expiry=input.expiresAt?new Date(input.expiresAt):null;if(expiry&&expiry<=new Date())throw new BadRequestException('Expiry must be in the future.');await tx.userPermission.create({data:{userId:id,code:input.permission,grantedById:actor,reason:input.reason,expiresAt:expiry}});break;}
 case 'REVOKE_PERMISSION':if(!input.permission)throw new BadRequestException('Select permission.');if((await tx.userPermission.updateMany({where:{userId:id,code:input.permission,revokedAt:null},data:{revokedById:actor,revokedAt:new Date()}})).count!==1)throw new ConflictException('No unreleased authorization.');break;
 case 'BIND':{if(!input.employeeId||!input.verificationReference?.trim())throw new BadRequestException('Employee and documented identity verification required.');if(!await tx.employee.findFirst({where:{id:input.employeeId,isActive:true,isDeleted:false}}))throw new BadRequestException('Active global employee required.');await tx.employeeAccountBinding.updateMany({where:{userId:id,unboundAt:null},data:{unboundById:actor,unboundAt:new Date()}});await tx.employeeAccountBinding.create({data:{userId:id,employeeId:input.employeeId,verifiedById:actor,verificationReference:input.verificationReference.trim()}});break;}
 case 'UNBIND':if((await tx.employeeAccountBinding.updateMany({where:{userId:id,unboundAt:null},data:{unboundById:actor,unboundAt:new Date()}})).count!==1)throw new ConflictException('No active binding.');break;
 default:throw new BadRequestException('Unsupported action.');}
 const after=await tx.user.update({where:{id},data,select:safe});await tx.authSession.updateMany({where:{userId:id,revokedAt:null},data:{revokedAt:new Date()}});await this.audit(tx,actor,id,input.action,before,after,input.reason);return after;
 });}
}
