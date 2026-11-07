import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const req=createRequire(resolve('apps/api/package.json'));req('reflect-metadata');
async function main(){
 const {PERMISSION_REGISTRY,validatePermissionSelection}=await import('../apps/api/src/authority/permission-registry');
 assert.equal(new Set(PERMISSION_REGISTRY.map(p=>p.code)).size,PERMISSION_REGISTRY.length);
 assert.throws(()=>validatePermissionSelection(['invented.manage']));
 assert.throws(()=>validatePermissionSelection(['authority.review']));
 assert.throws(()=>validatePermissionSelection(['roles.view','roles.view']));
 assert.deepEqual(validatePermissionSelection(['roles.view']),['roles.view']);
 const {AuthorityWriter,MdClaimVerifier}=await import('../apps/api/src/authority/authority-writer');
 await assert.rejects(()=>new AuthorityWriter().execute('actor','BOOTSTRAP',{}),(e:any)=>e.getStatus()===503);
 await assert.rejects(()=>new MdClaimVerifier().verify('actor','claimed reference'),(e:any)=>e.getStatus()===503);
 const {EmployeeService}=await import('../apps/api/src/employee/employee.service');
 const protectedEmployee=new EmployeeService({$transaction:()=>Promise.reject({cause:{originalCode:'42501'}})} as any);
 await assert.rejects(()=>protectedEmployee.update('md-employee',{isActive:false},{id:'actor',email:'fixture@example.invalid',fullName:'Fixture',roles:[{code:'ACCOUNTANT',name:'Accountant'}]}),(e:any)=>e.getStatus?.()===403);
 console.log('PASS canonical permission selection, protected/nonexistent permission denial and unconfigured MD verification/private writer fail-closed; no database writes');
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Authority contract failed');process.exitCode=1;});
