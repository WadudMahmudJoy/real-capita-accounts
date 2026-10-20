import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
const freePort=()=>new Promise<number>((done,reject)=>{const server=createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const port=(server.address() as {port:number}).port;server.close(()=>done(port));});});
export async function runHrAdminBrowser(c: any){
  const {db,apiDb,security,databaseName,load,req,apiReq}=c;assert(security);assert(/^real_capita_payroll_accept_[a-f0-9]{32}$/.test(databaseName));
  const sprint4=process.argv.includes('--hr-admin-sprint4'),payroll=process.argv.includes('--payroll-ui-browser'),attendanceLeave=process.argv.includes('--attendance-leave-browser');
  const token=randomUUID().replaceAll('-',''),temp=mkdtempSync(join(tmpdir(),'rc-hr-browser-'));
  const nextEnvPath=resolve('apps/web/next-env.d.ts'),originalNextEnv=readFileSync(nextEnvPath,'utf8');
  const envBefore={...process.env};let app: any,web: ReturnType<typeof spawn>|undefined;
  try{
    for(const key of ['DATABASE_URL','DATABASE_ADMIN_URL','MIGRATION_DATABASE_URL','FINANCE_PROVISIONING_DATABASE_URL','CONFIRMATION_DATABASE_URL','PRIVATE_WORKER_DATABASE_URL','DB_MIGRATION_SECRET','DB_FINANCE_SECRET','DB_CONFIRMATION_SECRET'])delete process.env[key];
    process.env.RUNTIME_DATABASE_URL=security.url(security.runtime);process.env.RUNTIME_DATABASE_NAME=databaseName;process.env.JWT_SECRET=randomUUID();process.env.COMPANY_MEDIA_ROOT=join(temp,'media');
    const role=await db.role.create({data:{code:'ACCOUNTANT',name:'Accountant'}}),password=randomUUID();
    const actor=await db.user.create({data:{email:'hr-browser@example.invalid',fullName:'Synthetic HR Accountant',passwordHash:await req('bcryptjs').hash(password,10),roles:{create:{roleId:role.id}}}});
    const denied=await db.user.create({data:{email:'denied-hr@example.invalid',fullName:'Synthetic Unprivileged',passwordHash:await req('bcryptjs').hash(password,10)}});
    const parent=await db.company.create({data:{singletonKey:'PRIMARY',name:'Real Capita Group'}});
    const office=await db.company.create({data:{name:'Synthetic Second Office'}});
    const user={id:actor.id,email:actor.email,fullName:actor.fullName,roles:[{code:'ACCOUNTANT',name:'Accountant'}]};
    const department=await new (load('department/department.service.js').DepartmentService)(apiDb).create({code:'HRTEST',name:'Synthetic HR Department'},user);
    const employees=new (load('employee/employee.service.js').EmployeeService)(apiDb);
    const roster:any[]=[];for(let n=1;n<=(sprint4?3:payroll||attendanceLeave?2:21);n++)roster.push(await employees.create({employeeCode:`SYN${String(n).padStart(3,'0')}`,fullName:`Synthetic Employee ${n}`,departmentId:department.id,designation:'Test Associate',joiningDate:'2026-01-01',mobileNumber:'01712345678'},user));
    const checkerPassword=randomUUID();
    const checker=sprint4||payroll||attendanceLeave?await db.user.create({data:{email:'payroll-checker@example.invalid',fullName:'Synthetic Independent Accountant',passwordHash:await req('bcryptjs').hash(checkerPassword,10),roles:{create:{roleId:role.id}}}}):null;
    if(sprint4||payroll||attendanceLeave){
      if(payroll){
      const salary=new (load('salary/salary.service.js').SalaryService)(apiDb,new (load('salary/salary-calculator.js').SalaryCalculator)());
      const structure=await salary.createStructure({code:'TESTPAY',name:'Real Capita test structure',effectiveFrom:'2026-01-01',components:[{code:'CUSTOM_A',name:'Custom A',percentage:'37.5',displayOrder:1},{code:'CUSTOM_B',name:'Custom B',percentage:'62.5',displayOrder:2}]},user);await salary.approveStructure(structure.id,user);
      for(const employee of roster){const assignment=await salary.createAssignment(employee.id,{salaryStructureId:structure.id,grossSalary:'100.01',effectiveFrom:'2026-01-01'},user);await salary.approveAssignment(assignment.id,user);const profile=await salary.createProfile(employee.id,{selectedBankPercentage:'60',bankName:'Synthetic Bank',accountName:employee.fullName,accountNumber:'PRIVATE_TEST_ONLY',effectiveFrom:'2026-01-01'},user);await salary.approveProfile(profile.id,user);}
      }
      const schedules=new (load('work-schedule/work-schedule.service.js').WorkScheduleService)(apiDb);
      for(const companyId of [parent.id,office.id]){await schedules.createAssignment(companyId,{scope:'COMPANY_DEFAULT',effectiveFrom:'2026-09-01',newSchedule:{code:'STANDARD_OFFICE',name:'Standard Office Schedule',days:['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'].map(dayOfWeek=>({dayOfWeek,isWorkingDay:dayOfWeek!=='FRIDAY',startMinuteOfDay:dayOfWeek==='FRIDAY'?null:600,endMinuteOfDay:dayOfWeek==='FRIDAY'?null:1080,unpaidBreakMinutes:dayOfWeek==='FRIDAY'?0:60,crossesMidnight:false}))}},user);await new (load('attendance/attendance-policy.service.js').AttendancePolicyService)(apiDb).createInitialPolicy(companyId,{effectiveFrom:'2026-01-01',lateGraceMinutes:5,earlyLeaveGraceMinutes:5},user);}
      const expectations=new (load('attendance/attendance-expectation.service.js').AttendanceExpectationService)(apiDb,schedules),attendance=new (load('attendance/attendance-day.service.js').AttendanceDayService)(apiDb,expectations),finalization=new (load('attendance/attendance-finalization.service.js').AttendanceFinalizationService)(apiDb,expectations);
      if(payroll)for(let day=1;day<=30;day++){const businessDate=`2026-09-${String(day).padStart(2,'0')}`,companyId=day%2?parent.id:office.id;if(new Date(`${businessDate}T00:00:00Z`).getUTCDay()!==5)await attendance.saveEntries(companyId,{businessDate,entries:roster.map(e=>({employeeId:e.id,checkInLocalTime:'10:00',checkOutLocalTime:'18:00',expectedUpdatedAt:null}))},user);await finalization.finalizeDay(companyId,{businessDate},user);}
    }
    let leaveCategory:any;
    if(attendanceLeave){
      const {LeaveAuthority}=load('leave/leave-authority.js'),{LeaveService}=load('leave/leave.service.js');
      const normal=new LeaveService(apiDb,new LeaveAuthority());assert.equal((await normal.capabilities(actor.id)).status,'BLOCKED');await assert.rejects(()=>normal.get('unknown',actor.id),(e:any)=>e.getStatus()===503);
      leaveCategory=await db.leaveCategory.create({data:{code:'TECH_ONLY',name:'Technical request category',isActive:true}});
      // Historical Sprint 3 mode now exercises persisted, explicitly technical
      // authority too; no production-provider replacement is needed.
      await db.userPermission.create({data:{userId:denied.id,code:'SYSTEM_ADMIN',grantedById:actor.id,reason:'Isolated technical maintenance bootstrap'}});
      const users=new (load('users/users.service.js').UsersService)(apiDb);
      for(const [id,employeeId] of [[actor.id,roster[0].id],[checker!.id,roster[1].id]]){const current=await users.get(id,denied.id);await users.action(id,{action:'BIND',employeeId,expectedVersion:current.adminVersion,verificationReference:'Isolated verified employee account',reason:'Synthetic binding'},denied.id);}
      const current=await users.get(checker!.id,denied.id);await users.action(checker!.id,{action:'GRANT_PERMISSION',permission:'HR_ADMIN',expectedVersion:current.adminVersion,reason:'Isolated explicit HR reviewer'},denied.id);
    }
    const {NestFactory}=apiReq('@nestjs/core'),{ValidationPipe}=apiReq('@nestjs/common');
    app=await NestFactory.create(load('app.module.js').AppModule,{logger:false,abortOnError:false});app.use(apiReq('cookie-parser')());app.enableCors({origin:true,credentials:true});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.listen(0,'127.0.0.1');
    if(attendanceLeave&&process.argv.includes('--leave-db-only')){
      const service=app.get(load('leave/leave.service.js').LeaveService),request=await service.submit({employeeId:roster[0].id,categoryId:leaveCategory.id,startDate:'2026-10-20',endDate:'2026-10-22',reason:'Isolated initial request',idempotencyKey:randomUUID()},actor.id,parent.id);await service.withdraw(request.id,1,actor.id);
      assert.equal((await db.leaveRequest.findUniqueOrThrow({where:{id:request.id}})).identitySnapshot.joiningDate,'2026-01-01');
      const {verifyLeavePostgres}=await import('./verify-leave-postgres');await verifyLeavePostgres({db,apiDb,load,actor,checker,denied,user,office,roster,category:leaveCategory,app});console.log('PASS focused PostgreSQL leave migration/catalog/lifecycle acceptance; no browser result claimed');return;
    }
    let sprintFixture:any;
    if(sprint4){
      // The ONLY maintenance bootstrap is explicitly synthetic, on this task's
      // empty disposable database. Production receives no automatic assignment.
      assert.deepEqual(await app.get(load('users/users.service.js').UsersService).access(actor.id),{systemAdmin:false,hrAdmin:false,employee:false});
      await db.userPermission.create({data:{userId:actor.id,code:'SYSTEM_ADMIN',grantedById:denied.id,reason:'Isolated synthetic maintenance designation; not business authority'}});
      const users=app.get(load('users/users.service.js').UsersService),reviewPassword=randomUUID();
      let reviewer=await users.create({email:'independent-hr@example.invalid',fullName:'Independent HR Reviewer',password:reviewPassword,reason:'Isolated technical provisioning'},actor.id);
      reviewer=await users.action(reviewer.id,{action:'BIND',expectedVersion:reviewer.adminVersion,employeeId:roster[2].id,verificationReference:'Synthetic independently verified identity',reason:'Isolated binding'},actor.id);
      reviewer=await users.action(reviewer.id,{action:'GRANT_PERMISSION',permission:'HR_ADMIN',expectedVersion:reviewer.adminVersion,reason:'Isolated HR designation'},actor.id);
      sprintFixture={reviewEmail:reviewer.email,reviewPassword,reviewerId:reviewer.id,workerPassword:randomUUID(),hrPassword:randomUUID()};
    }
    if(sprint4&&process.argv.includes('--hr4-db-only')&&!process.argv.includes('--leave-md-sprint7d')){
      const users=app.get(load('users/users.service.js').UsersService),leave=app.get(load('leave/leave.service.js').LeaveService);
      let worker=await users.create({email:'employee@example.invalid',fullName:'Employee Account Updated',password:randomUUID(),reason:'Isolated technical provisioning'},actor.id);
      worker=await users.action(worker.id,{action:'BIND',employeeId:roster[0].id,verificationReference:'Isolated verified binding',expectedVersion:worker.adminVersion,reason:'Synthetic binding'},actor.id);
      worker=await users.action(worker.id,{action:'UNBIND',expectedVersion:worker.adminVersion,reason:'Isolated release'},actor.id);
      worker=await users.action(worker.id,{action:'BIND',employeeId:roster[0].id,verificationReference:'Isolated independent re-verification',expectedVersion:worker.adminVersion,reason:'Synthetic rebind'},actor.id);
      let hr=await users.create({email:'hr-operator@example.invalid',fullName:'HR Leave Operator',password:randomUUID(),reason:'Isolated technical provisioning'},actor.id);
      hr=await users.action(hr.id,{action:'BIND',employeeId:roster[1].id,verificationReference:'Isolated verified HR identity',expectedVersion:hr.adminVersion,reason:'Synthetic binding'},actor.id);
      hr=await users.action(hr.id,{action:'GRANT_PERMISSION',permission:'HR_ADMIN',expectedVersion:hr.adminVersion,reason:'Isolated HR authorization'},actor.id);
      let category=await leave.category(null,{code:'REQUEST',name:'Configured Request',isActive:true,expectedVersion:0},hr.id);
      const approved=await leave.submit({employeeId:roster[0].id,categoryId:category.id,startDate:'2027-02-01',endDate:'2027-02-02',reason:'Employee private request',idempotencyKey:randomUUID()},worker.id,office.id);
      await leave.decide(approved.id,{decision:'APPROVED',expectedVersion:1,reason:'Independent HR review'},sprintFixture.reviewerId);
      const onBehalf=await leave.submit({employeeId:roster[0].id,categoryId:category.id,startDate:'2027-02-10',endDate:'2027-02-10',reason:'Recorded HR on-behalf request',idempotencyKey:randomUUID()},hr.id,parent.id);await leave.withdraw(onBehalf.id,1,worker.id);
      category=await leave.category(category.id,{code:category.code,name:'Renamed Configuration',isActive:false,expectedVersion:category.version},hr.id);
      const attendance=new (load('attendance/attendance-day.service.js').AttendanceDayService)(apiDb,new (load('attendance/attendance-expectation.service.js').AttendanceExpectationService)(apiDb,new (load('work-schedule/work-schedule.service.js').WorkScheduleService)(apiDb)));await attendance.saveEntries(parent.id,{businessDate:'2026-10-14',entries:roster.map(e=>({employeeId:e.id,checkInLocalTime:'10:00',checkOutLocalTime:'18:00',expectedUpdatedAt:null}))},user);
      const result={workerId:worker.id,hrId:hr.id,requestId:approved.id,categoryId:category.id};
      if(process.argv.includes('--authority-fast')){const {verifyAuthorityPostgres}=await import('./authority-postgres-acceptance');await verifyAuthorityPostgres({db,apiDb,app,load,actor,denied,user,office,parent,roster,department,result,req,apiReq,security,fixture:{password},temp});return;}
      const {verifyHrAdminPostgres}=await import('./verify-hr-admin-postgres');await verifyHrAdminPostgres({db,apiDb,app,load,actor,denied,user,office,parent,roster,department,result}).catch((e:any)=>{console.error(JSON.stringify({type:e?.name,detail:e instanceof TypeError?e.message:undefined,locations:e?.stack?.split('\n').filter((line:string)=>/^\s+at /.test(line)).slice(0,4)}));throw e;});if(process.argv.includes('--authority-sprint7b')){const {verifyAuthorityPostgres}=await import('./authority-postgres-acceptance');await verifyAuthorityPostgres({db,apiDb,app,load,actor,denied,user,office,parent,roster,department,result,req,apiReq,security,fixture:{password},temp});}console.log('PASS focused Sprint 4 PostgreSQL acceptance; no browser result claimed');return;
    }
    const api=await app.getUrl(),port=await freePort(),url=`http://127.0.0.1:${port}`;
    const webReq=createRequire(resolve('apps/web/package.json'));
    const webEnv={...envBefore,NEXT_PUBLIC_API_BASE_URL:api,HR_BROWSER_TEST_TOKEN:token};
    for(const key of Object.keys(webEnv))if(/DATABASE|DB_.*SECRET|JWT_SECRET|PRIVATE_WORKER/.test(key))delete (webEnv as any)[key];
    web=spawn(process.execPath,[webReq.resolve('next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:resolve('apps/web'),env:webEnv,stdio:['ignore','pipe','pipe'],windowsHide:true});
    let exited=false;web.once('exit',()=>{exited=true;});
    // Never echo child logs or connection strings. Only synthetic fixture metadata
    // goes into the private temporary scenario consumed by the browser driver.
    web.stdout?.on('data',()=>{});web.stderr?.on('data',()=>{});
    for(let n=0;n<120;n++){assert(!exited,'Isolated Next process exited');try{if((await fetch(`${url}/login`)).ok)break;}catch{/* Next may not be listening yet; retry only this isolated process. */}if(n===119)assert.fail('Web startup timed out');await new Promise(r=>setTimeout(r,500));}
    const fixture={url,api,email:actor.email,deniedEmail:denied.email,password,departmentId:department.id,officeId:office.id,parentId:parent.id,resultFile:join(temp,'result.json'),checkerEmail:checker?.email,checkerPassword,employeeIds:roster.map(e=>e.id),categoryId:leaveCategory?.id,...sprintFixture};
    if(process.argv.includes('--leave-md-sprint7d')){const {verifyLeaveMdPostgres}=await import('./leave-md-postgres-acceptance');await verifyLeaveMdPostgres({db,apiDb,app,load,req,apiReq,actor,denied,user,parent,office,roster,department,security,fixture,temp});return;}
    const template=readFileSync(sprint4?'scripts/hr-admin-sprint4-browser-scenario.js':attendanceLeave?'scripts/attendance-leave-browser-scenario.js':payroll?'scripts/payroll-ui-browser-scenario.js':'scripts/hr-admin-browser-scenario.js','utf8');writeFileSync(join(temp,'scenario.js'),template.replace('__FIXTURE__',JSON.stringify(fixture)));
    console.log(`BROWSER_SCENARIO ${join(temp,'scenario.js')}`);
    console.log('READY actual Next.js + NestJS + restricted PostgreSQL; browser must execute the scenario file');
    for(let n=0;n<900&&!existsSync(fixture.resultFile);n++){assert(!exited);await new Promise(r=>setTimeout(r,1000));}
    assert(existsSync(fixture.resultFile),'Browser acceptance did not complete');const result=JSON.parse(readFileSync(fixture.resultFile,'utf8'));assert.equal(result.status,'PASS');
    if(sprint4){const {verifyHrAdminPostgres}=await import('./verify-hr-admin-postgres');await verifyHrAdminPostgres({db,apiDb,app,load,actor,denied,user,office,parent,roster,department,result});console.log(`PASS ${result.checks} actual Sprint 4 browser/API assertions with real persisted authority/bindings, restricted runtime and genuine login`);if(process.argv.includes('--authority-sprint7b')){const {verifyAuthorityPostgres}=await import('./authority-postgres-acceptance');await verifyAuthorityPostgres({db,apiDb,app,load,actor,denied,user,office,parent,roster,department,result,req,apiReq,security,fixture,temp});}return;}
    assert.equal(await db.employee.count(),payroll||attendanceLeave?2:22);assert.equal(await db.payrollRun.count(),payroll?1:0);
    if(payroll){const run=await db.payrollRun.findFirstOrThrow();assert.equal(run.status,'APPROVED');assert.equal(run.createdById,actor.id);assert.equal(run.approvedById,checker!.id);assert.equal(run.version,2);assert.equal(await db.payrollRunLine.count(),2);for(const action of ['PAYROLL_RUN_DRAFT_CREATED','PAYROLL_RUN_APPROVED'])assert.equal(await db.auditEvent.count({where:{action}}),1);assert.equal(await db.payrollPaymentConfirmation.count(),0);}assert.equal(await db.payrollPaymentBatch.count(),0);assert.equal(await db.voucher.count(),0);
    assert.equal(await db.user.count(),payroll||attendanceLeave?3:2);assert.equal(await db.role.count(),1);
    if(attendanceLeave){
      assert.equal(await db.attendanceRecord.count(),2);assert.equal(await db.leaveRequest.count(),3);assert.equal(await db.leaveRequestEvent.count(),6);
      const {verifyLeavePostgres}=await import('./verify-leave-postgres');await verifyLeavePostgres({db,apiDb,load,actor,checker,denied,user,office,roster,category:leaveCategory,app});
    }
    console.log(`PASS ${result.checks} actual browser groups; ${payroll?'one approved payroll, two lines, distinct creator/reviewer and atomic audits':'employee writes isolated'}; zero payments/vouchers or user/role UI mutations`);
  }finally{
    if(web&&web.exitCode===null){web.kill();await new Promise<void>(done=>{const timeout=setTimeout(done,5000);web!.once('exit',()=>{clearTimeout(timeout);done();});});}
    if(app)await app.close();
    for(const key of Object.keys(process.env))if(!(key in envBefore))delete process.env[key];Object.assign(process.env,envBefore);
    // Next adds its custom output directories to tsconfig. Remove only this
    // harness's entries, preserving all prior and concurrently edited settings.
    const configPath=resolve('apps/web/tsconfig.json'),config=JSON.parse(readFileSync(configPath,'utf8'));
    config.include=config.include.filter((value: string)=>!value.startsWith(`.next-hr-test-${token}/`));
    writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');
    if(readFileSync(nextEnvPath,'utf8').includes(`.next-hr-test-${token}/`))writeFileSync(nextEnvPath,originalNextEnv);
    const artifact=resolve('apps/web',`.next-hr-test-${token}`);assert(artifact.startsWith(resolve('apps/web')+require('node:path').sep));rmSync(artifact,{recursive:true,force:true});rmSync(temp,{recursive:true,force:true});
  }
}
