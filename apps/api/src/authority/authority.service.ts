import {BadRequestException,ForbiddenException,Injectable,ServiceUnavailableException} from '@nestjs/common';
import {binding,permission} from '../auth/hr-access';
import {businessAuthority} from '../auth/business-permissions';
import {effectiveAccountant} from '../auth/onboarding-access';
import {plainToInstance} from 'class-transformer';
import {validateSync} from 'class-validator';
import {Prisma} from '../generated/prisma/client';
import {PrismaService} from '../prisma/prisma.service';
import {AuthorityWriter,MdClaimVerifier} from './authority-writer';
import {AuthorityDecisionDto,AuthorityPayloadDto,AuthorityQueryDto,AuthorityRequestDto} from './authority.dto';
import {PERMISSION_REGISTRY,validatePermissionSelection} from './permission-registry';
@Injectable()
export class AuthorityService {
 constructor(private readonly db:PrismaService,private readonly writer:AuthorityWriter,private readonly verifier:MdClaimVerifier){}
 async access(actor:string){
  const installed=await this.db.$queryRaw<{installed:string|null}[]>`SELECT to_regclass('public.authority_mandates')::text installed`;
  if(!installed[0]?.installed)return {status:'UNAVAILABLE',permissions:[] as string[],registry:PERMISSION_REGISTRY,activated:false,delegationCeiling:[] as string[],reason:'AUTHORITY_MIGRATION_NOT_DEPLOYED'};
  const state=await businessAuthority(this.db,actor);
  const ceilings=await this.db.$queryRaw<{ceiling:string[]}[]>`SELECT ceiling FROM authority_mandates m WHERE m."userId"=${actor} AND authority_live_mandate(m)`;
  const user=await this.db.user.findUnique({where:{id:actor},select:{roles:{select:{role:{select:{code:true}}}}}});
  const accountant=await effectiveAccountant(this.db,actor,user?.roles.some(r=>r.role.code==='ACCOUNTANT')??false);
  const [admin,hr,employee]=await Promise.all([permission(this.db,actor,'SYSTEM_ADMIN'),permission(this.db,actor,'HR_ADMIN'),binding(this.db,actor)]);
  const allowedPermissions=state.permissions.filter(code=>{
   const entry=PERMISSION_REGISTRY.find(p=>p.code===code);
   if(entry?.prerequisite.includes('ACCOUNTANT')&&!accountant)return false;
   if(code.startsWith('users.')&&!admin)return false;
   if(code.startsWith('leave.')&&!hr&&!employee)return false;
   if(['leave.review','leave.categories.manage','leave.recommend'].includes(code)&&!hr)return false;
   return true;
  });
  if(employee)allowedPermissions.push(...['leave.view','leave.create','leave.withdraw','leave.history.view'].filter(p=>!allowedPermissions.includes(p)));
  return {status:'AVAILABLE',...state,allowedPermissions,delegationCeiling:[...new Set(ceilings.flatMap(m=>m.ceiling))],registry:PERMISSION_REGISTRY,reason:'PRIVATE_EXECUTOR_AND_IDENTITY_PROVIDER_REQUIRED_FOR_WRITES'};
 }
 private async require(actor:string,code:string){const access=await this.access(actor);if(access.status==='UNAVAILABLE')throw new ServiceUnavailableException(access.reason);if(!access.permissions.includes(code))throw new ForbiddenException(`Explicit ${code} authority required.`);}
 private async parent(){const p=await this.db.company.findUnique({where:{singletonKey:'PRIMARY'},select:{id:true,isActive:true}});if(!p?.isActive)throw new ForbiddenException('PRIMARY_UNAVAILABLE');return p.id;}
 async roles(q:AuthorityQueryDto,actor:string){await this.require(actor,'roles.view');const company=await this.parent();const where:Prisma.RoleWhereInput={authorityCompanyId:company,...(q.search?{OR:[{name:{contains:q.search,mode:'insensitive'}},{code:{contains:q.search,mode:'insensitive'}}]}:{})};return {items:await this.db.role.findMany({where,select:{id:true,code:true,name:true,description:true,isActive:true,version:true,permissionCodes:true},orderBy:{code:'asc'},skip:(q.page-1)*q.pageSize,take:q.pageSize}),total:await this.db.role.count({where})};}
 async requests(q:AuthorityQueryDto,actor:string){const access=await this.access(actor);if(access.status==='UNAVAILABLE')throw new ServiceUnavailableException(access.reason);const where:Prisma.AuthorityRequestWhereInput={companyId:await this.parent(),...(!access.permissions.includes('authority.review')?{actorId:actor}:{}),...(q.status?{status:q.status}:{})};return {items:await this.db.authorityRequest.findMany({where,select:{id:true,actorId:true,reviewerId:true,operation:true,payload:true,status:true,version:true,expectedVersion:true,reason:true,decisionReason:true,createdAt:true,expiresAt:true,decidedAt:true},orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(q.page-1)*q.pageSize,take:q.pageSize}),total:await this.db.authorityRequest.count({where})};}
 async grants(q:AuthorityQueryDto,actor:string){await this.require(actor,'roles.view');return this.db.authorityRoleGrant.findMany({where:{role:{authorityCompanyId:await this.parent()}},select:{id:true,userId:true,version:true,expiresAt:true,revokedAt:true,role:{select:{id:true,code:true}}},orderBy:{id:'asc'},skip:(q.page-1)*q.pageSize,take:q.pageSize});}
 async history(id:string,q:AuthorityQueryDto,actor:string){await this.require(actor,'roles.view');const companyId=await this.parent();const request=await this.db.authorityRequest.findFirst({where:{companyId,OR:[{id},{payload:{path:['roleId'],equals:id}}]},select:{id:true,actorId:true}});const role=await this.db.role.findFirst({where:{id,authorityCompanyId:companyId},select:{id:true}});if(!role&&(!request||(request.actorId!==actor&&!(await this.access(actor)).permissions.includes('authority.review'))))throw new ForbiddenException('Unknown or private authority record.');return this.db.authorityEvent.findMany({where:{OR:[{entityId:id},{request:{companyId,OR:[{id},{payload:{path:['roleId'],equals:id}}]}}]},select:{id:true,actorId:true,action:true,entityId:true,snapshot:true,createdAt:true},orderBy:{createdAt:'desc'},skip:(q.page-1)*q.pageSize,take:q.pageSize});}
 async request(input:AuthorityRequestDto,actor:string){
  const payload=plainToInstance(AuthorityPayloadDto,input.payload);if(validateSync(payload,{whitelist:true,forbidNonWhitelisted:true}).length)throw new BadRequestException('Invalid operation payload.');
  if(!input.reason.trim())throw new BadRequestException('Reason required.');
  if(input.operation==='DELEGATE'&&(!Array.isArray(payload.permissions)||!payload.permissions.length||new Set(payload.permissions).size!==payload.permissions.length||!payload.expiresAt))throw new BadRequestException('An explicit nonduplicate ceiling and expiry are required.');
  if(input.operation==='ROLE_CREATE'&&(!payload.code||!payload.name?.trim()))throw new BadRequestException('Role code and name required.');
  if(input.operation==='ROLE_EDIT'&&(!payload.roleId||!payload.name?.trim()||typeof payload.isActive!=='boolean'))throw new BadRequestException('Role, name, active state and current version required.');
  if(input.operation==='ROLE_ASSIGN'&&(!payload.roleId||!payload.targetUserId||!payload.expiresAt))throw new BadRequestException('Role, verified recipient and expiry required.');
  if(input.operation==='ROLE_REVOKE'&&!payload.grantId)throw new BadRequestException('Grant required.');
  if(input.operation==='DELEGATE_REVOKE'&&!payload.mandateId)throw new BadRequestException('Mandate required.');
  if(!['DELEGATE','ROLE_CREATE'].includes(input.operation)&&input.expectedVersion<1)throw new BadRequestException('Current entity version required.');
  if(input.operation!=='DELEGATE')await this.require(actor,'roles.manage');
  if(input.operation==='ROLE_CREATE'||input.operation==='ROLE_EDIT'){try{payload.permissions=validatePermissionSelection(payload.permissions??[]);}catch{throw new BadRequestException('Unknown, duplicate or protected permission.');}}
  return this.writer.execute(actor,'REQUEST',JSON.parse(JSON.stringify({...input,payload:{...payload,...(input.operation==='DELEGATE'?{targetUserId:actor}:{})}})) as Record<string,unknown>);
 }
 async decide(id:string,input:AuthorityDecisionDto,actor:string){if(!input.reason.trim())throw new BadRequestException('Decision reason required.');if(['APPROVE','REJECT'].includes(input.command))await this.require(actor,'authority.review');return this.writer.execute(actor,input.command,{requestId:id,expectedVersion:input.expectedVersion,reason:input.reason});}
 async claim(reference:string,actor:string){const proof=await this.verifier.verify(actor,reference);await this.writer.execute(actor,'BOOTSTRAP',proof);return {status:'VERIFIED_CEREMONY_COMPLETED'};}
}
