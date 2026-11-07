import type { AttendanceDayRow, AttendanceRowStatus } from "@/lib/attendance-api";

const DHAKA_TIME_ZONE = "Asia/Dhaka";

const punchFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: DHAKA_TIME_ZONE,
});

const localTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  timeZone: DHAKA_TIME_ZONE,
});

const availabilityFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "long",
  timeZone: DHAKA_TIME_ZONE,
  year: "numeric",
});

const dateLabelFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

const todayFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: DHAKA_TIME_ZONE,
  year: "numeric",
});

export function dhakaToday(now = new Date()): string {
  const parts = todayFormatter.formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function businessDateLabel(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return dateLabelFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}

export function minuteLabel(value: number | null): string {
  if (value === null) return "—";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function punchTimeLabel(value: string | null): string {
  if (!value) return "—";
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return "—";
  return punchFormatter.format(instant);
}

export function localTimeValue(value: string | null): string {
  if (!value) return "";
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return "";
  const formatted = localTimeFormatter.format(instant);
  return formatted === "24:00" ? "00:00" : formatted;
}

function nonWorkingLabel(expectedDayKind: AttendanceDayRow["expectedDayKind"]): string {
  return expectedDayKind === "HOLIDAY" ? "Holiday" : "Weekly Rest";
}

export function statusLabel(row: { expectedDayKind: AttendanceDayRow["expectedDayKind"]; status: AttendanceRowStatus }): string {
  const status = row.status;
  if (status.kind === "NOT_APPLICABLE") return "Not Applicable";
  if (status.kind === "FINALIZED") {
    if (status.presenceState === "NOT_REQUIRED") return nonWorkingLabel(row.expectedDayKind);
    if (status.presenceState === "ABSENT") return "Absent";
    if (status.presenceState === "INCOMPLETE") return "Incomplete";
    if (status.isNonWorkingDayAttendance) return "Present · Non-working Day";
    if (status.isLate) return "Present · Late";
    if (status.isEarlyLeave) return "Present · Early Leave";
    return "Present";
  }
  if (status.kind === "PENDING") return "Pending";
  if (status.kind === "NON_WORKING_NO_ATTENDANCE") return nonWorkingLabel(row.expectedDayKind);
  if (status.kind === "CHECKED_IN") {
    return status.nonWorkingDay ? "Checked In · Non-working Day" : "Checked In";
  }
  if (status.kind === "CHECKED_IN_LATE") return "Checked In · Late";
  if (status.kind === "INCOMPLETE") return "Incomplete";
  if (status.nonWorkingDay) return "Present · Non-working Day";
  if (status.provisionalLate) return "Present · Late";
  if (status.provisionalEarlyLeave) return "Present · Early Leave";
  return "Present";
}

export function statusTone(status: AttendanceRowStatus): "active" | "closed" | "inactive" | "neutral" {
  if (status.kind === "FINALIZED") {
    if (status.presenceState === "PRESENT") return "active";
    if (status.presenceState === "ABSENT" || status.presenceState === "INCOMPLETE") return "closed";
    return "neutral";
  }
  if (status.kind === "PRESENT" || status.kind === "CHECKED_IN") return "active";
  if (status.kind === "CHECKED_IN_LATE" || status.kind === "INCOMPLETE") return "closed";
  return "neutral";
}

export function expectedWindowLabel(
  row: Pick<AttendanceDayRow, "expectedDayKind" | "scheduledStartMinute" | "scheduledEndMinute" | "crossesMidnight">,
): string {
  if (row.expectedDayKind === "HOLIDAY") return "Holiday";
  if (row.expectedDayKind === "WEEKLY_REST") return "Weekly Rest";
  if (row.scheduledStartMinute === null || row.scheduledEndMinute === null) return "—";
  const window = `${minuteLabel(row.scheduledStartMinute)} – ${minuteLabel(row.scheduledEndMinute)}`;
  return row.crossesMidnight ? `${window} (ends next day)` : window;
}

export function expectedCount(rows: Array<Pick<AttendanceDayRow, "attendanceRequired">>): number {
  return rows.filter(row => row.attendanceRequired).length;
}

export function daySummaryChips(
  day: { rows: Array<Pick<AttendanceDayRow, "attendanceRequired" | "status">> },
): { expected: number; present: number; late: number; pending: number; incomplete: number } {
  let expected = 0;
  let present = 0;
  let late = 0;
  let pending = 0;
  let incomplete = 0;
  for (const row of day.rows) {
    if (row.attendanceRequired) {
      expected += 1;
    }
    const status = row.status;
    if (status.kind === "FINALIZED") {
      if (status.presenceState === "PRESENT") present += 1;
      if (status.isLate) late += 1;
      if (status.presenceState === "INCOMPLETE") incomplete += 1;
      continue;
    }
    if (status.kind === "PRESENT") {
      present += 1;
      if (status.provisionalLate) late += 1;
      continue;
    }
    if (status.kind === "CHECKED_IN_LATE") {
      late += 1;
      continue;
    }
    if (row.attendanceRequired && status.kind === "PENDING") pending += 1;
    if (row.attendanceRequired && status.kind === "INCOMPLETE") incomplete += 1;
  }
  return { expected, present, late, pending, incomplete };
}

export function finalizationAvailabilityText(allowedAt: string | null): string | null {
  if (!allowedAt) return null;
  const instant = new Date(allowedAt);
  if (Number.isNaN(instant.getTime())) return null;
  return `This day can be finalized after ${availabilityFormatter.format(instant)}.`;
}
