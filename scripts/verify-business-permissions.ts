import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const req=createRequire(resolve('apps/api/package.json'));req('reflect-metadata');
async function main(){
 const {PERMISSION_REGISTRY,routePermission}=await import('../apps/api/src/authority/permission-registry');
 const {businessAuthority,enforceBusinessPermission}=await import('../apps/api/src/auth/business-permissions');
 const {RolesGuard}=await import('../apps/api/src/auth/guards/roles.guard');
 let checks=0;const check=(v:boolean)=>{assert(v);checks++;};
 for(const [controller,handler,method,code] of [
  ['employees','','GET','employees.view'],['employees',':id','PATCH','employees.edit'],
  ['','employees/:employeeId/salary-assignments','POST','salary.manage'],
  ['attendance','finalize','POST','attendance.approve'],['attendance/calendar','exceptions','POST','attendance.manage'],
  ['payroll-runs','preview','POST','payroll.preview'],['payroll-runs',':id/approve','POST','payroll.approve'],
  ['payroll-runs',':id/payslips/:employeeId','GET','payroll.documents.view'],
  ['vouchers',':id/post','POST','vouchers.post'],['vouchers',':id/reversal','POST','vouchers.reverse'],
  ['projects','','POST','projects.create'],['cost-centers',':id','PATCH','cost-centers.edit'],
  ['users',':id/actions','POST','users.manage'],['leave-requests',':id/decision','POST','leave.finalize'],
  ['leave-requests','categories','GET','leave.categories.manage'],['reports','ledger','GET','reports.view'],
  ['account-classes','','GET','accounting.view'],['','salary-structures/:id/approve','POST','salary.approve'],
 ]){check(routePermission(controller,handler,method)===code);check(PERMISSION_REGISTRY.some(p=>p.code===code));}
 check(routePermission('payroll-runs','payment-batches/:id/confirm','POST')===null);
 check(!PERMISSION_REGISTRY.some(p=>p.code.startsWith('bills.')||p.code.endsWith('.export')));
 let mode='absent',codes:string[]=[];let reads=0;
 const db:any={$queryRaw:async()=>{reads++;if(reads%2===1||mode==='absent')return [{installed:mode==='absent'?null:'authority_mandates'}];return [{activated:mode==='active',permissions:codes}];},employeeAccountBinding:{findFirst:async()=>null}};
 const reset=(next:string)=>{mode=next;reads=0;};
 check((await businessAuthority(db,'actor')).activated===false);
 reset('absent');check(await enforceBusinessPermission(db,'actor','employees','','GET')===undefined);
 reset('installed');check(await enforceBusinessPermission(db,'actor','employees','','GET')===undefined);
 reset('active');await assert.rejects(()=>enforceBusinessPermission(db,'actor','employees','','GET'),(e:any)=>e.getStatus()===403);checks++;
 reset('active');codes=['employees.view'];check(await enforceBusinessPermission(db,'actor','employees','','GET')==='employees.view');
 reset('active');await assert.rejects(()=>enforceBusinessPermission(db,'actor','employees',':id','PATCH'));checks++;
 reset('active');db.employeeAccountBinding.findFirst=async()=>({employeeId:'own'});check(await enforceBusinessPermission(db,'actor','leave-requests','','GET')==='leave.view');
 reset('active');await assert.rejects(()=>enforceBusinessPermission(db,'actor','leave-requests','review-queue','GET'));checks++;
 reset('active');db.$queryRaw=async()=>{throw Error('Database unavailable');};await assert.rejects(()=>businessAuthority(db,'actor'));checks++;
 const guard=new RolesGuard({getAllAndOverride:()=>['ACCOUNTANT']} as any);
 const context=(permission:string)=>({getHandler:()=>()=>null,getClass:()=>class{},switchToHttp:()=>({getRequest:()=>({user:{roles:[]},businessPermission:permission})})}) as any;
 check(guard.canActivate(context('employees.view')));check(guard.canActivate(context('departments.view')));
 assert.throws(()=>guard.canActivate(context('payroll.approve')));checks++;
 assert.throws(()=>guard.canActivate(context('vouchers.post')));checks++;
 console.log(`PASS ${checks} offline granular permission, pre-MD compatibility, privacy, route and specialized-role assertions; no database connection`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
