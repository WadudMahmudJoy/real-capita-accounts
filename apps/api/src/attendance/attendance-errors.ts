import { BadRequestException, ConflictException, HttpException, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { AttendanceRuleError } from "./attendance-time";

const liveOverlapConstraint = "attendance_policies_live_range_excl";

export function normalizeAttendancePrismaError(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (error instanceof AttendanceRuleError) throw new BadRequestException(error.message);
  const value = objectValue(error);
  if (value?.code === "P2002") throw new ConflictException("An Attendance record with those values already exists.");
  if (value?.code === "P2003") throw new BadRequestException("A referenced Attendance record was not found or cannot be changed.");
  if (value?.code === "P2025") throw new NotFoundException("Attendance record was not found.");
  if (value?.code === "P2034" || isRawQueryWriteConflict(value)) {
    throw new ConflictException("The Attendance data changed concurrently. Please review and retry.");
  }
  if (isExactOverlap(value) || isExactP2004Overlap(value)) {
    throw new ConflictException("The Attendance Policy range overlaps another live policy.");
  }
  throw new InternalServerErrorException("The Attendance operation could not be completed.");
}

function isRawQueryWriteConflict(error: Record<string, unknown> | null): boolean {
  if (error?.code !== "P2010") return false;
  const meta = objectValue(error.meta);
  const adapterError = objectValue(meta?.driverAdapterError);
  const cause = objectValue(adapterError?.cause);
  if (cause?.kind === "TransactionWriteConflict") return true;
  return cause?.kind === "postgres" && (cause.code === "40P01" || cause.originalCode === "40P01");
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function exactConstraint(message: unknown): boolean {
  return typeof message === "string" && message.includes(`"${liveOverlapConstraint}"`);
}

function isExactOverlap(error: Record<string, unknown> | null): boolean {
  const cause = objectValue(error?.cause);
  return cause?.kind === "postgres" && cause.code === "23P01" && exactConstraint(cause.originalMessage);
}

function isExactP2004Overlap(error: Record<string, unknown> | null): boolean {
  if (error?.code !== "P2004") return false;
  const meta = objectValue(error?.meta);
  const cause = objectValue(meta?.cause);
  return cause?.kind === "postgres" && cause.code === "23P01" && exactConstraint(cause.originalMessage);
}
