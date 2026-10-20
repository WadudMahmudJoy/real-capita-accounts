import {Type} from 'class-transformer';
import {IsBoolean,IsEmail,IsIn,IsInt,IsISO8601,IsOptional,IsString,Max,MaxLength,Min,MinLength} from 'class-validator';
export class UserQueryDto {
 @Type(()=>Number) @IsInt() @Min(1) page=1;
 @Type(()=>Number) @IsInt() @Min(1) @Max(100) pageSize=20;
 @IsOptional() @IsString() @MaxLength(100) search?:string;
 @IsOptional() @IsIn(['ACTIVE','INACTIVE']) status?:'ACTIVE'|'INACTIVE';
}
export class PendingUserDto {
 @IsEmail() @MaxLength(254) email!:string;
 @IsString() @MinLength(1) @MaxLength(150) fullName!:string;
 @IsString() @MinLength(1) @MaxLength(1000) reason!:string;
}
export class CreateUserDto extends PendingUserDto {
 @IsString() @MinLength(12) @MaxLength(72) password!:string;
}
export class UserActionDto {
 @Type(()=>Number) @IsInt() @Min(1) expectedVersion!:number;
 @IsIn(['EDIT','ACTIVATE','DEACTIVATE','SET_ACCOUNTANT','REMOVE_ACCOUNTANT','GRANT_PERMISSION','REVOKE_PERMISSION','BIND','UNBIND']) action!:string;
 @IsString() @MinLength(1) @MaxLength(1000) reason!:string;
 @IsOptional() @IsEmail() @MaxLength(254) email?:string;
 @IsOptional() @IsString() @MinLength(1) @MaxLength(150) fullName?:string;
 @IsOptional() @IsIn(['SYSTEM_ADMIN','HR_ADMIN']) permission?:'SYSTEM_ADMIN'|'HR_ADMIN';
 @IsOptional() @IsISO8601() expiresAt?:string;
 @IsOptional() @IsString() @MaxLength(128) employeeId?:string;
 @IsOptional() @IsString() @MaxLength(1000) verificationReference?:string;
}
export class CategoryInputDto {
 @IsString() @MinLength(1) @MaxLength(32) code!:string;
 @IsString() @MinLength(1) @MaxLength(100) name!:string;
 @IsOptional() @IsString() @MaxLength(1000) description?:string;
 @IsBoolean() isActive!:boolean;
 @Type(()=>Number) @IsInt() @Min(0) expectedVersion!:number;
}
