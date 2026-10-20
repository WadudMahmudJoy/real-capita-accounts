import {apiFetch} from './api';
export type UserAccess={systemAdmin:boolean;hrAdmin:boolean;employee:boolean};
export type ManagedUser={id:string;email:string;fullName:string;isActive:boolean;adminVersion:number;onboardingPending?:boolean;roles:{role:{code:string;name:string}}[];hrPermissions:{id:string;code:string;grantedAt:string;expiresAt:string|null;revokedAt:string|null}[];employeeBindings:{id:string;employeeId:string;verifiedAt:string;unboundAt:string|null;employee:{employeeCode:string;fullName:string}}[];history?:{id:string;actorId:string;action:string;createdAt:string}[]};
export type EmployeeOption={id:string;employeeCode:string;fullName:string;department:{id:string;name:string}|null};
export const userAccess=()=>apiFetch<UserAccess>('/users/access');
export const managedUsers=(page:number,search:string,status:string)=>apiFetch<{items:ManagedUser[];total:number}>(`/users?page=${page}&search=${encodeURIComponent(search)}&${status?`status=${status}`:''}`);
export const managedUser=(id:string)=>apiFetch<ManagedUser>(`/users/${encodeURIComponent(id)}`);
export const createUser=(input:{email:string;fullName:string;password:string;reason:string})=>apiFetch<ManagedUser>('/users',{method:'POST',body:input});
export const createPendingUser=(input:{email:string;fullName:string;reason:string})=>apiFetch<ManagedUser>('/users/pending',{method:'POST',body:input});
export const userAction=(id:string,input:Record<string,unknown>)=>apiFetch<ManagedUser>(`/users/${encodeURIComponent(id)}/actions`,{method:'POST',body:input});
export const employeeOptions=(search:string,page=1)=>apiFetch<EmployeeOption[]>(`/users/employee-options?page=${page}&search=${encodeURIComponent(search)}`);
export type LeaveCategory={id:string;code:string;name:string;description:string|null;isActive:boolean;version:number};
export const categories=(page:number,search:string,status:string)=>apiFetch<{items:LeaveCategory[];total:number}>(`/leave-requests/categories?page=${page}&search=${encodeURIComponent(search)}&${status?`status=${status}`:''}`);
export const saveCategory=(id:string|null,input:Record<string,unknown>)=>apiFetch<LeaveCategory>(`/leave-requests/categories${id?'/'+encodeURIComponent(id):''}`,{method:'POST',body:input});

export type AdminHistory={id:string;actorId:string;action:string;createdAt:string;snapshot:unknown};
export const userHistory=(id:string,page:number)=>apiFetch<{items:AdminHistory[];total:number}>(`/users/${encodeURIComponent(id)}/history?page=${page}`);
export type CategoryHistory={id:string;actorId:string|null;action:string;createdAt:string;before:{name:string;isActive:boolean}|null;after:{name:string;isActive:boolean}|null};
export const categoryHistory=(id:string,page:number)=>apiFetch<{items:CategoryHistory[];total:number}>(`/leave-requests/categories/${encodeURIComponent(id)}/history?page=${page}`);
