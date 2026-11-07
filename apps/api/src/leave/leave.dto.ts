import {Type} from 'class-transformer';
import {IsInt,IsOptional,IsString,Matches,Max,MaxLength,Min,MinLength,IsIn} from 'class-validator';
export class SubmitLeaveDto {
 @IsString() @MinLength(1) @MaxLength(128) employeeId!:string;
 // A Company record may be supplied only as optional reporting context.
 // companyId is deliberately absent: HTTP whitelist rejects ownership claims.
 @IsOptional() @IsString() @MinLength(1) @MaxLength(128) officeContextCompanyId?:string;
 @IsString() @MinLength(1) @MaxLength(128) categoryId!:string;
 @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!:string;
 @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate!:string;
 @IsString() @MinLength(1) @MaxLength(1000) reason!:string;
 @IsOptional() @IsString() @MaxLength(500) supportingReference?:string;
 @IsString() @MinLength(8) @MaxLength(128) idempotencyKey!:string;
}
export class WithdrawLeaveDto {@Type(()=>Number) @IsInt() @Min(1) expectedVersion!:number;}
export class LeaveQueryDto {
 @IsOptional() @IsString() @MaxLength(128) employeeId?:string;
 @IsOptional() @IsString() @MaxLength(128) officeId?:string;
 @IsOptional() @IsString() @MaxLength(128) departmentId?:string;
 @IsOptional() @IsString() @MaxLength(128) categoryId?:string;
 @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?:string;
 @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?:string;

 @Type(()=>Number) @IsInt() @Min(1) page=1;
 @Type(()=>Number) @IsInt() @Min(1) @Max(100) pageSize=20;
 @IsOptional() @IsString() @MaxLength(100) search?:string;
 @IsOptional() @IsIn(['SUBMITTED','PENDING_HR_REVIEW','PENDING_MD_DECISION','WITHDRAWN','APPROVED','REJECTED']) status?:'SUBMITTED'|'PENDING_HR_REVIEW'|'PENDING_MD_DECISION'|'WITHDRAWN'|'APPROVED'|'REJECTED';
}

export class DecideLeaveDto extends WithdrawLeaveDto {
 @IsIn(['APPROVED','REJECTED']) decision!: 'APPROVED'|'REJECTED';
 @IsString() @MinLength(1) @MaxLength(1000) reason!:string;
}

export class LeaveStageInputDto extends WithdrawLeaveDto {
 @IsIn(['RECOMMEND_APPROVAL','RECOMMEND_REJECTION','APPROVED','REJECTED']) decision!:string;
 @IsString() @Matches(/\S/) @MinLength(1) @MaxLength(1000) reason!:string;
 @IsString() @MinLength(8) @MaxLength(128) idempotencyKey!:string;
}

export class RecommendLeaveDto extends LeaveStageInputDto {
 @IsIn(['RECOMMEND_APPROVAL','RECOMMEND_REJECTION']) declare decision:string;
}
export class MdDecideLeaveDto extends LeaveStageInputDto {
 @IsIn(['APPROVED','REJECTED']) declare decision:string;
}
