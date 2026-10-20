import { IsInt, IsString, Matches, Max, Min } from "class-validator";

export class PayrollApprovalReadinessInputDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{1,100}$/) runId!: string;
  @IsInt() @Min(1) @Max(2147483647) expectedVersion!: number;
}
