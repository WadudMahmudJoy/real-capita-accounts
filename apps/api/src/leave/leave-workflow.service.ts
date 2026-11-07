import {ConflictException,ForbiddenException,Injectable,ServiceUnavailableException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {AuthorityWriter} from '../authority/authority-writer';
import {businessAuthority} from '../auth/business-permissions';
import {binding,permission} from '../auth/hr-access';
import {LeaveStageInputDto} from './leave.dto';
@Injectable()
export class LeaveWorkflowService {
 constructor(private readonly db:PrismaService,private readonly writer:AuthorityWriter){}
 async installed(){const rows=await this.db.$queryRaw<{present:string|null}[]>`SELECT to_regclass('public.leave_workflows')::text present`;return Boolean(rows[0]?.present);}
 async requireInstalled(){if(!await this.installed())throw new ServiceUnavailableException('LEAVE_TWO_STAGE_MIGRATION_REQUIRED');}
 async capabilities(actor:string,base:Record<string,unknown>){
  const installed=await this.installed(),authority=await businessAuthority(this.db,actor),subject=await binding(this.db,actor),hr=await permission(this.db,actor,'HR_ADMIN');
  const canRecommend=Boolean(installed&&subject&&hr&&authority.permissions.includes('leave.recommend')&&authority.permissions.includes('leave.review'));
  const canFinalize=installed&&authority.permissions.includes('leave.finalize');
  return {...base,status:installed?base.status:'BLOCKED',workflowInstalled:installed,canReview:canRecommend,canRecommend,canDecide:false,canFinalize,ownLeaveBlocked:canFinalize,canMdReview:installed&&authority.permissions.includes('leave.md.view'),blockers:(base.blockers as string[]).filter(s=>s!=='MD_LEAVE_ROUTING_CONTRACT_REQUIRED').concat(installed?[]:['LEAVE_TWO_STAGE_MIGRATION_REQUIRED'])};
 }
 async command(id:string,stage:'HR'|'MD',input:LeaveStageInputDto,actor:string){
  if(!await this.installed())throw new ServiceUnavailableException('LEAVE_TWO_STAGE_MIGRATION_REQUIRED');
  const access=await businessAuthority(this.db,actor),code=stage==='HR'?'leave.recommend':'leave.finalize';
  if(!access.permissions.includes(code))throw new ForbiddenException('Explicit current '+code+' authority required.');
  return this.writer.execute(actor,stage==='HR'?'LEAVE_HR':'LEAVE_MD',{requestId:id,...input});
 }
 async history(value:unknown){if(!value||typeof value!=='object'||!('history' in value)||!Array.isArray(value.history))throw new ForbiddenException('Explicit leave history permission or own verified request required.');return this.decorate(value);}
 async decorate(value:unknown):Promise<unknown>{
  if(!value||typeof value!=='object')return value;
  const v=value as Record<string,unknown>;
  if(Array.isArray(v.items))return {...v,items:await Promise.all(v.items.map(row=>this.decorate(row)))};
  if(typeof v.id!=='string'||typeof v.employeeId!=='string')return value;
  if(!await this.installed())return {...v,status:v.status==='SUBMITTED'?'LEGACY_PENDING_BLOCKED':v.status,workflowOrigin:'LEGACY',finalDecisionAuthority:v.status==='APPROVED'||v.status==='REJECTED'?'LEGACY_HISTORICAL':null};
  const flow=await this.db.leaveWorkflow.findUnique({where:{requestId:v.id}});
  if(!flow)return {...v,status:v.status==='SUBMITTED'?'LEGACY_PENDING_BLOCKED':v.status,workflowOrigin:'LEGACY',finalDecisionAuthority:v.status==='APPROVED'||v.status==='REJECTED'?'LEGACY_HISTORICAL':null};
  const decisions=await this.db.leaveStageDecision.findMany({where:{requestId:v.id},orderBy:{requestVersion:'asc'},select:{id:true,stage:true,actorId:true,decision:true,reason:true,createdAt:true,requestVersion:true,authoritySnapshot:true}});
  const hr=decisions.find(d=>d.stage==='HR'),md=decisions.find(d=>d.stage==='MD');
  if(flow.version!==v.version||(flow.stage==='PENDING_HR_REVIEW'&&(v.status!=='SUBMITTED'||decisions.length!==0))||(flow.stage==='PENDING_MD_DECISION'&&(v.status!=='SUBMITTED'||!hr||md||decisions.length!==1))||(flow.stage==='FINAL'&&(!hr||!md||md.decision!==v.status||decisions.length!==2))||(flow.stage==='WITHDRAWN'&&(v.status!=='WITHDRAWN'||decisions.length!==0)))throw new ConflictException('Stored leave workflow and stage evidence do not reconcile.');
  const detail=Array.isArray(v.history);
  const safe=(d:typeof decisions[number]|undefined)=>d?{id:detail?d.id:undefined,actorId:detail?d.actorId:undefined,actorName:detail&&typeof d.authoritySnapshot==='object'&&d.authoritySnapshot&&!Array.isArray(d.authoritySnapshot)&&typeof d.authoritySnapshot.actorName==='string'?d.authoritySnapshot.actorName:null,decision:d.decision,reason:detail?d.reason:undefined,createdAt:d.createdAt,requestVersion:detail?d.requestVersion:undefined}:null;
  return {...v,status:flow.stage==='FINAL'?v.status:flow.stage,workflowOrigin:'HR_MD',hrRecommendation:safe(decisions.find(d=>d.stage==='HR')),mdDecision:safe(decisions.find(d=>d.stage==='MD')),finalDecisionAuthority:flow.stage==='FINAL'?'EXPLICIT_MD_FINAL':null};
 }
}
