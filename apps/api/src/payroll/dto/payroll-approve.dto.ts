import { IsInt, Max, Min } from "class-validator";

export class ApprovePayrollRunDto {
  @IsInt() @Min(1) @Max(2147483647) expectedVersion!: number;
}

export class PayrollApprovalResponseDto {
  id!: string;
  companyId!: string;
  year!: number;
  month!: number;
  status!: "APPROVED";
  version!: number;
  approvedById!: string;
  approvedAt!: string;
  lineCount!: number;
}
