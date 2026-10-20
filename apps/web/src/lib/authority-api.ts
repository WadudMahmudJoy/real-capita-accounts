import {apiFetch} from './api';
import {protectedOnboardingCommand} from './onboarding-api';
export type AuthorityAccess={status:string;activated:boolean;permissions:string[];allowedPermissions?:string[];delegationCeiling:string[];registry:{code:string;label:string;module:string;scope:string;prerequisite:string;assignable:boolean}[];reason:string};
export type ManagedRole={id:string;code:string;name:string;description:string|null;isActive:boolean;version:number;permissionCodes:string[]};
export type AuthorityGrant={id:string;userId:string;version:number;expiresAt:string|null;revokedAt:string|null;role:{id:string;code:string}};
export type AuthorityRequest={id:string;actorId:string;reviewerId:string|null;operation:string;payload:Record<string,unknown>;status:string;version:number;expectedVersion:number;reason:string;decisionReason:string|null;expiresAt:string};
export const authorityAccess=()=>apiFetch<AuthorityAccess>('/authority/access');
export const authorityRoles=(page:number,search:string)=>apiFetch<{items:ManagedRole[];total:number}>(`/authority/roles?page=${page}&search=${encodeURIComponent(search)}`);
export const authorityGrants=(page:number)=>apiFetch<AuthorityGrant[]>(`/authority/grants?page=${page}`);
export const authorityRequests=(page:number,status:string)=>apiFetch<{items:AuthorityRequest[];total:number}>(`/authority/requests?page=${page}&status=${encodeURIComponent(status)}`);
export const requestAuthority=(input:Record<string,unknown>)=>protectedOnboardingCommand<Record<string,unknown>>('AUTHORITY_REQUEST',input);
export const decideAuthority=(id:string,input:Record<string,unknown>)=>{
  const {command,expectedVersion,reason}=input;
  return protectedOnboardingCommand<Record<string,unknown>>(`AUTHORITY_${String(command)}`,{requestId:id,expectedVersion,reason});
};
export const authorityHistory=(id:string)=>apiFetch<{id:string;actorId:string;action:string;snapshot:unknown;createdAt:string}[]>(`/authority/history/${encodeURIComponent(id)}`);
