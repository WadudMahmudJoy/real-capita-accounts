import assert from 'node:assert/strict';

type SyntheticPerson={id:string;employee:{id:string};session:{cookie:string}};
type ReadContext={base:string;agm:SyntheticPerson;worker:SyntheticPerson;hr:SyntheticPerson};

// Invoke after the existing synthetic MD-approved AGM mandate includes
// employees.view, attendance.view, payroll.view, accounting.view and projects.view.
// No fixtures, login attempts, writes, delegation changes or document grants.
export async function verifyOnboardingReads({base,agm,worker,hr}:ReadContext):Promise<number>{
 const origin=new URL(base);assert(origin.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(origin.hostname),'Synthetic HTTP acceptance requires the local fixture server.');
 let checks=0;
 const get=async(person:SyntheticPerson,path:string,status:200|403)=>{
  const response=await fetch(new URL(path,origin),{headers:{Cookie:person.session.cookie},redirect:'error'});
  assert.equal(response.status,status,`Authenticated read ${path} must return ${status}`);checks++;
  return response.json();
 };
 for(const person of [agm,worker,hr]){
  const session=await get(person,'/auth/me',200);assert.equal(session.user.id,person.id,'Reads use the intended individually authenticated synthetic identity.');checks++;
 }
 const detail='/employees/'+encodeURIComponent(worker.employee.id);
 const history='/attendance/history?from=2026-01-01&to=2026-01-01&employeeId='+encodeURIComponent(worker.employee.id);
 const routes=['/employees',detail,history,'/payroll-runs','/ledger-accounts','/projects'];
 for(const route of routes){
  const body=await get(agm,route,200);
  if(route===detail)assert.equal(body.id,worker.employee.id,'Employee detail preserves its global identity.');
  else if(route==='/payroll-runs'){assert(Array.isArray(body.items));assert.equal(body.total,0,'Read smoke must not fabricate a Payroll run.');}
  else assert(Array.isArray(body),`Expected collection response for ${route}`);
  checks++;
  await get(worker,route,403);
 }
 // An approved ACCOUNTANT grant plus payroll.view still does not imply the
 // separate payroll.documents.view permission. Denial precedes run discovery.
 const payslip='/payroll-runs/synthetic-unapproved-run/payslips/'+encodeURIComponent(worker.employee.id);
 for(const person of [agm,worker,hr])await get(person,payslip,403);
 await get(hr,detail,403);await get(hr,'/payroll-runs',403);
 console.log(`PASS ${checks} authenticated read/denial assertions: Employee list/detail, Attendance history, empty Payroll list, Accounting ledger, Project list and payslip boundaries; GET requests only`);
 return checks;
}
