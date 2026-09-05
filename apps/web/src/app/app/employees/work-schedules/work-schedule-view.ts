import type {
  WorkScheduleDay,
  WorkScheduleDayOfWeek,
} from "@/lib/api";

export const REAL_CAPITA_TIME_ZONE = "Asia/Dhaka" as const;

export const DISPLAY_WEEKDAYS: readonly WorkScheduleDayOfWeek[] = [
  "SATURDAY",
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
];

export function weekdayLabel(day: WorkScheduleDayOfWeek): string {
  return `${day[0]}${day.slice(1).toLowerCase()}`;
}

export function initialWorkScheduleDays(): WorkScheduleDay[] {
  return DISPLAY_WEEKDAYS.map((dayOfWeek) =>
    dayOfWeek === "FRIDAY"
      ? {
          dayOfWeek,
          isWorkingDay: false,
          startMinuteOfDay: null,
          endMinuteOfDay: null,
          unpaidBreakMinutes: 0,
          crossesMidnight: false,
        }
      : {
          dayOfWeek,
          isWorkingDay: true,
          startMinuteOfDay: 600,
          endMinuteOfDay: 1080,
          unpaidBreakMinutes: 60,
          crossesMidnight: false,
        },
  );
}

export function realCapitaBusinessDate(instant = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: REAL_CAPITA_TIME_ZONE,
    year: "numeric",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function nextBusinessDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const instant = new Date(Date.UTC(year, month - 1, day + 1));
  return instant.toISOString().slice(0, 10);
}

export function minuteLabel(value: number | null): string {
  if (value === null) return "";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatScheduleDate(value: string | null): string {
  if (!value) return "Ongoing";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function summarizeWorkingDays(days: WorkScheduleDay[]): string {
  const working = DISPLAY_WEEKDAYS.filter((day) =>
    days.some((rule) => rule.dayOfWeek === day && rule.isWorkingDay),
  );
  if (working.length === 0) return "No working days";
  const indexes = working.map((day) => DISPLAY_WEEKDAYS.indexOf(day));
  const contiguous = indexes.every(
    (value, index) => index === 0 || value === indexes[index - 1] + 1,
  );
  if (contiguous && working.length >= 3) {
    return `${weekdayLabel(working[0])}–${weekdayLabel(working.at(-1)!)}`;
  }
  return working.map(weekdayLabel).join(", ");
}

export function sharedWorkingHours(days: WorkScheduleDay[]): {
  label: string;
  breakLabel: string;
} {
  const working = days.filter((day) => day.isWorkingDay);
  if (working.length === 0) {
    return { label: "No scheduled hours", breakLabel: "No unpaid break" };
  }
  const first = working[0];
  const same = working.every(
    (day) =>
      day.startMinuteOfDay === first.startMinuteOfDay &&
      day.endMinuteOfDay === first.endMinuteOfDay &&
      day.crossesMidnight === first.crossesMidnight &&
      day.unpaidBreakMinutes === first.unpaidBreakMinutes,
  );
  if (!same) {
    return { label: "Hours vary by day", breakLabel: "Break varies by day" };
  }
  return {
    label: `${minuteLabel(first.startMinuteOfDay)} – ${minuteLabel(first.endMinuteOfDay)}${first.crossesMidnight ? " (ends next day)" : ""}`,
    breakLabel: `${first.unpaidBreakMinutes} min unpaid break`,
  };
}

type EffectiveRow = {
  effectiveFrom: string;
  effectiveTo: string | null;
  cancelledAt: string | null;
};

export function partitionAssignments<T extends EffectiveRow>(
  rows: T[],
  businessDate: string,
): { current: T | null; planned: T[]; history: T[] } {
  const live = rows.filter((row) => !row.cancelledAt);
  const current =
    live.find(
      (row) =>
        row.effectiveFrom <= businessDate &&
        (!row.effectiveTo || row.effectiveTo > businessDate),
    ) ?? null;
  const planned = live
    .filter((row) => row.effectiveFrom > businessDate)
    .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
  const history = rows
    .filter(
      (row) =>
        Boolean(row.cancelledAt) ||
        Boolean(row.effectiveTo && row.effectiveTo <= businessDate),
    )
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom));
  return { current, planned, history };
}

export function employeeOverridesForDisplay<T extends EffectiveRow>(
  rows: T[],
  businessDate: string,
): T[] {
  function rank(row: T): number {
    if (row.cancelledAt) return 3;
    if (
      row.effectiveFrom <= businessDate &&
      (!row.effectiveTo || row.effectiveTo > businessDate)
    ) {
      return 0;
    }
    if (row.effectiveFrom > businessDate) return 1;
    return 2;
  }

  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const rankDifference = rank(left.row) - rank(right.row);
      if (rankDifference !== 0) return rankDifference;
      const dateDifference = right.row.effectiveFrom.localeCompare(
        left.row.effectiveFrom,
      );
      return dateDifference || left.index - right.index;
    })
    .map(({ row }) => row);
}
