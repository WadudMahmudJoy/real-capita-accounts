import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
export class ConfirmPayrollPaymentDto {
  @IsInt() @Min(1) @Max(2147483647) expectedVersion!: number;
  @IsString() @MinLength(1) @MaxLength(256) evidenceHandle!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{8,128}$/) idempotencyKey!: string;
}
