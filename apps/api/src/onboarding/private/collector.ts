import {request,RequestOptions} from 'node:https';
import {randomBytes} from 'node:crypto';
import {payloadHash} from './proof';
import {requiredAssurance} from './assurance';
/** Human verification belongs to a separately operated, pinned evidence issuer. */
export class IndependentEvidenceCollector {
 private readonly endpoint:URL;
 constructor(endpoint:string,private readonly audience:string,private readonly allowedOrigins:string[],private readonly tls:Pick<RequestOptions,'key'|'cert'|'ca'>){this.endpoint=new URL(endpoint);if(this.endpoint.protocol!=='https:'||this.endpoint.username||this.endpoint.password||!audience||!tls.key||!tls.cert||!tls.ca||!allowedOrigins.length||allowedOrigins.some(origin=>new URL(origin).origin!==origin||new URL(origin).protocol!=='https:'))throw new Error('COLLECTOR_CONFIGURATION_REQUIRED');}
 async prepare(input:{actorId:string;sessionId:string;tokenId:string;command:string;payload:Record<string,unknown>}){
  for(const key of ['actorId','sessionId','tokenId','command'] as const)if(typeof input[key]!=='string'||!input[key])throw new Error('COLLECTOR_BINDING_REQUIRED');
  const nonce=randomBytes(32).toString('base64url');const challenge={actorId:input.actorId,sessionId:input.sessionId,tokenId:input.tokenId,command:input.command,payloadHash:payloadHash(input.payload),payload:input.payload,nonce,audience:this.audience,assurance:requiredAssurance(input.command),issuedAt:Date.now(),expiresAt:Date.now()+120000};
  const response=await new Promise<string>((resolve,reject)=>{const req=request(this.endpoint,{...this.tls,method:'POST',rejectUnauthorized:true,minVersion:'TLSv1.3',timeout:10000,headers:{'Content-Type':'application/json'}},res=>{let body='';res.on('data',(chunk:Buffer)=>{body+=chunk.toString();if(Buffer.byteLength(body)>16384){res.destroy();reject(new Error('COLLECTOR_UNAVAILABLE'));}});res.on('end',()=>res.statusCode===200?resolve(body):reject(new Error('COLLECTOR_UNAVAILABLE')));});req.on('timeout',()=>req.destroy(new Error('COLLECTOR_UNAVAILABLE')));req.on('error',()=>reject(new Error('COLLECTOR_UNAVAILABLE')));req.end(JSON.stringify(challenge));});
  const result=JSON.parse(response) as {evidenceUrl?:unknown};if(typeof result.evidenceUrl!=='string')throw new Error('COLLECTOR_RESPONSE_REJECTED');const url=new URL(result.evidenceUrl);if(!this.allowedOrigins.includes(url.origin)||url.username||url.password||url.hash)throw new Error('COLLECTOR_RESPONSE_REJECTED');return {evidenceUrl:url.href,nonce,origin:url.origin};
 }
}
