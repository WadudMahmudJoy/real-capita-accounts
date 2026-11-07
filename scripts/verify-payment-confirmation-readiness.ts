import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Prisma } from '../apps/api/src/generated/prisma/client';
import { PayrollPaymentConfirmationReadinessService } from '../apps/api/src/payroll/payroll-payment-confirmation-readiness.service';
import { PayrollPaymentEvidenceProvider } from '../apps/api/src/payroll/payroll-payment-evidence.provider';
const money=(n: string)=>new Prisma.Decimal(n);
const user: any={id:'checker',roles:[{code:'ACCOUNTANT'}]};
let passed=0;
async function run(change: (c: any)=>void=()=>{}) {
  const c: any={configured:true,valid:true,actor:{isActive:true,roles:[{role:{code:'ACCOUNTANT'}}]},parent:'parent',source:{isActive:true,accountType:'BANK',ledgerAccount:{isActive:true,isCashBank:true}},
    batch:{id:'batch',companyId:'parent',payrollRunId:'run',sourceAccountId:'source',channel:'BANK',status:'PREPARED',version:1,createdById:'maker',totalAmount:money('60.01'),confirmation:null,cancellationRequests:[],
      sourceAuthorization:{id:'grant',companyId:'parent',sourceAccountId:'source',channel:'BANK'},payrollRun:{companyId:'parent',status:'APPROVED'},
      lines:[{id:'line',employeeId:'employee',payrollRunLineId:'obligation',channel:'BANK',amount:money('60.01'),payrollRunLine:{payrollRunId:'run',employeeId:'employee',bankPay:money('60.01'),cashPay:money('40.00')},reservation:{state:'HELD',lineId:'line',payrollRunLineId:'obligation',channel:'BANK'}}]},expected:1,viewer:user};
  change(c);
  const db: any={user:{findUnique:async()=>c.actor},payrollPaymentBatch:{findUnique:async()=>c.batch},cashBankAccount:{findUnique:async()=>c.source},$queryRaw:async()=>[{valid:c.valid}]};
  db.$transaction=async(fn: any)=>fn(db);
  const parent: any={resolve:async()=>{if(!c.parent)throw Error('Missing PRIMARY');return{id:c.parent};}};
  const preparation: any={prepare:async()=>{if(c.badSnapshot)throw {getStatus:()=>422};return{rows:[{employeeId:'employee',plannedAmount:'60.01'}]};}};
  const provider: any={isConfigured:()=>c.configured,verify:()=>assert.fail('Readiness cannot assert settlement')};
  return new PayrollPaymentConfirmationReadinessService(db,parent,preparation,provider).assess('batch',c.expected,c.viewer);
}
async function main(){
  const ready=await run();assert.equal(ready.status,'READY_FOR_EVIDENCE_VERIFICATION');assert.equal(ready.settlementVerified,false);passed++;
  const cases: [string,(c: any)=>void][]=[
    ['ACCOUNTANT_REQUIRED',c=>c.viewer={id:'checker',roles:[]}],['CONFIRMER_NOT_AUTHORIZED',c=>c.actor=null],['CONFIRMER_NOT_AUTHORIZED',c=>c.actor.isActive=false],
    ['ACTIVE_PRIMARY_UNAVAILABLE',c=>c.parent=null],['BATCH_NOT_FOUND_OR_FOREIGN',c=>c.batch=null],['BATCH_NOT_FOUND_OR_FOREIGN',c=>c.batch.companyId='office'],
    ['MAKER_CHECKER_REQUIRED',c=>c.batch.createdById='checker'],['STALE_BATCH_VERSION',c=>c.expected=2],['BATCH_NOT_PREPARED',c=>c.batch.status='CANCELLED'],
    ['BATCH_NOT_PREPARED',c=>c.batch.status='CONFIRMED'],['CONFIRMATION_ALREADY_EXISTS',c=>c.batch.confirmation={}],['CANCELLATION_PENDING_OR_DECIDED',c=>c.batch.cancellationRequests=[{}]],
    ['TRUSTED_EVIDENCE_VERIFIER_UNAVAILABLE',c=>c.configured=false],['PAYROLL_NOT_APPROVED',c=>c.batch.payrollRun.status='DRAFT'],
    ['RESERVATION_NOT_HELD',c=>c.batch.lines[0].reservation.state='CONSUMED'],['RESERVATION_NOT_HELD',c=>c.batch.lines[0].reservation=null],
    ['FULL_ALLOCATION_MISMATCH',c=>c.batch.lines[0].amount=money('60.00')],['BATCH_TOTAL_MISMATCH',c=>c.batch.totalAmount=money('60.02')],
    ['DUPLICATE_EMPLOYEE',c=>c.batch.lines.push(c.batch.lines[0])],['INVALID_LINE_COVERAGE',c=>c.batch.lines=[]],
    ['SOURCE_AUTHORIZATION_EXPIRED_REVOKED_OR_STALE',c=>c.valid=false],['SOURCE_ACCOUNT_INVALID',c=>c.source.isActive=false],
    ['OBLIGATION_LINK_MISMATCH',c=>c.batch.lines[0].payrollRunLine.employeeId='different'],['SOURCE_AUTHORIZATION_LINK_MISMATCH',c=>c.batch.sourceAuthorization.channel='CASH'],
  ];
  for(const [code,change] of cases){const result=await run(change);assert.equal(result.status,'BLOCKED');assert(result.blockers.some(b=>b.code===code),code);assert.deepEqual(Object.keys(result).sort(),Object.keys(ready).sort());passed++;}
  await assert.rejects(()=>run(c=>c.expected=0));passed++;
  const production=new PayrollPaymentEvidenceProvider();assert.equal(production.isConfigured(),false);assert.equal(await production.verify('free-text',{batchId:'batch',channel:'BANK',sourceAccountId:'source',amount:'60.01',currency:'BDT',beneficiaries:[]}),null);passed++;
  assert(!/Snapshot|accountNumber|employeeId|authorityRecord/.test(JSON.stringify(ready)));passed++;
  console.log(`PASS ${passed} deterministic confirmation-readiness/provider assertions; no database writes or settlement verification`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
