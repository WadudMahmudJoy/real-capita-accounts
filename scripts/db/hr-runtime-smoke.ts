// Separate runtime-only process. Never receives maintenance/provisioning secrets.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
const req=createRequire(resolve('package.json'));
async function main(){
 const build=process.env.HR_SMOKE_BUILD,output=process.env.HR_SMOKE_REPORT;
 assert(build&&build.startsWith(resolve('apps/api/.hr-deploy-'))&&output);
 for(const key of Object.keys(process.env))assert(!/^(MIGRATION_|DATABASE_ADMIN|FINANCE_PROVISIONING|DB_.*SECRET|SALARY_PRIVATE)/.test(key));
 Object.assign(process.env,req('dotenv').parse(readFileSync('.env')));
 const load=(name:string)=>req(join(build,name));const {NestFactory}=req('@nestjs/core'),{ValidationPipe}=req('@nestjs/common');
 const app=await NestFactory.create(load('app.module.js').AppModule,{logger:false});
 try{
  app.use(req('cookie-parser')());app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));await app.listen(0,'127.0.0.1');
  const base=await app.getUrl(),prisma=app.get(load('prisma/prisma.service.js').PrismaService);
  assert.equal((await fetch(base+'/health')).status,200);
  const endpoints=['/auth/me','/employees','/users/access','/users','/fiscal-years','/vouchers','/salary-structures','/attendance/day?businessDate=2026-10-16','/payroll-runs','/payroll-runs/unavailable/salary-sheet','/payroll-runs/unavailable/payslips/unavailable','/leave-requests/capabilities','/leave-requests','/leave-requests/review-queue','/leave-requests/categories'];
  for(const path of endpoints)assert.equal((await fetch(base+path)).status,401,`Unauthenticated boundary ${path}`);
  for(const model of ['company','employee','salaryStructure','employeeSalaryAssignment','employeePaymentProfile','attendanceRecord','fiscalYear','accountingPeriod','ledgerAccount','voucher','payrollRun','payrollRunLine','leaveRequest','leaveCategory','userPermission','employeeAccountBinding','userAdminEvent'])await prisma[model].findMany({take:1});
  const parent=await app.get(load('payroll/payroll-parent.resolver.js').PayrollParentResolver).resolve();
  const employees=app.get(load('employee/employee.service.js').EmployeeService),rows=await employees.findAll({});
  if(rows.length){await employees.findOne(rows[0].id);assert((await employees.findAll({search:rows[0].employeeCode})).length>=1);}
  await app.get(load('fiscal-year/fiscal-year.service.js').FiscalYearService).findAll(parent.id);
  await app.get(load('voucher/voucher.service.js').VoucherService).findAll(parent.id,{});
  const payroll=app.get(load('payroll/payroll.service.js').PayrollService),list=await payroll.list({page:1,pageSize:20});
  const preview=await app.get(load('payroll/payroll-preview.service.js').PayrollPreviewService).preview({year:2026,month:10,deductions:[]});assert.equal(preview.status,'BLOCKED');
  const actor=await prisma.user.findFirst({where:{isActive:true},select:{id:true}});
  if(actor){const users=app.get(load('users/users.service.js').UsersService),leave=app.get(load('leave/leave.service.js').LeaveService);assert.deepEqual(await users.access(actor.id),{systemAdmin:false,hrAdmin:false,employee:false});await assert.rejects(()=>users.list({page:1,pageSize:20},actor.id),(e:any)=>e.getStatus()===403);const capability=await leave.capabilities(actor.id);assert.equal(capability.status,'BLOCKED');assert(capability.blockers.includes('LEAVE_IDENTITY_AUTHORITY_UNAVAILABLE'));await assert.rejects(()=>leave.reviewQueue({page:1,pageSize:20},actor.id),(e:any)=>e.getStatus()===403);}
  const approved=await prisma.payrollRun.count({where:{status:'APPROVED'}});
  for(const model of ['leaveRequest','leaveCategory','userPermission','employeeAccountBinding','userAdminEvent'])assert.equal(await prisma[model].count(),0);
  const report={status:'PASS',runtimeStartup:true,health:true,unauthenticatedHttpDenials:endpoints.length,legacyModelReads:17,employeeListSearchDetail:rows.length?'PASS':'EMPTY',accountingVoucherReads:'PASS',payrollList:'PASS',payrollPreview:preview.status,payrollRuns:list.total,approvedDocuments:approved?'existing approved rows available; isolated document acceptance retained':'NOT_TESTABLE: no approved business payroll',usersLeaveAuthority:'FAIL_CLOSED: no genuine designations/bindings',liveAuthenticatedBrowser:'NOT_TESTABLE: no supplied genuine browser session; no login/session fabricated',positiveAcceptance:'Separate isolated genuine-auth browser fixtures',noBusinessWrites:true};
  writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log('PASS separate runtime-only Nest/Prisma startup, 15 actual HTTP authentication denials, legacy service reads, payroll preview and HR fail-closed checks; no credentials or business data printed');
 }finally{await app.close();}
}
main().catch(()=>{console.error('BLOCKED runtime smoke; connection and business diagnostics suppressed');process.exitCode=1;});
