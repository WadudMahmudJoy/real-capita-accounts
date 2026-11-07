import {apiFetch} from './api';
import {protectedOnboardingCommand} from './onboarding-api';
export type LeaveStageDecision={id?:string;actorId?:string;actorName:string|null;decision:string;reason?:string;createdAt:string;requestVersion?:number};
export type LeaveOwner={id:string;name:string;marker:'PRIMARY'};
export type LeaveCapabilities={owningCompany:LeaveOwner;status:'AVAILABLE'|'BLOCKED';canReview:boolean;canDecide?:boolean;canRecommend?:boolean;canFinalize?:boolean;canMdReview?:boolean;workflowInstalled?:boolean;ownLeaveBlocked?:boolean;canManageCategories:boolean;canSubmitOnBehalf:boolean;offices:{id:string;name:string}[];employee:{id:string;employeeCode:string;fullName:string;department:{name:string}|null}|null;categories:{id:string;name:string;code:string}[];blockers:string[]};
export type LeaveItem={id:string;employeeId:string;employeeCode:string;fullName:string;department:string|null;owningCompany:LeaveOwner;officeContext:{companyId:string;name:string;reportingOnly:true;assignmentVerified:false}|null;office:string|null;category:string;startDate:string;endDate:string;status:'SUBMITTED'|'PENDING_HR_REVIEW'|'PENDING_MD_DECISION'|'LEGACY_PENDING_BLOCKED'|'WITHDRAWN'|'APPROVED'|'REJECTED';workflowOrigin?:string;finalDecisionAuthority?:string|null;hrRecommendation?:LeaveStageDecision|null;mdDecision?:LeaveStageDecision|null;reviewedAt?:string|null;reviewerName?:string|null;decisionReason?:string|null;version:number;reason?:string;supportingReference?:string|null;history?:{action:string;version:number;createdAt:string}[]};
export const leaveCapabilities=()=>apiFetch<LeaveCapabilities>('/leave-requests/capabilities');
export const submitLeave=(input:{employeeId:string;categoryId:string;startDate:string;endDate:string;reason:string;supportingReference?:string;officeContextCompanyId?:string;idempotencyKey:string})=>apiFetch<LeaveItem>('/leave-requests',{method:'POST',body:input});
export const listLeave=(page:number,search:string,status:string,review=false,filters:Record<string,string>={},md=false)=>apiFetch<{items:LeaveItem[];total:number;pageSize:number}>(`/leave-requests${md?'/md-queue':review?'/review-queue':''}?page=${page}&pageSize=20${search?`&search=${encodeURIComponent(search)}`:''}${status?`&status=${status}`:''}${Object.entries(filters).filter(([,v])=>v).map(([k,v])=>`&${k}=${encodeURIComponent(v)}`).join('')}`);
export const getLeave=(id:string)=>apiFetch<LeaveItem>(`/leave-requests/${encodeURIComponent(id)}`);
export const withdrawLeave=(id:string,version:number)=>apiFetch<LeaveItem>(`/leave-requests/${encodeURIComponent(id)}/withdraw`,{method:'POST',body:{expectedVersion:version}});

export const decideLeave=(id:string,expectedVersion:number,decision:'APPROVED'|'REJECTED',reason:string)=>apiFetch<LeaveItem>(`/leave-requests/${encodeURIComponent(id)}/decision`,{method:'POST',body:{expectedVersion,decision,reason}});

export const leaveFilterOptions=()=>apiFetch<{departments:{id:string;name:string}[];offices:{id:string;name:string}[];categories:{id:string;name:string}[]}>('/leave-requests/filter-options');

export const recommendLeave=(id:string,expectedVersion:number,decision:'RECOMMEND_APPROVAL'|'RECOMMEND_REJECTION',reason:string,idempotencyKey:string)=>protectedOnboardingCommand<LeaveItem>('LEAVE_HR',{requestId:id,expectedVersion,decision,reason,idempotencyKey});
export const finalizeLeave=(id:string,expectedVersion:number,decision:'APPROVED'|'REJECTED',reason:string,idempotencyKey:string)=>protectedOnboardingCommand<LeaveItem>('LEAVE_MD',{requestId:id,expectedVersion,decision,reason,idempotencyKey});

export const leaveEmployeeOptions=(search:string,page:number)=>apiFetch<import('./hr-admin-api').EmployeeOption[]>(`/leave-requests/employee-options?search=${encodeURIComponent(search)}&page=${page}`);
