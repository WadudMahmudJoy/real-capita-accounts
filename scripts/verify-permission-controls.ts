import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const web=createRequire(resolve('apps/web/package.json'));
async function main(){
 const React=web('react'),{renderToStaticMarkup}=web('react-dom/server');
 const {WorkspacePermissions,PermissionButton,Permit}=await import('../apps/web/src/app/app/_components/permission-controls');
 const render=(permissions:string[]|null,code:string)=>renderToStaticMarkup(React.createElement(WorkspacePermissions.Provider,{value:permissions},React.createElement(PermissionButton,{permission:code},'Sensitive action')));
 const codes=['users.create','employees.create','employees.edit','attendance.edit','attendance.approve','attendance.manage','salary.manage','salary.approve','accounting.manage','company.manage','projects.create','projects.edit','cost-centers.edit','payroll.create','payroll.approve','vouchers.create','vouchers.post','vouchers.delete','vouchers.reverse'];
 let checks=0;
 for(const code of codes){assert.equal(render([],code),'');checks++;assert.match(render([code],code),/Sensitive action/);checks++;assert.match(render(null,code),/Sensitive action/);checks++;}
 const document=renderToStaticMarkup(React.createElement(WorkspacePermissions.Provider,{value:['payroll.view']},React.createElement(Permit,{code:'payroll.documents.view'},'Historical document')));assert.equal(document,'');checks++;
 console.log(`PASS ${checks} rendered permission-control assertions; denied actions omitted, explicit grants visible and legacy presentation preserved; no server authorization or database mocked as acceptance`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
