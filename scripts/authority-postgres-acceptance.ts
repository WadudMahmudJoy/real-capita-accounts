import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {writeFileSync,existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {authorityPrivateWriterPrivileges} from './db/authority-privileges';

// Existing harness: a separately owned tmpfs PostgreSQL instance and genuine
// authenticated fixtures. No connection to salary-dev is opened here.
export async function verifyAuthorityPostgres(c:any){
 const {db,apiDb,app,load,actor,user,apiReq,security,fixture,temp}=c;
 assert(process.argv.includes('--authority-sprint7b'));assert(process.env.PAYROLL_SECURITY_TOKEN);
 const instance=new URL(process.env.PAYROLL_SECURITY_INSTANCE_URL!);assert.equal(instance.hostname,'127.0.0.1');assert(!['55532','55432','5432'].includes(instance.port));
 const {Client,Pool}=apiReq('pg'),admin=new Client({connectionString:instance.toString()});await admin.connect();
 const database=(await db.$queryRawUnsafe('SELECT current_database() db'))[0].db;assert(/^real_capita_payroll_accept_[a-f0-9]{32}$/.test(database));
 const adminTarget=new URL(instance);adminTarget.pathname='/'+database;const owner=new Client({connectionString:adminTarget.toString()});await owner.connect();
 const writerRole='authority_writer_'+randomBytes(8).toString('hex'),writerPassword=randomBytes(32).toString('hex');let pool:any,maintenance:any;
 let stage='private role profile';let checks=0;const ok=(value:boolean)=>{assert(value);checks++;};
 try{
  assert.equal((await admin.query('SELECT current_database() db')).rows[0].db,decodeURIComponent(instance.pathname.slice(1)));
  await admin.query(`CREATE ROLE "${writerRole}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${writerPassword}'`);
  await owner.query(`GRANT CONNECT ON DATABASE "${database}" TO "${writerRole}"`);await authorityPrivateWriterPrivileges(owner,writerRole);
  const writerUrl=new URL(adminTarget);writerUrl.username=writerRole;writerUrl.password=writerPassword;pool=new Pool({connectionString:writerUrl.toString(),max:3});
  const executor=new (load('authority/sql-authority-executor.js').SqlAuthorityExecutor)(pool,database,writerRole);
  maintenance=new (load('generated/prisma/client.js').PrismaClient)({adapter:new (c.req('@prisma/adapter-pg').PrismaPg)({connectionString:security.url(security.migration),max:1})});await maintenance.$connect();
  const writer=app.get(load('authority/authority-writer.js').AuthorityWriter),verifier=app.get(load('authority/authority-writer.js').MdClaimVerifier),service=app.get(load('authority/authority.service.js').AuthorityService);
  await assert.rejects(()=>writer.execute(actor.id,'REQUEST',{}),(e:any)=>e.getStatus()===503);checks++;
  await assert.rejects(()=>verifier.verify(actor.id,'unverified claim'),(e:any)=>e.getStatus()===503);checks++;
  stage='personal fixture provisioning';const users=app.get(load('users/users.service.js').UsersService),employees=app.get(load('employee/employee.service.js').EmployeeService);
  const person=async(code:string)=>employees.create({employeeCode:code,fullName:'Synthetic Authority '+code,departmentId:c.department.id,designation:'Technical fixture',joiningDate:'2026-01-01',mobileNumber:'01712345678'},user);
  const mdPassword=randomUUID();let md=await users.create({email:'md-authority@example.invalid',fullName:'Synthetic MD Identity',password:mdPassword,reason:'Isolated personal account before independent authority ceremony'},actor.id);
  const mdEmployee=await person('AUTHMD'),agmEmployee=await person('AUTHAGM');
  const viewerPassword=randomUUID();let viewer=await users.create({email:'granular-viewer@example.invalid',fullName:'Synthetic Employee Reader',password:viewerPassword,reason:'Isolated granular identity'},actor.id);
  const viewerEmployee=await person('AUTHVIEW');viewer=await users.action(viewer.id,{action:'BIND',employeeId:viewerEmployee.id,verificationReference:'Isolated independently verified viewer',expectedVersion:1,reason:'Technical binding'},actor.id);
  md=await users.action(md.id,{action:'BIND',employeeId:mdEmployee.id,verificationReference:'Isolated independently verified personal fixture',expectedVersion:1,reason:'Independent technical binding'},actor.id);
  stage='independent operator and actor binding';const currentActor=await users.get(actor.id,actor.id);
  // Self-administration is forbidden: designate a distinct synthetic administrator
  // through the existing genuine service before the MD boundary exists.
  const reviewer=await db.user.findUniqueOrThrow({where:{email:'independent-hr@example.invalid'}});
  await users.action(reviewer.id,{action:'GRANT_PERMISSION',permission:'SYSTEM_ADMIN',expectedVersion:(await users.get(reviewer.id,actor.id)).adminVersion,reason:'Isolated independent bootstrap operator'},actor.id);
  if(!await db.employeeAccountBinding.findFirst({where:{userId:actor.id,unboundAt:null}}))await users.action(actor.id,{action:'BIND',employeeId:agmEmployee.id,verificationReference:'Synthetic independently verified AGM fixture',expectedVersion:currentActor.adminVersion,reason:'Distinct administrator verifies actor'},reviewer.id);
  stage='private capability provisioning';const api=await app.getUrl();ok((await fetch(api+'/authority/access')).status===401);
  const loginResponse=await fetch(api+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:md.email,password:mdPassword})});ok(loginResponse.status===200);const cookie=loginResponse.headers.get('set-cookie')!.split(';')[0];
  ok((await fetch(api+'/authority/md-claim',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({claimReference:'claimed-by-client'})})).status===503);
  ok((await fetch(api+'/authority/roles',{headers:{Cookie:cookie}})).status===403);
  const token=randomBytes(32).toString('hex'),ticket=await maintenance.authorityBootstrap.create({data:{companyId:c.parent.id,targetUserId:md.id,authorizerId:reviewer.id,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+60000),purpose:'ACTIVATE',provenance:{provider:'isolated-independent-ceremony',authorizerId:reviewer.id,technicalOnly:true}}});
  await assert.rejects(()=>apiDb.$queryRawUnsafe("SELECT authority_command($1,'BOOTSTRAP',$2::jsonb)",md.id,JSON.stringify({ticketToken:token})));checks++;
  await assert.rejects(()=>executor.execute(md.id,'BOOTSTRAP',{ticketToken:'guessed-token'}));checks++;await assert.rejects(()=>apiDb.$executeRawUnsafe('SET ROLE "'+writerRole+'"'));checks++;const scoped=await pool.connect();try{await assert.rejects(()=>scoped.query('UPDATE roles SET name=$1',['Forbidden']));checks++;await assert.rejects(()=>scoped.query('SELECT * FROM authority_bootstraps'));checks++;}finally{scoped.release();}
  // Only this isolated application receives synthetic trusted dependencies.
  writer.execute=executor.execute.bind(executor);
  verifier.verify=async(id:string,reference:string)=>{if(id!==md.id||reference!=='synthetic-independent-ceremony')throw Error('Unverified fixture identity');return {ticketToken:token};};
  stage='verified MD ceremony';await service.claim('synthetic-independent-ceremony',md.id);ok((await service.access(md.id)).permissions.includes('authority.review'));
  await assert.rejects(()=>apiDb.$executeRawUnsafe('UPDATE employees SET "isActive"=false WHERE id=$1',mdEmployee.id));checks++;
  await assert.rejects(()=>employees.update(mdEmployee.id,{isActive:false},user),(e:any)=>e.getStatus()===403);checks++;
  ok((await db.authorityBootstrap.findUniqueOrThrow({where:{id:ticket.id}})).consumedAt!==null);
  await assert.rejects(()=>service.claim('synthetic-independent-ceremony',md.id));checks++;
  const expiredToken=randomBytes(32).toString('hex');await maintenance.authorityBootstrap.create({data:{companyId:c.parent.id,targetUserId:md.id,authorizerId:reviewer.id,tokenHash:createHash('sha256').update(expiredToken).digest('hex'),createdAt:new Date(Date.now()-5000),expiresAt:new Date(Date.now()-1000),purpose:'REVOKE',provenance:{technicalOnly:true}}});
  await assert.rejects(()=>executor.execute(md.id,'BOOTSTRAP',{ticketToken:expiredToken}));checks++;
  const request=(operation:string,payload:any,expectedVersion=0)=>({operation,payload,expectedVersion,idempotencyKey:randomUUID(),reason:'Isolated authority workflow',expiresAt:new Date(Date.now()+60000).toISOString()});
  stage='MD delegation request';const delegation=await service.request(request('DELEGATE',{permissions:['roles.view','roles.manage','employees.view','employees.create','employees.edit','departments.view','users.view','payroll.view'],expiresAt:new Date(Date.now()+3600000).toISOString()}),actor.id);
  ok(delegation.status==='PENDING');ok(!(await service.access(actor.id)).permissions.includes('roles.manage'));
  await assert.rejects(()=>service.decide(delegation.id,{command:'APPROVE',expectedVersion:1,reason:'Self approval'},actor.id),(e:any)=>e.getStatus()===403);checks++;
  await service.decide(delegation.id,{command:'APPROVE',expectedVersion:1,reason:'Independent MD delegation'},md.id);ok((await service.access(actor.id)).permissions.includes('roles.manage'));
  await assert.rejects(()=>service.request(request('ROLE_CREATE',{code:'ESCALATE',name:'Invalid',permissions:['authority.review']}),actor.id));checks++;
  stage='delegated role creation';const createInput=request('ROLE_CREATE',{code:'ROLE_AUDITOR',name:'Authority Audit Viewer',permissions:['roles.view']});const created=await service.request(createInput,actor.id);ok(created.request.status==='APPLIED');const role=created.role;
  const replay=await service.request(createInput,actor.id);ok(replay.id===created.request.id);await assert.rejects(()=>service.request({...createInput,reason:'Altered idempotent instruction'},actor.id));checks++;
  await assert.rejects(()=>maintenance.$executeRawUnsafe('UPDATE roles SET "permissionCodes"=NULL WHERE id=$1',role.id));checks++;
  const actorMandate=await db.authorityMandate.findFirstOrThrow({where:{userId:actor.id,kind:'DELEGATE'}});await assert.rejects(()=>maintenance.$executeRawUnsafe('UPDATE authority_mandates SET ceiling=NULL WHERE id=$1',actorMandate.id));checks++;
  const worker=await db.user.findUniqueOrThrow({where:{id:c.result.workerId}});
  stage='independent assignment and concurrency';const assign=await service.request(request('ROLE_ASSIGN',{roleId:role.id,targetUserId:worker.id,expiresAt:new Date(Date.now()+3600000).toISOString()},role.version),actor.id);ok(!(await service.access(worker.id)).permissions.includes('roles.view'));
  await assert.rejects(()=>executor.execute(md.id,'APPROVE',{requestId:assign.id,reason:'Missing expected version must fail even through private SQL'}));checks++;
  const concurrent=await Promise.allSettled([service.decide(assign.id,{command:'APPROVE',expectedVersion:1,reason:'Independent MD'},md.id),service.decide(assign.id,{command:'APPROVE',expectedVersion:1,reason:'Concurrent MD'},md.id)]);ok(concurrent.filter(r=>r.status==='fulfilled').length===1);ok((await service.access(worker.id)).permissions.includes('roles.view'));
  ok(await db.authorityRoleGrant.count({where:{requestId:assign.id}})===1);
  await assert.rejects(()=>service.decide(assign.id,{command:'APPROVE',expectedVersion:2,reason:'Retry'},md.id));checks++;
  const selfAssign=await service.request(request('ROLE_ASSIGN',{roleId:role.id,targetUserId:actor.id,expiresAt:new Date(Date.now()+60000).toISOString()},role.version),actor.id);await assert.rejects(()=>service.decide(selfAssign.id,{command:'APPROVE',expectedVersion:1,reason:'Must reject self elevation'},md.id));checks++;
  const hr=await db.user.findUniqueOrThrow({where:{id:c.result.hrId}});const hrRequest=await service.request(request('DELEGATE',{permissions:['roles.view'],expiresAt:new Date(Date.now()+3600000).toISOString()}),hr.id);await service.decide(hrRequest.id,{command:'APPROVE',expectedVersion:1,reason:'MD approves narrowly scoped HR request'},md.id);ok((await service.access(hr.id)).permissions.join(',')==='roles.view');
  const boundaryLeave=app.get(load('leave/leave.service.js').LeaveService);await assert.rejects(()=>boundaryLeave.decide(c.result.requestId,{decision:'APPROVED',expectedVersion:2,reason:'Legacy HR must not bypass MD routing'},reviewer.id),(e:any)=>e.getStatus()===409&&e.message.includes('MD_LEAVE_ROUTING_CONTRACT_REQUIRED'));checks++;
  const workerVersion=(await users.get(worker.id,actor.id)).adminVersion;await assert.rejects(()=>users.action(worker.id,{action:'GRANT_PERMISSION',permission:'HR_ADMIN',expectedVersion:workerVersion,reason:'Legacy elevation must not bypass MD'},actor.id),(e:any)=>e.getStatus()===409);checks++;
  const before=await db.authorityEvent.count();await assert.rejects(()=>apiDb.$executeRawUnsafe('UPDATE authority_events SET action=\'FORGED\''));checks++;await assert.rejects(()=>db.$executeRawUnsafe('DELETE FROM authority_events'));checks++;ok(await db.authorityEvent.count()===before);
  for(const sql of ['INSERT INTO authority_mandates DEFAULT VALUES','UPDATE roles SET name=\'Escalated\'','ALTER TABLE authority_mandates DISABLE TRIGGER ALL']){await assert.rejects(()=>apiDb.$executeRawUnsafe(sql));checks++;}
  const pending=await service.request(request('ROLE_ASSIGN',{roleId:role.id,targetUserId:reviewer.id,expiresAt:new Date(Date.now()+60000).toISOString()},role.version),actor.id);
  const auditBefore=await db.auditEvent.count(),grantsBefore=await db.authorityRoleGrant.count();await db.$executeRawUnsafe("CREATE FUNCTION authority_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='AUTHORITY_APPROVE' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF;RETURN NEW;END $$");await db.$executeRawUnsafe('CREATE TRIGGER authority_audit_failure BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION authority_audit_failure()');
  try{await assert.rejects(()=>service.decide(pending.id,{command:'APPROVE',expectedVersion:1,reason:'Atomic rollback'},md.id));checks++;}finally{await db.$executeRawUnsafe('DROP TRIGGER authority_audit_failure ON audit_events');await db.$executeRawUnsafe('DROP FUNCTION authority_audit_failure()');}
  ok(await db.auditEvent.count()===auditBefore&&await db.authorityRoleGrant.count()===grantsBefore);ok((await db.authorityRequest.findUniqueOrThrow({where:{id:pending.id}})).status==='PENDING');
  const d=await db.authorityMandate.findFirstOrThrow({where:{userId:hr.id,kind:'DELEGATE'}});const revoke=await service.request(request('DELEGATE_REVOKE',{mandateId:d.id},d.version),actor.id);await service.decide(revoke.id,{command:'APPROVE',expectedVersion:1,reason:'MD revokes HR technical delegation'},md.id);ok((await service.access(hr.id)).permissions.length===0);
  const roleGrant=await db.authorityRoleGrant.findFirstOrThrow({where:{userId:worker.id,roleId:role.id}});const revokeGrant=await service.request(request('ROLE_REVOKE',{grantId:roleGrant.id},roleGrant.version),actor.id);await service.decide(revokeGrant.id,{command:'APPROVE',expectedVersion:1,reason:'Independent MD revokes role'},md.id);ok(!(await service.access(worker.id)).permissions.includes('roles.view'));
  const cancel=await service.decide(selfAssign.id,{command:'CANCEL',expectedVersion:1,reason:'Withdraw unresolved self-assignment'},actor.id);ok(cancel.status==='CANCELLED');
  const staleInput=request('ROLE_ASSIGN',{roleId:role.id,targetUserId:worker.id,expiresAt:new Date(Date.now()+3600000).toISOString()},role.version);staleInput.expiresAt=new Date(Date.now()+200).toISOString();const stale=await service.request(staleInput,actor.id);await new Promise(r=>setTimeout(r,250));await assert.rejects(()=>service.decide(stale.id,{command:'APPROVE',expectedVersion:1,reason:'Expired request'},md.id));checks++;ok((await service.decide(stale.id,{command:'EXPIRE',expectedVersion:1,reason:'Durable expiry'},actor.id)).status==='EXPIRED');
  const reject=await service.request(request('DELEGATE',{permissions:['roles.manage'],expiresAt:new Date(Date.now()+3600000).toISOString()}),hr.id);ok((await service.decide(reject.id,{command:'REJECT',expectedVersion:1,reason:'Independent MD denies expanded HR authority'},md.id)).status==='REJECTED');
  stage='granular authenticated business permissions';
  const loginCookie=async(email:string,password:string)=>{const r=await fetch(api+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});ok(r.status===200);return r.headers.get('set-cookie')!.split(';')[0];};
  const viewerCookie=await loginCookie(viewer.email,viewerPassword);
  const http=async(path:string,session=viewerCookie,method='GET',body?:unknown)=>fetch(api+path,{method,headers:{Cookie:session,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  ok((await http('/employees')).status===403);ok((await http('/payroll-runs')).status===403);
  const reader=await service.request(request('ROLE_CREATE',{code:'EMPLOYEE_READER',name:'Global Employee Reader',permissions:['employees.view','departments.view','payroll.view']}),actor.id);
  const readerAssignment=await service.request(request('ROLE_ASSIGN',{roleId:reader.role.id,targetUserId:viewer.id,expiresAt:new Date(Date.now()+3600000).toISOString()},1),actor.id);
  ok((await http('/employees')).status===403); // Pending assignment confers nothing.
  await service.decide(readerAssignment.id,{command:'APPROVE',expectedVersion:1,reason:'Independent MD technical review'},md.id);
  ok((await http('/employees')).status===200);ok((await http('/departments')).status===200);
  ok((await http('/employees',viewerCookie,'POST',{employeeCode:'FORGED'})).status===403);
  ok((await http('/employees/'+viewerEmployee.id,viewerCookie,'PATCH',{fullName:'Denied'})).status===403);
  ok((await http('/payroll-runs')).status===403); // Generic payroll view never supplies ACCOUNTANT.
  ok((await http('/users')).status===403);ok((await http('/vouchers')).status===403);
  const capabilities=await (await http('/authority/access')).json();ok(capabilities.activated===true&&capabilities.allowedPermissions.includes('employees.view')&&!capabilities.allowedPermissions.includes('payroll.view'));
  ok((await http('/leave-requests')).status===200);ok((await http('/leave-requests/'+c.result.requestId)).status===404); // Service-level private ownership remains authoritative.
  ok((await http('/leave-requests/review-queue')).status===403);
  const operatorCookie=await loginCookie(actor.email,fixture.password??c.password??'');
  if(operatorCookie){
   const employeeResponse=await http('/employees',operatorCookie,'POST',{employeeCode:'AUTHHTTP',fullName:'Synthetic HTTP Granular Employee',departmentId:c.department.id,designation:'Technical fixture',joiningDate:'2026-01-01',mobileNumber:'01712345678'});ok(employeeResponse.status===201);const newEmployee=await employeeResponse.json();ok((await http('/employees/'+newEmployee.id,operatorCookie,'PATCH',{designation:'Verified granular edit'})).status===200);
   ok((await http('/payroll-runs',operatorCookie)).status===200);ok((await http('/vouchers',operatorCookie)).status===403);ok((await http('/attendance/finalize',operatorCookie,'POST',{businessDate:'2026-10-14'})).status===403);}
  const rg=await db.authorityRoleGrant.findFirstOrThrow({where:{requestId:readerAssignment.id}});
  const rr=await service.request(request('ROLE_REVOKE',{grantId:rg.id},rg.version),actor.id);await service.decide(rr.id,{command:'APPROVE',expectedVersion:1,reason:'Independent MD revocation'},md.id);ok((await http('/employees')).status===403);
  const again=await service.request(request('ROLE_ASSIGN',{roleId:reader.role.id,targetUserId:viewer.id,expiresAt:new Date(Date.now()+3600000).toISOString()},1),actor.id);await service.decide(again.id,{command:'APPROVE',expectedVersion:1,reason:'Independent MD browser fixture assignment'},md.id);
  stage='concurrent role editing and delegated ceiling';
  await assert.rejects(()=>service.request(request('ROLE_CREATE',{code:'OUTSIDE_CEILING',name:'Denied finance delegation',permissions:['vouchers.post']}),actor.id));checks++;
  const changing=await service.request(request('ROLE_CREATE',{code:'CONCURRENT_EDIT',name:'Concurrent role',permissions:['roles.view']}),actor.id);
  const roleRaces=await Promise.allSettled(['First writer','Second writer'].map(name=>service.request(request('ROLE_EDIT',{roleId:changing.role.id,name,isActive:true,permissions:['roles.view']},1),actor.id)));
  ok(roleRaces.filter(r=>r.status==='fulfilled').length===1);ok((await db.role.findUniqueOrThrow({where:{id:changing.role.id}})).version===2);
  stage='permission edits cannot widen an existing grantor ceiling';
  const extended=['roles.view','roles.manage','employees.view','departments.view','payroll.view','vouchers.post'];
  const independentDelegate=await service.request(request('DELEGATE',{permissions:extended,expiresAt:new Date(Date.now()+3600000).toISOString()}),reviewer.id);
  await service.decide(independentDelegate.id,{command:'APPROVE',expectedVersion:1,reason:'Independent MD broader technical delegation'},md.id);
  const widen=await service.request(request('ROLE_EDIT',{roleId:reader.role.id,name:'Reader with protected financial prerequisite',isActive:true,permissions:['employees.view','departments.view','payroll.view','vouchers.post']},1),reviewer.id);
  ok(widen.status==='PENDING');ok((await http('/employees')).status===200);
  await service.decide(widen.id,{command:'APPROVE',expectedVersion:1,reason:'MD reviews broader role'},md.id);
  ok((await http('/employees')).status===403);ok(!(await service.access(viewer.id)).permissions.includes('vouchers.post'));
  const narrow=await service.request(request('ROLE_EDIT',{roleId:reader.role.id,name:'Global Employee Reader',isActive:true,permissions:['employees.view','departments.view','payroll.view']},2),reviewer.id);
  await service.decide(narrow.id,{command:'APPROVE',expectedVersion:1,reason:'MD restores role within original grant ceiling'},md.id);ok((await http('/employees')).status===200);
  const verifyRootRevocation=async()=>{const revokeToken=randomBytes(32).toString('hex');await maintenance.authorityBootstrap.create({data:{companyId:c.parent.id,targetUserId:md.id,authorizerId:reviewer.id,tokenHash:createHash('sha256').update(revokeToken).digest('hex'),expiresAt:new Date(Date.now()+60000),purpose:'REVOKE',provenance:{provider:'isolated-revocation-ceremony',technicalOnly:true}}});await executor.execute(md.id,'BOOTSTRAP',{ticketToken:revokeToken});ok((await service.access(md.id)).permissions.length===0);ok((await service.access(actor.id)).permissions.length===0);console.log(`PASS ${checks} total MD authority PostgreSQL assertions including root/downstream revocation; no automatic replacement or reusable capability`);};
  console.log(`PASS ${checks} actual PostgreSQL MD authority assertions: one-time independent capability, restricted writer, ceilings, MD routing, self-elevation denial, concurrent approval, revocation, immutable history and audit rollback; synthetic authority only`);
  if(process.argv.includes('--authority-db-only')){await verifyRootRevocation();return;}
  stage='authority browser';const f={...fixture,mdEmail:md.email,mdPassword,workerEmail:worker.email,workerId:worker.id,viewerEmail:viewer.email,viewerPassword,roleId:role.id};
  const template=readFileSync('scripts/authority-browser-scenario.js','utf8');writeFileSync(join(temp,'authority-scenario.js'),template.replace('__FIXTURE__',JSON.stringify(f)));console.log('AUTHORITY_BROWSER_SCENARIO '+join(temp,'authority-scenario.js'));
  const resultFile=join(temp,'authority-result.json');for(let n=0;n<600&&!existsSync(resultFile);n++)await new Promise(r=>setTimeout(r,1000));assert(existsSync(resultFile));const result=JSON.parse(readFileSync(resultFile,'utf8'));assert.equal(result.status,'PASS');console.log(`PASS ${result.checks} authenticated MD/AGM Role Management browser/API assertions`);await verifyRootRevocation();
 }catch(e:any){console.error('AUTHORITY_ACCEPTANCE_STAGE '+stage+' '+JSON.stringify({type:e?.name,code:e?.code,sqlCode:e?.cause?.originalCode??e?.cause?.code,adapterCode:e?.meta?.driverAdapterError?.cause?.originalCode}));throw e;}finally{if(maintenance)await maintenance.$disconnect();if(pool)await pool.end();await owner.end();await admin.end();}
}
