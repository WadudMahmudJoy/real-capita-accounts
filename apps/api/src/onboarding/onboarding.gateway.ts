import {HttpException,Injectable,ServiceUnavailableException} from '@nestjs/common';
import {readFileSync} from 'node:fs';
import {request} from 'node:https';
import {createSecureContext} from 'node:tls';

// Transport credentials authenticate this API process only. The private broker
// separately verifies independently signed evidence and current database authority.
@Injectable()
export class OnboardingGateway{
 private config(){
  const url=process.env.ONBOARDING_PRIVATE_GATEWAY_URL,cert=process.env.ONBOARDING_PRIVATE_GATEWAY_CERT_FILE,key=process.env.ONBOARDING_PRIVATE_GATEWAY_KEY_FILE,ca=process.env.ONBOARDING_PRIVATE_GATEWAY_CA_FILE;
  if(!url||!cert||!key||!ca)throw new Error();
  const endpoint=new URL(url);
  if(endpoint.protocol!=='https:'||!['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=='/')throw new Error();
  const tls={cert:readFileSync(cert),key:readFileSync(key),ca:readFileSync(ca),rejectUnauthorized:true,minVersion:'TLSv1.3' as const};
  createSecureContext(tls);return {endpoint,tls};
 }
 private async send(path:string,body?:unknown):Promise<Record<string,unknown>>{
  try{
   const {endpoint,tls}=this.config();const payload=body===undefined?undefined:JSON.stringify(body);
   return await new Promise((resolve,reject)=>{
    const req=request(new URL(path,endpoint),{...tls,method:payload?'POST':'GET',headers:{'Content-Type':'application/json',...(payload?{'Content-Length':Buffer.byteLength(payload)}:{})},timeout:10000},response=>{
     let data='';response.setEncoding('utf8');response.on('data',(chunk:string)=>{data+=chunk;if(data.length>65536){response.destroy();reject(new Error());}});
     response.on('end',()=>{try{if(response.statusCode!==200&&response.statusCode!==201){if([400,401,403,409,429].includes(response.statusCode??0)){reject(new HttpException('Onboarding request denied. Verify current authority, evidence and record version.',response.statusCode!));return;}throw new Error();}const result:unknown=JSON.parse(data);if(!result||typeof result!=='object'||Array.isArray(result))throw new Error();resolve(result as Record<string,unknown>);}catch{reject(new Error());}});response.on('error',()=>reject(new Error()));
    });req.on('timeout',()=>req.destroy());req.on('error',()=>reject(new Error()));req.end(payload);
   });
  }catch(error){if(error instanceof HttpException)throw error;throw new ServiceUnavailableException('Trusted onboarding service is unavailable. No authority was granted.');}
 }
 async ready(){try{const r=await this.send('/readiness');return r.ready===true&&r.providerReady===true&&r.executorReady===true;}catch{return false;}}
 async prepare(envelope:Record<string,unknown>){
  if(!await this.ready())throw new ServiceUnavailableException('Independent authenticated evidence collection is unavailable.');
  const result=await this.send('/prepare',envelope);
  try{const url=new URL(String(result.evidenceUrl));if(url.protocol!=='https:'||url.origin!==result.origin||typeof result.nonce!=='string'||!/^[A-Za-z0-9_-]{20,128}$/.test(result.nonce))throw new Error();return {evidenceUrl:url.href,origin:url.origin,nonce:result.nonce};}catch{throw new ServiceUnavailableException('Invalid independent evidence collector configuration.');}
 }
 async execute(envelope:Record<string,unknown>){
  if(!await this.ready())throw new ServiceUnavailableException('Trusted onboarding and delivery configuration required.');
  const result=await this.send('/commands',envelope);
  // Return reviewed mutation identifiers only; private command results can carry
  // internal delivery routing data and must never become a general JSON proxy.
  const safe:Record<string,unknown>={status:'ACCEPTED'};
  for(const key of ['id','requestId','version','authorizationId','attestationId','invitationId','userId'])if(typeof result[key]==='string'||typeof result[key]==='number')safe[key]=result[key];
  return safe;
 }
 async claim(input:{capability:string;password:string}){if(!await this.ready())throw new ServiceUnavailableException('Verified delivery and private claiming service required.');await this.send('/claim',input);return {status:'EMAIL_VERIFIED',message:'Email control verified. The account remains inactive until independent identity verification; business authority requires separate approval.'};}
}
