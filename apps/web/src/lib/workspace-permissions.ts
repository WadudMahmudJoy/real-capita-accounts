// UI affordances only. AuthGuard and specialized services enforce authority.
export function workspacePermission(path:string){
 if(path==='/app')return 'dashboard.view';
 if(path.startsWith('/app/roles'))return 'roles.view';
 if(path.startsWith('/app/employees/attendance'))return 'attendance.view';
 if(path.startsWith('/app/employees/work-schedules'))return 'schedules.view';
 if(path.startsWith('/app/employees'))return 'employees.view';
 if(path.startsWith('/app/users'))return 'users.view';
 if(path.startsWith('/app/leave-categories'))return 'leave.categories.manage';
 if(path.startsWith('/app/leave-'))return 'leave.view';
 if(path==='/app/payroll-runs/new')return 'payroll.preview';
 if(path.startsWith('/app/payroll-runs'))return /payslip|salary-sheet/.test(path)?'payroll.documents.view':path.includes('payment-preparation')?'payroll.preparation.view':'payroll.view';
 if(path==='/app/salary-preview')return 'salary.preview';
 if(path.startsWith('/app/salary-'))return 'salary.view';
 if(path.startsWith('/app/projects'))return 'projects.view';
 if(path.startsWith('/app/cost-centers'))return 'cost-centers.view';
 if(path.startsWith('/app/vouchers'))return path.endsWith('/new')?'vouchers.create':'vouchers.view';
 if(path.startsWith('/app/reports'))return 'reports.view';
 if(path.startsWith('/app/company'))return 'company.view';
 if(['/app/customers','/app/bookable-items','/app/bookings'].some(p=>path.startsWith(p)))return 'bookings.view';
 if(['/app/accounts','/app/cash-bank','/app/fiscal-years','/app/accounting-periods'].some(p=>path.startsWith(p)))return 'accounting.view';
 return null;
}
