import "reflect-metadata";
import assert from "node:assert/strict";
import { PayrollPaymentAuthority, PayrollPaymentLifecycleService } from "../apps/api/src/payroll/payroll-payment-lifecycle.service";
import { payrollPaymentErrorCode } from "../apps/api/src/payroll/payroll-payment-error";
async function main() {
  let writes=0;
  const tx: any={ $queryRaw: async()=>[{valid:true}], user:{findUnique:async()=>({isActive:true,roles:[{role:{code:'ACCOUNTANT'}}]})},payrollSourceAction:{findUnique:async()=>{writes++;throw Error('Must not reach persistence');}} };
  const db: any={ $transaction:async(fn: any)=>fn(tx) }, parent: any={resolve:async()=>({id:'primary'})};
  const authority=new PayrollPaymentAuthority(), service=new PayrollPaymentLifecycleService(db,parent,authority);
  const user: any={id:'maker',roles:[{code:'ACCOUNTANT'}]};
  await assert.rejects(()=>service.requestGrant({sourceAccountId:'source',channel:'BANK',idempotencyKey:'request-001'},user),(e: any)=>e.getResponse().code==='FINANCE_DELEGATE_AUTHORITY_UNAVAILABLE');
  await assert.rejects(()=>service.requestRevocation('grant','request-002',user),(e: any)=>e.getStatus()===403);
  await assert.rejects(()=>service.requestCancellation({batchId:'batch',expectedVersion:1,evidenceReference:'I claim not paid',idempotencyKey:'request-003'},user),(e: any)=>e.getStatus()===403);
  await assert.rejects(()=>service.reviewCancellation('request',user),(e: any)=>e.getStatus()===403);
  await assert.rejects(()=>service.reviewSourceAction('action',{...user,roles:[]}),(e: any)=>e.getStatus()===403);
  await assert.rejects(()=>service.requestCancellation({batchId:'batch',expectedVersion:0,evidenceReference:'',idempotencyKey:'request-004'},user),(e: any)=>e.getStatus()===400);
  for (const expiresAt of ['2026-10-14T01:00:00','2026-02-30T00:00:00.000Z']) await assert.rejects(()=>service.requestGrant({sourceAccountId:'source',channel:'BANK',idempotencyKey:'request-time',expiresAt},user),(e: any)=>e.getStatus()===400);
  assert.equal(await authority.nonDisbursement({} as never,'checker',tx),null);assert.equal(writes,0);
  assert.equal(payrollPaymentErrorCode({cause:{originalCode:'23514'}}),'23514');assert.equal(payrollPaymentErrorCode({code:'P2034'}),'P2034');assert.equal(payrollPaymentErrorCode({code:'P2010',meta:{driverAdapterError:{cause:{originalCode:'40001'}}}}),'40001');
  console.log('PASS 10 deterministic lifecycle/adapter checks: no default delegation/evidence authority, no writes, strict inputs and controlled database error extraction');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
