import { IsInt, Max, Min } from "class-validator";

// Internal service input only; no calculation route is exposed.
export class PayrollMonthDto {
  @IsInt() @Min(1) @Max(9999) year!: number;
  @IsInt() @Min(1) @Max(12) month!: number;
}
