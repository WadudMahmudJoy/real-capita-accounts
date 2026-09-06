import { REAL_CAPITA_TIME_ZONE } from "../common/business-date";

export const DHAKA_TIME_ZONE = REAL_CAPITA_TIME_ZONE;

export class AttendanceRuleError extends Error {}

export type LocalTime = { hours: number; minutes: number };

export const LOCAL_TIME_PATTERN = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const dhakaDateTimeFormatter = new Intl.DateTimeFormat("en", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  timeZone: REAL_CAPITA_TIME_ZONE,
  year: "numeric",
});

type DhakaWallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function dhakaWallClock(instant: Date): DhakaWallClock {
  const parts = Object.fromEntries(
    dhakaDateTimeFormatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: parts.hour === "24" ? 0 : Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function dhakaOffsetMinutes(instant: Date): number {
  const wall = dhakaWallClock(instant);
  const wallAsUtcMs = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  return Math.round((wallAsUtcMs - instant.getTime()) / 60_000);
}

export function parseLocalTime(value: string): LocalTime | null {
  const match = LOCAL_TIME_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

export function formatLocalTime(time: LocalTime): string {
  return `${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}`;
}

export function minuteOfDayToTime(minuteOfDay: number): LocalTime {
  return { hours: Math.floor(minuteOfDay / 60), minutes: minuteOfDay % 60 };
}

export function isCanonicalDateOnly(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function assertCanonicalBusinessDate(businessDate: string): void {
  if (!isCanonicalDateOnly(businessDate)) {
    throw new AttendanceRuleError("businessDate must be a canonical YYYY-MM-DD date.");
  }
}

export function dhakaBusinessDate(now = new Date()): string {
  const wall = dhakaWallClock(now);
  return `${String(wall.year).padStart(4, "0")}-${String(wall.month).padStart(2, "0")}-${String(wall.day).padStart(2, "0")}`;
}

export function addDaysDateOnly(businessDate: string, days: number): string {
  assertCanonicalBusinessDate(businessDate);
  const [year, month, day] = businessDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export type CheckOutDateDerivation = "SAME_DAY" | "NEXT_DAY" | "AMBIGUOUS";

export function deriveCheckOutDate(
  checkInLocalTime: LocalTime,
  checkOutLocalTime: LocalTime,
): CheckOutDateDerivation {
  const checkInTotal = checkInLocalTime.hours * 60 + checkInLocalTime.minutes;
  const checkOutTotal = checkOutLocalTime.hours * 60 + checkOutLocalTime.minutes;
  if (checkOutTotal === checkInTotal) {
    return "AMBIGUOUS";
  }
  return checkOutTotal > checkInTotal ? "SAME_DAY" : "NEXT_DAY";
}

export function buildDhakaInstant(businessDate: string, localTime: LocalTime): Date {
  assertCanonicalBusinessDate(businessDate);
  const [year, month, day] = businessDate.split("-").map(Number);
  const naiveWallMs = Date.UTC(year, month - 1, day, localTime.hours, localTime.minutes);
  const offsetMinutes = dhakaOffsetMinutes(new Date(naiveWallMs));
  return new Date(naiveWallMs - offsetMinutes * 60_000);
}

export function expectedEndInstant(
  businessDate: string,
  endMinuteOfDay: number,
  crossesMidnight: boolean,
): Date {
  const anchoredDate = crossesMidnight ? addDaysDateOnly(businessDate, 1) : businessDate;
  return buildDhakaInstant(anchoredDate, minuteOfDayToTime(endMinuteOfDay));
}

export function nextDhakaMidnight(businessDate: string): Date {
  return buildDhakaInstant(addDaysDateOnly(businessDate, 1), { hours: 0, minutes: 0 });
}

export function isFutureInstant(instant: Date, now = new Date()): boolean {
  return instant.getTime() > now.getTime();
}
