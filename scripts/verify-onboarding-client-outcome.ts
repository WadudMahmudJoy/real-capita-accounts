import assert from 'node:assert/strict';
import {ApiError} from '../apps/web/src/lib/api';
import {onboardingCommand} from '../apps/web/src/lib/onboarding-api';
async function main(){const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({status:'OUTCOME_UNKNOWN',retryable:false,reconciliationId:'a'.repeat(64),message:'The private operation may have committed. Do not retry automatically.'}),{status:503});};
  await assert.rejects(()=>onboardingCommand('INVITE',{}, {claims:{},signature:'synthetic'}),(error:unknown)=>{assert(error instanceof ApiError);assert.equal((error as ApiError&{isOutcomeUnknown?:boolean}).isOutcomeUnknown,true);return true;});assert.equal(calls,1);
  globalThis.fetch=async()=>{calls++;throw new Error('synthetic connection interruption');};
  await assert.rejects(()=>onboardingCommand('AUTHORITY_REQUEST',{}, {claims:{},signature:'synthetic'}),(error:unknown)=>{assert(error instanceof ApiError);assert.equal((error as ApiError&{isOutcomeUnknown?:boolean}).isOutcomeUnknown,true);assert.match(error.message,/Do not retry/);return true;});assert.equal(calls,2);
  globalThis.fetch=async()=>{calls++;return new Response('upstream response lost',{status:502});};
  await assert.rejects(()=>onboardingCommand('LEAVE_MD',{}, {claims:{},signature:'synthetic'}),(error:unknown)=>{assert(error instanceof ApiError);assert.equal(error.isOutcomeUnknown,true);assert.match(error.message,/Do not retry/);return true;});assert.equal(calls,3);
  console.log('PASS protected client preserves unknown metadata and treats network result as ambiguous without retry');
 }finally{globalThis.fetch=original;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
