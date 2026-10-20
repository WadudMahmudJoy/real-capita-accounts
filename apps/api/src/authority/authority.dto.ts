import {Type} from 'class-transformer';
import {IsArray,IsBoolean,IsIn,IsInt,IsISO8601,IsObject,IsOptional,IsString,Matches,Max,MaxLength,Min,MinLength} from 'class-validator';
import {PERMISSION_REGISTRY} from './permission-registry';
export class AuthorityQueryDto {
 @Type(()=>Number) @IsInt() @Min(1) page=1;
 @Type(()=>Number) @IsInt() @Min(1) @Max(100) pageSize=20;
 @IsOptional() @IsString() @MaxLength(100) search?:string;
 @IsOptional() @IsIn(['PENDING','APPLIED','APPROVED','REJECTED','CANCELLED','EXPIRED']) status?:string;
}
export class AuthorityPayloadDto {
 @IsOptional() @IsString() @MaxLength(128) roleId?:string;
 @IsOptional() @IsString() @MaxLength(128) grantId?:string;
 @IsOptional() @IsString() @MaxLength(128) mandateId?:string;
 @IsOptional() @Matches(/^[A-Z][A-Z0-9_]{1,31}$/) code?:string;
 @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?:string;
 @IsOptional() @IsString() @MaxLength(1000) description?:string;
 @IsOptional() @IsBoolean() isActive?:boolean;
 @IsOptional() @IsArray() @IsIn(PERMISSION_REGISTRY.filter(p=>p.delegable).map(p=>p.code),{each:true}) permissions?:string[];
 @IsOptional() @IsString() @MaxLength(128) targetUserId?:string;
 @IsOptional() @IsISO8601() expiresAt?:string;
}
export class AuthorityRequestDto {
 @IsIn(['DELEGATE','DELEGATE_REVOKE','ROLE_CREATE','ROLE_EDIT','ROLE_ASSIGN','ROLE_REVOKE']) operation!:string;
 @IsObject() payload!:Record<string,unknown>;
 @IsInt() @Min(0) expectedVersion!:number;
 @IsString() @MinLength(16) @MaxLength(128) idempotencyKey!:string;
 @IsString() @MinLength(1) @MaxLength(1000) reason!:string;
 @IsISO8601() expiresAt!:string;
}
export class AuthorityDecisionDto {
 @IsIn(['APPROVE','REJECT','CANCEL','EXPIRE']) command!:string;
 @IsInt() @Min(1) expectedVersion!:number;
 @IsString() @MinLength(1) @MaxLength(1000) reason!:string;
}
export class MdClaimDto {
 @IsString() @MinLength(1) @MaxLength(256) claimReference!:string;
}
