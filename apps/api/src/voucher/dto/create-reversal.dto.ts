import { IsString, MinLength } from "class-validator";
import { Trim } from "../../common/dto-transforms";

// Request body for POST /vouchers/:id/reversal.
// Only a reason string is required; all other draft fields (date, period,
// lines, narration) are generated automatically from the original voucher.
export class CreateReversalDto {
  @IsString()
  @MinLength(10)
  @Trim()
  reason!: string;
}
