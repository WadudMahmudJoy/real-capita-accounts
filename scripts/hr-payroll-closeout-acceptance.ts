// Disposable onboarding harness extension; all business writes are synthetic.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {runOnboardingBrowser} from './onboarding-browser-acceptance';
export async function verifyHrPayrollCloseout(c:any){
 const {owner,app,load,base,exec,envelope,gateway,agm,md,hr,worker,login,role,delivered}=c;
 const hrOnly=process.argv.includes('--hr-attendance-only');
 const approve=async(command:string,payload:any)=>exec(md.session,command,payload);
 const request=await exec(worker.session,'REQUEST_SPECIALIZED',{targetUserId:worker.id,permission:'ACCOUNTANT',reason:'Synthetic independent payroll checker',expectedVersion:(await owner.user.findUniqueOrThrow({where:{id:worker.id}})).adminVersion,expiresAt:new Date(Date.now()+3600000).toISOString()});
 await approve('DECIDE_SPECIALIZED',{requestId:request.requestId,decision:'APPROVE',reason:'Independent synthetic MD approval'});worker.session=await login(worker.id,worker.email,worker.password);
 const authorize=async(person:any,permissions:string[])=>{
  const old=await owner.authorityMandate.findFirst({where:{userId:person.id,kind:'DELEGATE',revokedAt:null}});
  if(old){const revoke=await exec(agm.session,'AUTHORITY_REQUEST',{operation:'DELEGATE_REVOKE',payload:{mandateId:old.id},expectedVersion:old.version,idempotencyKey:randomUUID(),reason:'Explicit synthetic replacement setup',expiresAt:new Date(Date.now()+3600000).toISOString()});await approve('AUTHORITY_APPROVE',{requestId:revoke.id,expectedVersion:1,reason:'Independent MD approves revocation before replacement'});}
  const requested=await exec(person.session,'AUTHORITY_REQUEST',{operation:'DELEGATE',payload:{targetUserId:person.id,permissions,expiresAt:new Date(Date.now()+3600000).toISOString()},expectedVersion:0,idempotencyKey:randomUUID(),reason:'Synthetic independently reviewed responsibility ceiling',expiresAt:new Date(Date.now()+3600000).toISOString()});await approve('AUTHORITY_APPROVE',{requestId:requested.id,expectedVersion:1,reason:'Independent MD approval of bounded responsibility'});
 };
 await authorize(agm,['roles.view','roles.manage','users.view','users.create','users.manage','employees.view','employees.create','employees.edit','departments.view','departments.create','departments.edit','attendance.view','attendance.edit','attendance.approve','attendance.manage','payroll.view','payroll.preview','payroll.create','payroll.approve','payroll.documents.view','accounting.view','projects.view']);
 await authorize(worker,['payroll.view','payroll.approve','payroll.documents.view']);
 const hrRole=await exec(agm.session,'AUTHORITY_REQUEST',{operation:'ROLE_CREATE',payload:{code:'CLOSEOUT_HR',name:'Synthetic HR operational scope',permissions:['employees.view','employees.create','employees.edit','departments.view','attendance.view','attendance.edit','attendance.approve','attendance.manage']},expectedVersion:0,idempotencyKey:randomUUID(),reason:'Approved synthetic HR scope within AGM ceiling',expiresAt:new Date(Date.now()+3600000).toISOString()});
 const hrGrant=await exec(agm.session,'AUTHORITY_REQUEST',{operation:'ROLE_ASSIGN',payload:{roleId:hrRole.role.id,targetUserId:hr.id,expiresAt:new Date(Date.now()+3600000).toISOString()},expectedVersion:1,idempotencyKey:randomUUID(),reason:'Independent MD must approve verified HR assignment',expiresAt:new Date(Date.now()+3600000).toISOString()});await approve('AUTHORITY_APPROVE',{requestId:hrGrant.id,expectedVersion:1,reason:'Independent synthetic HR role approval'});
 const actor={id:agm.id,email:agm.email,fullName:'Synthetic AGM',roles:[{code:'ACCOUNTANT',name:'Accountant'}]};
 const roster=await owner.employee.findMany({where:{isDeleted:false}});
 if(!hrOnly){const salary=app.get(load('salary/salary.service.js').SalaryService);
 const structure=await salary.createStructure({code:'CLOSEOUT',name:'Synthetic closeout structure',effectiveFrom:'2026-01-01',components:[{code:'PART_A',name:'Configured A',percentage:'37.5',displayOrder:1},{code:'PART_B',name:'Configured B',percentage:'62.5',displayOrder:2}]},actor);await salary.approveStructure(structure.id,actor);
 for(const e of roster){const a=await salary.createAssignment(e.id,{salaryStructureId:structure.id,grossSalary:'100.01',effectiveFrom:'2026-01-01'},actor);await salary.approveAssignment(a.id,actor);const p=await salary.createProfile(e.id,{selectedBankPercentage:'60',bankName:'Synthetic Bank',accountName:e.fullName,accountNumber:'SYNTHETIC_ONLY',effectiveFrom:'2026-01-01'},actor);await salary.approveProfile(p.id,actor);}
 }
 const company=await owner.company.findFirstOrThrow({where:{singletonKey:'PRIMARY'}});
 const schedules=app.get(load('work-schedule/work-schedule.service.js').WorkScheduleService);
 await schedules.createAssignment(company.id,{scope:'COMPANY_DEFAULT',effectiveFrom:'2026-09-01',newSchedule:{code:'STANDARD_OFFICE',name:'Standard Office Schedule',days:['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'].map(dayOfWeek=>({dayOfWeek,isWorkingDay:dayOfWeek!=='FRIDAY',startMinuteOfDay:dayOfWeek==='FRIDAY'?null:600,endMinuteOfDay:dayOfWeek==='FRIDAY'?null:1080,unpaidBreakMinutes:dayOfWeek==='FRIDAY'?0:60,crossesMidnight:false}))}},actor);
 await app.get(load('attendance/attendance-policy.service.js').AttendancePolicyService).createInitialPolicy(company.id,{effectiveFrom:'2026-01-01',lateGraceMinutes:5,earlyLeaveGraceMinutes:5},actor);
 const attendance=app.get(load('attendance/attendance-day.service.js').AttendanceDayService),finalization=app.get(load('attendance/attendance-finalization.service.js').AttendanceFinalizationService);
 if(!hrOnly)for(let day=1;day<=30;day++){const businessDate='2026-09-'+String(day).padStart(2,'0');if(new Date(businessDate+'T00:00:00Z').getUTCDay()!==5)await attendance.saveEntries(company.id,{businessDate,entries:roster.map((e:any)=>({employeeId:e.id,checkInLocalTime:'10:00',checkOutLocalTime:'18:00',expectedUpdatedAt:null}))},actor);await finalization.finalizeDay(company.id,{businessDate},actor);}
 // Fresh approved evidence is delivered by a fixture-only popup server. It is not
 // a production identity provider or a substitute for real company verification.
 const receipts=new Map<string,any>();let webOrigin='';
 const evidence=createServer((req,res)=>{const u=new URL(req.url!,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');if(u.pathname==='/claim-link'){const cap=delivered.get(u.searchParams.get('email')!);if(!cap){res.writeHead(404).end();return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({url:webOrigin+'/claim#capability='+cap}));return;}const entry=receipts.get(u.pathname);if(!entry){res.writeHead(404).end();return;}receipts.delete(u.pathname);res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Synthetic independent verification</title><script>opener.postMessage('+JSON.stringify(entry)+','+JSON.stringify(webOrigin)+');close();</script>');});
 await new Promise<void>(resolve=>evidence.listen(0,'127.0.0.1',resolve));const evidenceOrigin='http://127.0.0.1:'+(evidence.address() as {port:number}).port;
 const previousPrepare=gateway.prepare;
 gateway.prepare=async(input:any)=>{const signed=envelope(input,input.command,input.payload),nonce=signed.proof.claims.nonce,path='/evidence/'+randomUUID();receipts.set(path,{type:'REAL_CAPITA_ONBOARDING_PROOF',nonce,proof:signed.proof});return {evidenceUrl:evidenceOrigin+path,origin:evidenceOrigin,nonce};};
 try{
  const category=await owner.leaveCategory.findFirstOrThrow({where:{code:'SYNTHETIC'}});
  const result=await runOnboardingBrowser(base,agm.email,agm.password,{scenario:hrOnly?'scripts/hr-attendance-closeout-browser-scenario.js':'scripts/hr-payroll-closeout-browser-scenario.js',onReady:url=>{webOrigin=url;},fixture:{hrUserId:hr.id,md:{email:md.email,password:md.password},hr:{email:hr.email,password:hr.password},worker:{email:worker.email,password:worker.password},checkerEmail:worker.email,checkerPassword:worker.password,employeeIds:roster.map((e:any)=>e.id),employees:roster.map((e:any)=>({id:e.id,name:e.fullName})),departmentId:roster[0].departmentId,categoryId:category.id,evidenceOrigin}});
  if(hrOnly){assert.equal(await owner.payrollRun.count(),0);assert.equal(await owner.voucher.count(),0);console.log('PASS HR nonfinancial attendance, explicit role revocation and no payroll/voucher effects');return result;}
  const run=await owner.payrollRun.findFirstOrThrow({where:{payrollYear:2026,payrollMonth:9}});assert.equal(run.status,'APPROVED');assert.equal(run.createdById,agm.id);assert.equal(run.approvedById,worker.id);assert.equal(await owner.payrollRunLine.count({where:{payrollRunId:run.id}}),roster.length);assert.equal(await owner.payrollPaymentBatch.count(),0);assert.equal(await owner.voucher.count(),0);
  console.log('PASS closeout browser persisted APPROVED synthetic payroll, distinct maker/checker, exact roster, no payments/vouchers');return result;
 }finally{gateway.prepare=previousPrepare;evidence.closeAllConnections();await new Promise<void>(resolve=>evidence.close(()=>resolve()));}
}
