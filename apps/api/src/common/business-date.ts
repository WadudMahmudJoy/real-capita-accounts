import { BadRequestException } from '@nestjs/common';
export const REAL_CAPITA_TIME_ZONE = 'Asia/Dhaka' as const;
export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export function parseDateOnly(value: string, fieldName: string): Date {
    if (!DATE_ONLY_PATTERN.test(value)) {
        throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format.`);
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw new BadRequestException(`${fieldName} must be a valid date.`);
    }
    return parsed;
}
export function parseOptionalDateOnly(value: string | null | undefined, fieldName: string): Date | null {
    return value == null ? null : parseDateOnly(value, fieldName);
}
export function bangladeshTodayDateOnly(now = new Date()): Date {
    const parts = new Intl.DateTimeFormat('en', { day: '2-digit', month: '2-digit', timeZone: REAL_CAPITA_TIME_ZONE, year: 'numeric' }).formatToParts(now);
    const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)));
}
