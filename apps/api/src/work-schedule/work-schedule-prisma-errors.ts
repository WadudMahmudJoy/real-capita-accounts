import { BadRequestException, ConflictException, HttpException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { WorkScheduleDefinitionImmutableError, WorkScheduleRuleError } from './work-schedule-rules';

const overlapConstraints = new Set([
  'work_schedule_assignments_default_range_excl',
  'work_schedule_assignments_employee_range_excl',
]);

export function normalizeWorkSchedulePrismaError(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (error instanceof WorkScheduleDefinitionImmutableError) throw new ConflictException(error.message);
  if (error instanceof WorkScheduleRuleError) throw new BadRequestException(error.message);
  const value = objectValue(error);
  if (value?.code === 'P2002') throw new ConflictException('A Work Schedule record with those values already exists.');
  if (value?.code === 'P2003') throw new BadRequestException('A referenced Work Schedule record was not found or cannot be changed.');
  if (value?.code === 'P2025') throw new NotFoundException('Work Schedule record was not found.');
  if (value?.code === 'P2034') throw new ConflictException('The Work Schedule changed concurrently. Please retry.');
  if (isExactOverlap(value) || isExactP2004Overlap(value)) throw new ConflictException('The assignment overlaps an existing Work Schedule assignment.');
  throw new InternalServerErrorException('The Work Schedule operation could not be completed.');
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function exactConstraint(message: unknown): boolean {
  if (typeof message !== 'string') return false;
  return [...overlapConstraints].some(name => message.includes(`"${name}"`));
}

function isExactOverlap(error: Record<string, unknown> | null): boolean {
  const cause = objectValue(error?.cause);
  return cause?.kind === 'postgres' && cause.code === '23P01' && exactConstraint(cause.originalMessage);
}

function isExactP2004Overlap(error: Record<string, unknown> | null): boolean {
  if (error?.code !== 'P2004') return false;
  const meta = objectValue(error.meta);
  const cause = objectValue(meta?.cause);
  return cause?.kind === 'postgres' && cause.code === '23P01' && exactConstraint(cause.originalMessage);
}
