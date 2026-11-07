import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { BloodGroup } from "../../generated/prisma/client";
import {
  ParseBooleanQuery,
  Trim,
  TrimLowercaseToNull,
  TrimToNull,
  TrimUppercase,
} from "../../common/dto-transforms";
import {
  BANGLADESH_MOBILE_PATTERN,
  DATE_ONLY_PATTERN,
  EMPLOYEE_CODE_PATTERN,
  normalizeBangladeshMobile,
  normalizeNationalId,
} from "../employee-rules";

const OptionalDate = () =>
  Matches(DATE_ONLY_PATTERN, {
    message: "$property must use YYYY-MM-DD format.",
  });

const NormalizeMobile = () =>
  Transform(({ value }: { value: unknown }): unknown =>
    typeof value === "string" ? normalizeBangladeshMobile(value) : value,
  );

const NormalizeOptionalMobile = () =>
  Transform(({ value }: { value: unknown }): unknown => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed ? normalizeBangladeshMobile(trimmed) : null;
  });

const NormalizeNid = () =>
  Transform(({ value }: { value: unknown }): unknown =>
    typeof value === "string" ? normalizeNationalId(value) : value,
  );

export class ListEmployeesQueryDto {
  @IsOptional() @Trim() @MaxLength(100) search?: string;
  @IsOptional() @ParseBooleanQuery() @IsBoolean() includeInactive?: boolean;
  @IsOptional() @ParseBooleanQuery() @IsBoolean() includeDeleted?: boolean;
  @IsOptional() @Trim() @IsString() @MinLength(1) departmentId?: string;
  @IsOptional() @IsIn(["ACTIVE", "INACTIVE", "ALL"]) status?:
    | "ACTIVE"
    | "INACTIVE"
    | "ALL";
}

export class CreateEmployeeDto {
  @IsString()
  @TrimUppercase()
  @Matches(EMPLOYEE_CODE_PATTERN, {
    message: "employeeCode has an invalid format.",
  })
  employeeCode!: string;

  @IsString() @Trim() @MinLength(1) @MaxLength(200) fullName!: string;
  @IsOptional() @TrimToNull() @IsString() @MaxLength(200) bengaliName?: string | null;
  @IsOptional() @OptionalDate() dateOfBirth?: string | null;

  @IsOptional()
  @NormalizeNid()
  @IsString()
  @Matches(/^\d{10,17}$/, {
    message: "nationalId must contain 10 to 17 digits.",
  })
  nationalId?: string | null;

  @IsOptional() @IsEnum(BloodGroup) bloodGroup?: BloodGroup | null;

  @IsString()
  @NormalizeMobile()
  @Matches(BANGLADESH_MOBILE_PATTERN, {
    message: "mobileNumber must be a valid Bangladesh mobile number.",
  })
  mobileNumber!: string;

  @IsOptional()
  @NormalizeOptionalMobile()
  @IsString()
  @Matches(BANGLADESH_MOBILE_PATTERN, {
    message: "alternateMobileNumber must be a valid Bangladesh mobile number.",
  })
  alternateMobileNumber?: string | null;

  @IsOptional() @TrimLowercaseToNull() @IsEmail() @MaxLength(320) personalEmail?: string | null;
  @IsOptional() @TrimLowercaseToNull() @IsEmail() @MaxLength(320) officialEmail?: string | null;
  @IsOptional() @TrimToNull() @IsString() @MaxLength(1000) presentAddress?: string | null;
  @IsOptional() @TrimToNull() @IsString() @MaxLength(1000) permanentAddress?: string | null;
  @IsString() @Trim() @MinLength(1) @MaxLength(150) designation!: string;
  @IsString() @Trim() @MinLength(1) departmentId!: string;

  @Matches(DATE_ONLY_PATTERN, {
    message: "joiningDate must use YYYY-MM-DD format.",
  })
  joiningDate!: string;

  @IsOptional() @OptionalDate() confirmationDate?: string | null;
  @IsOptional() @OptionalDate() separationDate?: string | null;
  @IsOptional() @TrimToNull() @IsString() @MaxLength(500) separationReason?: string | null;
  @IsOptional() @TrimToNull() @IsString() @MaxLength(200) emergencyContactName?: string | null;
  @IsOptional() @TrimToNull() @IsString() @MaxLength(100) emergencyContactRelationship?: string | null;

  @IsOptional()
  @NormalizeOptionalMobile()
  @IsString()
  @Matches(BANGLADESH_MOBILE_PATTERN, {
    message: "emergencyContactMobile must be a valid Bangladesh mobile number.",
  })
  emergencyContactMobile?: string | null;

  @IsOptional() @TrimToNull() @IsString() @MaxLength(1000) emergencyContactAddress?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateEmployeeDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName?: string;
  @IsOptional() @TrimToNull() @IsString() @MaxLength(200) bengaliName?: string | null;
  @IsOptional() @OptionalDate() dateOfBirth?: string | null;

  @IsOptional()
  @NormalizeNid()
  @IsString()
  @Matches(/^\d{10,17}$/, {
    message: "nationalId must contain 10 to 17 digits.",
  })
  nationalId?: string | null;

  @IsOptional() @IsEnum(BloodGroup) bloodGroup?: BloodGroup | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @NormalizeMobile()
  @Matches(BANGLADESH_MOBILE_PATTERN, {
    message: "mobileNumber must be a valid Bangladesh mobile number.",
  })
  mobileNumber?: string;

  @IsOptional()
  @NormalizeOptionalMobile()
  @IsString()
  @Matches(BANGLADESH_MOBILE_PATTERN, {
    message: "alternateMobileNumber must be a valid Bangladesh mobile number.",
  })
  alternateMobileNumber?: string | null;

  @IsOptional() @TrimLowercaseToNull() @IsEmail() @MaxLength(320) personalEmail?: string | null;
  @IsOptional() @TrimLowercaseToNull() @IsEmail() @MaxLength(320) officialEmail?: string | null;
  @IsOptional() @TrimToNull() @IsString() @MaxLength(1000) presentAddress?: string | null;
  @IsOptional() @TrimToNull() @IsString() @MaxLength(1000) permanentAddress?: string | null;
  @ValidateIf((_object, value) => value !== undefined)
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  designation?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Trim()
  @MinLength(1)
  departmentId?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(DATE_ONLY_PATTERN, {
    message: "joiningDate must use YYYY-MM-DD format.",
  })
  joiningDate?: string;

  @IsOptional() @OptionalDate() confirmationDate?: string | null;
  @IsOptional() @OptionalDate() separationDate?: string | null;
  @IsOptional() @TrimToNull() @IsString() @MaxLength(500) separationReason?: string | null;
  @IsOptional() @TrimToNull() @IsString() @MaxLength(200) emergencyContactName?: string | null;
  @IsOptional() @TrimToNull() @IsString() @MaxLength(100) emergencyContactRelationship?: string | null;

  @IsOptional()
  @NormalizeOptionalMobile()
  @IsString()
  @Matches(BANGLADESH_MOBILE_PATTERN, {
    message: "emergencyContactMobile must be a valid Bangladesh mobile number.",
  })
  emergencyContactMobile?: string | null;

  @IsOptional() @TrimToNull() @IsString() @MaxLength(1000) emergencyContactAddress?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
