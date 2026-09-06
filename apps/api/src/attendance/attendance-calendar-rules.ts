import { AttendanceRuleError } from "./attendance-time";

export type CompanyCalendarExceptionTypeValue = "HOLIDAY" | "SPECIAL_WORKING_DAY";

export type CalendarExceptionShapeInput = {
  exceptionType: CompanyCalendarExceptionTypeValue;
  startMinuteOfDay: number | null;
  endMinuteOfDay: number | null;
  unpaidBreakMinutes: number;
  crossesMidnight: boolean;
};

function assertValidMinute(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= 1440) {
    throw new AttendanceRuleError(`${fieldName} must be an integer between 0 and 1439.`);
  }
}

export function validateCalendarExceptionShape(
  input: CalendarExceptionShapeInput,
): void {
  if (input.exceptionType === "HOLIDAY") {
    if (
      input.startMinuteOfDay !== null ||
      input.endMinuteOfDay !== null ||
      input.unpaidBreakMinutes !== 0 ||
      input.crossesMidnight
    ) {
      throw new AttendanceRuleError("A holiday cannot define working hours, a break, or a midnight crossing.");
    }
    return;
  }

  if (input.startMinuteOfDay === null || input.endMinuteOfDay === null) {
    throw new AttendanceRuleError("A special working day requires explicit start and end times.");
  }
  assertValidMinute(input.startMinuteOfDay, "startMinuteOfDay");
  assertValidMinute(input.endMinuteOfDay, "endMinuteOfDay");
  if (input.endMinuteOfDay === input.startMinuteOfDay) {
    throw new AttendanceRuleError("A special working day cannot start and end at the same minute.");
  }
  if (input.crossesMidnight && input.endMinuteOfDay > input.startMinuteOfDay) {
    throw new AttendanceRuleError("An overnight special working day must end earlier than it starts.");
  }
  if (!input.crossesMidnight && input.endMinuteOfDay < input.startMinuteOfDay) {
    throw new AttendanceRuleError("A normal special working day must end later than it starts.");
  }
  if (!Number.isInteger(input.unpaidBreakMinutes) || input.unpaidBreakMinutes < 0) {
    throw new AttendanceRuleError("The unpaid break must be a non-negative integer.");
  }
  const grossScheduledMinutes = input.crossesMidnight
    ? 1440 - input.startMinuteOfDay + input.endMinuteOfDay
    : input.endMinuteOfDay - input.startMinuteOfDay;
  if (input.unpaidBreakMinutes >= grossScheduledMinutes) {
    throw new AttendanceRuleError("The unpaid break must be shorter than the scheduled duration.");
  }
}
