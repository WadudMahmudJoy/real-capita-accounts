import { BadRequestException } from "@nestjs/common";

export function parseIsoDate(value: string, fieldName: string): Date {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${fieldName} must be a valid date.`);
  }

  return parsed;
}

export function assertEndDateAfterStartDate(startDate: Date, endDate: Date) {
  if (endDate <= startDate) {
    throw new BadRequestException("endDate must be after startDate.");
  }
}

export function assertDateRangeInsideParentRange(
  startDate: Date,
  endDate: Date,
  parentStartDate: Date,
  parentEndDate: Date,
) {
  if (startDate < parentStartDate || endDate > parentEndDate) {
    throw new BadRequestException(
      "Accounting period date range must fit inside the fiscal year date range.",
    );
  }
}
