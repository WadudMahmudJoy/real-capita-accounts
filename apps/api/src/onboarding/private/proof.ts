import {createHash,createPublicKey,KeyObject,verify} from 'node:crypto';
import {requiredAssurance} from './assurance';
export function canonicalJson(value:unknown):string {
 if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
 if(typeof value==='object'&&value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJson((value as Record<string,unknown>)[k])).join(',')+'}';
 throw new Error('PROOF_JSON_INVALID');
}
export const payloadHash=(payload:unknown)=>createHash('sha256').update(canonicalJson(payload)).digest('hex');
export interface ProofClaims {actorId:string;sessionId:string;tokenId:string;command:string;payloadHash:string;nonce:string;issuedAt:number;expiresAt:number;assurance:string;issuer:string;audience:string;}
export interface CommandEnvelope {actorId:string;sessionId:string;tokenId:string;command:string;payload:Record<string,unknown>;proof:{claims:ProofClaims;signature:string};}
export interface ProofConfiguration {audience:string;issuers:Record<string,{publicKey:string|KeyObject;commands:Record<string,string[]>}>;}
export class ProofVerifier {
 private readonly issuers:Record<string,{key:KeyObject;commands:Record<string,string[]>}>={};
 constructor(private readonly config:ProofConfiguration,private readonly now:()=>number=Date.now){
  if(!config.audience||!Object.keys(config.issuers).length)throw new Error('PROOF_CONFIGURATION_REQUIRED');
  for(const [id,issuer] of Object.entries(config.issuers)){const key=typeof issuer.publicKey==='string'?createPublicKey(issuer.publicKey):issuer.publicKey;if(key.type!=='public'||key.asymmetricKeyType!=='ed25519'||!Object.keys(issuer.commands).length)throw new Error('PROOF_ISSUER_REJECTED');this.issuers[id]={key,commands:issuer.commands};}
 }
 verify(envelope:CommandEnvelope):ProofClaims {
  const c=envelope.proof?.claims,now=this.now();if(!c||Object.keys(c).sort().join(',')!=='actorId,assurance,audience,command,expiresAt,issuedAt,issuer,nonce,payloadHash,sessionId,tokenId')throw new Error('PROOF_REJECTED');
  const issuer=this.issuers[c.issuer];
  if(!issuer||c.audience!==this.config.audience||!issuer.commands[c.command]?.includes(c.assurance)||c.assurance!==requiredAssurance(c.command)||!Number.isSafeInteger(c.issuedAt)||!Number.isSafeInteger(c.expiresAt)||c.issuedAt>now||c.expiresAt<=now||c.expiresAt<=c.issuedAt||c.expiresAt-c.issuedAt>120000||!/^[a-zA-Z0-9_-]{24,128}$/.test(c.nonce))throw new Error('PROOF_REJECTED');
  for(const key of ['actorId','sessionId','tokenId','command'] as const)if(typeof c[key]!=='string'||!c[key]||c[key]!==envelope[key])throw new Error('PROOF_BINDING_REJECTED');
  if(c.payloadHash!==payloadHash(envelope.payload)||!/^[A-Za-z0-9_-]{86}$/.test(envelope.proof.signature)||!verify(null,Buffer.from(canonicalJson(c)),issuer.key,Buffer.from(envelope.proof.signature,'base64url')))throw new Error('PROOF_SIGNATURE_REJECTED');
  return Object.freeze({...c});
 }
}
