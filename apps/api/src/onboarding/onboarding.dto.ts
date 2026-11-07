import {BadRequestException,ForbiddenException,HttpException,Injectable} from '@nestjs/common';
import {plainToInstance} from 'class-transformer';
import {validateSync} from 'class-validator';
import {AuthorityPayloadDto} from '../authority/authority.dto';

export type CommandInput={command:string;payload:Record<string,unknown>;proof:Record<string,unknown>};
const fields:Record<string,string[]>={
 INVITE:['email','name','reason'],
 VERIFY_IDENTITY:['targetUserId','employeeId','employeeCode','evidenceDigest'],
 AUTHORIZE_INITIAL_MD:['targetUserId','authorizerId','evidenceDigest','expiresAt'],
 AUTHORIZE_MD_RECOVERY:['targetUserId','authorizerId','evidenceDigest','expiresAt'],
 ATTEST_MD:['authorizationId','targetUserId'],ACTIVATE_MD:['attestationId'],
 REQUEST_SPECIALIZED:['targetUserId','permission','reason','expectedVersion','expiresAt'],
 DECIDE_SPECIALIZED:['requestId','decision','reason'],REVOKE_SPECIALIZED:['requestId','reason'],
 SUSPEND:['targetUserId','reason'],CANCEL:['invitationId'],REVOKE_MD:['attestationId'],
 REPLACE_ACCOUNT:['oldUserId','targetUserId','employeeId','employeeCode','evidenceDigest','reason'],
 AUTHORITY_REQUEST:['operation','payload','expectedVersion','idempotencyKey','reason','expiresAt'],
 AUTHORITY_APPROVE:['requestId','expectedVersion','reason'],AUTHORITY_REJECT:['requestId','expectedVersion','reason'],
 AUTHORITY_CANCEL:['requestId','expectedVersion','reason'],AUTHORITY_EXPIRE:['requestId','expectedVersion','reason'],
 LEAVE_HR:['requestId','decision','reason','expectedVersion','idempotencyKey'],LEAVE_MD:['requestId','decision','reason','expectedVersion','idempotencyKey'],
};
function object(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function exact(value:Record<string,unknown>,keys:string[]){if(Object.keys(value).some(k=>!keys.includes(k))||keys.some(k=>!(k in value)))throw new BadRequestException('Invalid onboarding payload.');}
export function validateCommand(value:unknown):CommandInput{
 if(!object(value))throw new BadRequestException('Invalid onboarding command.');
 exact(value,['command','payload','proof']);
 if(typeof value.command!=='string'||!fields[value.command]||!object(value.payload)||!object(value.proof))throw new BadRequestException('Invalid onboarding command or independent proof.');
 exact(value.payload,fields[value.command]);
 for(const [key,v]of Object.entries(value.payload)){
  if(key==='payload'&&value.command==='AUTHORITY_REQUEST'){if(!object(v)||JSON.stringify(v).length>8192)throw new BadRequestException('Invalid bounded authority payload.');continue;}
  if(key==='expectedVersion'){if(!Number.isSafeInteger(v)||Number(v)<(value.command==='AUTHORITY_REQUEST'?0:1))throw new BadRequestException('Current version required.');continue;}
  if(typeof v!=='string'||!v.trim()||v.length>1000)throw new BadRequestException('Invalid onboarding field.');
  if(key==='email'&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)||v.length>254))throw new BadRequestException('Invalid email.');
  if(key==='expiresAt'&&(!Number.isFinite(Date.parse(v))||Date.parse(v)<=Date.now()))throw new BadRequestException('Future expiry required.');
  if(key==='evidenceDigest'&&!/^[a-f0-9]{64}$/.test(v))throw new BadRequestException('Evidence digest required.');
 }
 if(value.command==='REQUEST_SPECIALIZED'&&!['SYSTEM_ADMIN','ACCOUNTANT','HR_ADMIN'].includes(String(value.payload.permission)))throw new BadRequestException('Unsupported specialized permission.');
 if(value.command==='DECIDE_SPECIALIZED'&&!['APPROVE','REJECT'].includes(String(value.payload.decision)))throw new BadRequestException('Invalid decision.');
 if(value.command==='AUTHORITY_REQUEST'&&!['DELEGATE','ROLE_CREATE','ROLE_EDIT','ROLE_ASSIGN','ROLE_REVOKE','DELEGATE_REVOKE'].includes(String(value.payload.operation)))throw new BadRequestException('Invalid authority operation.');
 if(value.command==='AUTHORITY_REQUEST'){
  if(validateSync(plainToInstance(AuthorityPayloadDto,value.payload.payload),{whitelist:true,forbidNonWhitelisted:true}).length)throw new BadRequestException('Invalid authority operation payload.');
  if(String(value.payload.idempotencyKey).length<16)throw new BadRequestException('Bounded idempotency key required.');
 }
 if(value.command.startsWith('LEAVE_')&&String(value.payload.idempotencyKey).length<8)throw new BadRequestException('Bounded idempotency key required.');
 if(value.command==='LEAVE_HR'&&!['RECOMMEND_APPROVAL','RECOMMEND_REJECTION'].includes(String(value.payload.decision)))throw new BadRequestException('Invalid recommendation.');
 if(value.command==='LEAVE_MD'&&!['APPROVED','REJECTED'].includes(String(value.payload.decision)))throw new BadRequestException('Invalid decision.');
 if(JSON.stringify(value.proof).length>8192)throw new BadRequestException('Invalid proof.');
 return value as CommandInput;
}
export function validateClaim(value:unknown):{capability:string;password:string}{
 if(!object(value))throw new BadRequestException('Invalid claim.');exact(value,['capability','password']);
 if(typeof value.capability!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value.capability)||typeof value.password!=='string'||value.password.length<14||Buffer.byteLength(value.password,'utf8')>72)throw new BadRequestException('A valid claim and a password between 14 characters and 72 UTF-8 bytes are required.');
 return value as {capability:string;password:string};
}
export function assertSameOrigin(origin:string|undefined,configured=process.env.APP_ORIGIN??process.env.WEB_ORIGIN){
 try{if(!origin||!configured||new URL(origin).origin!==origin||new URL(configured).origin!==origin)throw new Error();}catch{throw new ForbiddenException('Trusted application origin required.');}
}
@Injectable()
export class OnboardingRateLimit{
 private readonly windows=new Map<string,{until:number;count:number}>();
 consume(key:string){const now=Date.now();for(const [k,v]of this.windows)if(v.until<=now)this.windows.delete(k);let item=this.windows.get(key);if(!item){if(this.windows.size>=10000)throw new HttpException('Onboarding temporarily rate limited.',429);item={until:now+60000,count:0};this.windows.set(key,item);}if(++item.count>5)throw new HttpException('Onboarding temporarily rate limited.',429);}
}
