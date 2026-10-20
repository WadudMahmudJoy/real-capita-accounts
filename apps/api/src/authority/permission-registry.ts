// Permissions select implemented operations; scopes are fixed by existing services.
// Financial/HR prerequisites remain mandatory in addition to these permissions.
export type PermissionScope = 'PRIMARY'|'GLOBAL_EMPLOYEE'|'OFFICE'|'FISCAL_YEAR'|'SELF';
const operation=(code:string,label:string,module:string,scope:PermissionScope,prerequisite='Existing record and company authorization')=>({code,label,module,scope,prerequisite,assignable:true,delegable:true});
export const PERMISSION_REGISTRY=[
 operation('dashboard.view','View workspace','Dashboard','OFFICE'),
 operation('roles.view','View managed roles and history','Role Management','PRIMARY'),
 {code:'roles.manage',label:'Manage roles within an MD mandate',module:'Role Management',scope:'PRIMARY' as const,prerequisite:'Explicit MD mandate',assignable:false,delegable:true},
 {code:'authority.review',label:'Review protected authority requests (MD only)',module:'Protected authority',scope:'PRIMARY' as const,prerequisite:'Independent MD',assignable:false,delegable:false},
 {code:'authority.delegate',label:'Authorize delegation (MD only)',module:'Protected authority',scope:'PRIMARY' as const,prerequisite:'MD',assignable:false,delegable:false},
 ...['view','create','manage'].map(a=>operation(`users.${a}`,`${a} users`,'Users','PRIMARY','Explicit SYSTEM_ADMIN; protected elevation remains MD-routed')),
 ...['view','create','edit'].map(a=>operation(`employees.${a}`,`${a} global employees`,'Employee','GLOBAL_EMPLOYEE')),
 ...['view','create','edit'].map(a=>operation(`departments.${a}`,`${a} departments`,'Employee','GLOBAL_EMPLOYEE')),
 ...['view','edit','approve','manage'].map(a=>operation(`attendance.${a}`,`${a} attendance`,'Attendance','OFFICE','ACCOUNTANT; existing finalization/correction rules')),
 ...['view','manage'].map(a=>operation(`schedules.${a}`,`${a} work schedules`,'Attendance','OFFICE','ACCOUNTANT')),
 ...['view','create','withdraw'].map(a=>operation(`leave.${a}`,`${a} permitted leave requests`,'Leave','SELF','Verified binding for own records; HR_ADMIN for other employees')),
 operation('leave.review','View HR leave review queue','Leave','PRIMARY','Explicit HR_ADMIN'),
 operation('leave.recommend','Recommend approval or rejection as HR','Leave','PRIMARY','Explicit HR_ADMIN; independent employee reviewer'),
 operation('leave.history.view','Read permitted leave decision history','Leave','SELF','Verified own binding; separate HR or MD request scope'),
 {code:'leave.md.view',label:'View pending MD leave decisions',module:'Leave',scope:'PRIMARY' as const,prerequisite:'Live explicit MD authority',assignable:false,delegable:false},
 {code:'leave.finalize',label:'Final MD leave approval or rejection',module:'Leave',scope:'PRIMARY' as const,prerequisite:'Independent MD after mandatory HR recommendation',assignable:false,delegable:false},
 operation('leave.categories.manage','Configure leave categories','Leave','PRIMARY','Explicit HR_ADMIN'),
 ...['view','preview','create','approve'].map(a=>operation(`payroll.${a}`,`${a} monthly payroll`,'Payroll','PRIMARY','ACCOUNTANT; approved sources, attendance and independent maker-checker')),
 operation('payroll.documents.view','View approved payslips and salary sheets','Payroll documents','PRIMARY','ACCOUNTANT; APPROVED historical records'),
 operation('payroll.preparation.view','View planned bank/cash allocations','Payment preparation','PRIMARY','ACCOUNTANT; not disbursed'),
 operation('payroll.batches.create','Prepare payment instructions','Payment preparation','PRIMARY','ACCOUNTANT; independently authorized source; no confirmation authority'),
 ...['view','manage','approve','preview'].map(a=>operation(`salary.${a}`,`${a} salary configuration`,'Salary','GLOBAL_EMPLOYEE','ACCOUNTANT; existing source approval contracts')),
 ...['view','create','edit'].map(a=>operation(`projects.${a}`,`${a} projects`,'Projects','GLOBAL_EMPLOYEE','ACCOUNTANT')),
 ...['view','create','edit'].map(a=>operation(`cost-centers.${a}`,`${a} cost centers`,'Cost Centers','GLOBAL_EMPLOYEE','ACCOUNTANT')),
 ...['view','create','edit','delete','post','reverse'].map(a=>operation(`vouchers.${a}`,`${a} vouchers`,'Vouchers','FISCAL_YEAR','ACCOUNTANT; period, posting and reversal validation')),
 operation('reports.view','View accounting reports','Accounting reports','FISCAL_YEAR','ACCOUNTANT; owning fiscal year'),
 ...['view','manage'].map(a=>operation(`accounting.${a}`,`${a} accounting setup`,'Accounting setup','OFFICE','ACCOUNTANT')),
 ...['view','manage'].map(a=>operation(`company.${a}`,`${a} office setup`,'Company','OFFICE','ACCOUNTANT')),
 ...['view','manage'].map(a=>operation(`bookings.${a}`,`${a} customer booking control`,'Customers and bookings','FISCAL_YEAR','ACCOUNTANT; existing booking controls')),
];
export function validatePermissionSelection(values:string[]){
 if(new Set(values).size!==values.length||values.some(code=>!PERMISSION_REGISTRY.some(p=>p.code===code&&p.assignable)))throw new Error('Unknown, duplicate or protected permission.');
 return [...values].sort();
}
// Resolved from Nest route metadata, never caller-supplied URLs or permission labels.
export function routePermission(controller:string,handler:string,method:string):string|null {
 const path=[controller,handler].filter(Boolean).join('/').replace(/^\/+|\/+$/g,'');
 const read=method==='GET',root=path.split('/')[0];
 if(root==='employees'){
  if(/salary-assignments|payment-profiles/.test(path))return read?'salary.view':'salary.manage';
  return read?'employees.view':method==='POST'?'employees.create':'employees.edit';
 }
 if(root==='departments')return read?'departments.view':method==='POST'?'departments.create':'departments.edit';
 if(root==='attendance')return read?'attendance.view':path.endsWith('/finalize')?'attendance.approve':/policies|calendar/.test(path)?'attendance.manage':'attendance.edit';
 if(root==='work-schedules')return read?'schedules.view':'schedules.manage';
 if(root==='payroll-runs'){
  if(path.endsWith('/confirm'))return null; // Dedicated private evidence boundary; no generic grant enables it.
  if(path.includes('payslips')||path.endsWith('/salary-sheet'))return 'payroll.documents.view';
  if(path.endsWith('/payment-preparation'))return 'payroll.preparation.view';
  if(path==='payroll-runs/payment-batches')return 'payroll.batches.create';
  return read?'payroll.view':path.endsWith('/approve')?'payroll.approve':path.endsWith('/preview')?'payroll.preview':'payroll.create';
 }
 if(root==='users')return path==='users/access'?null:read?'users.view':path==='users'||path==='users/pending'?'users.create':'users.manage';
 if(root==='leave-requests'){
  if(path.endsWith('/capabilities'))return null;
  if(path.endsWith('/filter-options'))return null; // Service requires explicit HR or protected MD; no request data returned.
  if(path.includes('categories'))return 'leave.categories.manage';
  if(path.endsWith('/decision')||path.endsWith('/md-decision'))return 'leave.finalize';
  if(path.endsWith('/employee-options'))return 'leave.create';
  if(path.endsWith('/recommendation'))return 'leave.recommend';
  if(path.endsWith('/md-queue'))return 'leave.md.view';
  if(path.endsWith('/history'))return 'leave.history.view';
  if(path.endsWith('/review-queue'))return 'leave.review';
  return read?'leave.view':path.endsWith('/withdraw')?'leave.withdraw':'leave.create';
 }
 if(['salary-structures','salary-assignments','payment-profiles','salary-calculations'].includes(root))return read?'salary.view':path.endsWith('/approve')?'salary.approve':root==='salary-calculations'?'salary.preview':'salary.manage';
 if(root==='projects'||root==='cost-centers')return `${root}.${read?'view':method==='POST'?'create':'edit'}`;
 if(root==='vouchers')return `vouchers.${read?'view':method==='DELETE'?'delete':path.endsWith('/post')?'post':path.endsWith('/reversal')?'reverse':method==='POST'?'create':'edit'}`;
 if(root==='reports')return 'reports.view';
 if(['ledger-accounts','account-classes','account-groups','cash-bank-accounts','fiscal-years','accounting-periods'].includes(root))return read?'accounting.view':'accounting.manage';
 if(root==='company'||root==='company-media')return read||path.endsWith('/switch')?'company.view':'company.manage';
 if(['customers','bookings','bookable-items'].includes(root))return read?'bookings.view':'bookings.manage';
 return null;
}
