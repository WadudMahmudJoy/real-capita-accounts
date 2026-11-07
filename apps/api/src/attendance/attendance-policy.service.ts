import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { parseDateOnly } from "../common/business-date";
import { audit } from "./attendance-audit";
import { normalizeAttendancePrismaError } from "./attendance-errors";
import { dhakaBusinessDate } from "./attendance-time";
import {
  canCreateInitial,
  computeCancellationRestore,
  computeReplacementSplice,
} from "./attendance-policy-rules";

type PolicyRow = Prisma.AttendancePolicyGetPayload<object>;

export type AttendancePolicyView = {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  changeReason: string | null;
  replacesPolicyId: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface CreateInitialAttendancePolicyInput {
  effectiveFrom: string;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  changeReason?: string | null;
}

export interface ReplaceAttendancePolicyInput {
  effectiveFrom: string;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  changeReason: string;
}

export interface CancelFutureAttendancePolicyInput {
  cancellationReason: string;
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function policyView(row: PolicyRow) {
  return {
    id: row.id,
    companyId: row.companyId,
    effectiveFrom: dateOnly(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? dateOnly(row.effectiveTo) : null,
    lateGraceMinutes: row.lateGraceMinutes,
    earlyLeaveGraceMinutes: row.earlyLeaveGraceMinutes,
    replacesPolicyId: row.replacesPolicyId,
    cancelledAt: row.cancelledAt,
  };
}

function view(row: PolicyRow): AttendancePolicyView {
  return {
    id: row.id,
    effectiveFrom: dateOnly(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? dateOnly(row.effectiveTo) : null,
    lateGraceMinutes: row.lateGraceMinutes,
    earlyLeaveGraceMinutes: row.earlyLeaveGraceMinutes,
    changeReason: row.changeReason,
    replacesPolicyId: row.replacesPolicyId,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function assertGraceMinutes(lateGraceMinutes: number, earlyLeaveGraceMinutes: number): void {
  if (
    !Number.isInteger(lateGraceMinutes) ||
    lateGraceMinutes < 0 ||
    !Number.isInteger(earlyLeaveGraceMinutes) ||
    earlyLeaveGraceMinutes < 0
  ) {
    throw new BadRequestException("Grace minutes must be non-negative integers.");
  }
}

function cleanOptionalReason(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
}

function cleanRequiredReason(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new BadRequestException(`${label} is required.`);
  }
  return trimmed.slice(0, 500);
}

@Injectable()
export class AttendancePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async listPolicies(companyId: string): Promise<AttendancePolicyView[]> {
    const rows = await this.prisma.attendancePolicy.findMany({
      where: { companyId },
      orderBy: [{ effectiveFrom: "asc" }, { id: "asc" }],
    });
    return rows.map(view);
  }

  async createInitialPolicy(
    companyId: string,
    input: CreateInitialAttendancePolicyInput,
    user: AuthenticatedUser,
  ): Promise<AttendancePolicyView> {
    assertGraceMinutes(input.lateGraceMinutes, input.earlyLeaveGraceMinutes);
    const effectiveFrom = parseDateOnly(input.effectiveFrom, "effectiveFrom");
    const today = dhakaBusinessDate();
    try {
      return await this.prisma.$transaction(
        async tx => {
          const rows = await tx.attendancePolicy.findMany({ where: { companyId } });
          if (!canCreateInitial(rows.map(policyView), today)) {
            throw new ConflictException(
              "An Attendance Policy already exists. Use the replacement flow to change it.",
            );
          }
          const row = await tx.attendancePolicy.create({
            data: {
              companyId,
              effectiveFrom,
              effectiveTo: null,
              lateGraceMinutes: input.lateGraceMinutes,
              earlyLeaveGraceMinutes: input.earlyLeaveGraceMinutes,
              changeReason: cleanOptionalReason(input.changeReason),
              replacesPolicyId: null,
              createdById: user.id,
            },
          });
          await audit(tx, user.id, "ATTENDANCE_POLICY_CREATED", "AttendancePolicy", row.id, {
            attendancePolicyId: row.id,
          });
          return view(row);
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      normalizeAttendancePrismaError(error);
    }
  }

  async replacePolicy(
    companyId: string,
    id: string,
    input: ReplaceAttendancePolicyInput,
    user: AuthenticatedUser,
  ): Promise<AttendancePolicyView> {
    assertGraceMinutes(input.lateGraceMinutes, input.earlyLeaveGraceMinutes);
    const changeReason = cleanRequiredReason(input.changeReason, "Change Reason");
    const replacementFrom = parseDateOnly(input.effectiveFrom, "effectiveFrom");
    const today = dhakaBusinessDate();
    try {
      return await this.prisma.$transaction(
        async tx => {
          await tx.$queryRaw`SELECT id FROM attendance_policies WHERE id = ${id} FOR UPDATE`;
          const predecessor = await tx.attendancePolicy.findFirst({ where: { id, companyId } });
          if (!predecessor) {
            throw new NotFoundException("Attendance Policy was not found.");
          }
          if (dateOnly(replacementFrom) <= today) {
            throw new BadRequestException("The replacement must start in the future.");
          }
          if (predecessor.replacesPolicyId === null) {
            const children = await tx.attendancePolicy.count({
              where: { replacesPolicyId: predecessor.id, cancelledAt: null },
            });
            if (children > 0) {
              throw new ConflictException("Another policy already replaces this one.");
            }
          }
          const splice = computeReplacementSplice(policyView(predecessor), dateOnly(replacementFrom));
          const closed = await tx.attendancePolicy.update({
            where: { id: predecessor.id },
            data: { effectiveTo: parseDateOnly(splice.predecessor.effectiveTo, "effectiveTo") },
          });
          const row = await tx.attendancePolicy.create({
            data: {
              companyId,
              effectiveFrom: replacementFrom,
              effectiveTo: splice.replacement.effectiveTo
                ? parseDateOnly(splice.replacement.effectiveTo, "effectiveTo")
                : null,
              lateGraceMinutes: input.lateGraceMinutes,
              earlyLeaveGraceMinutes: input.earlyLeaveGraceMinutes,
              changeReason,
              replacesPolicyId: predecessor.id,
              createdById: user.id,
            },
          });
          await audit(tx, user.id, "ATTENDANCE_POLICY_REPLACED", "AttendancePolicy", row.id, {
            attendancePolicyId: row.id,
            predecessorId: predecessor.id,
          });
          void closed;
          return view(row);
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      normalizeAttendancePrismaError(error);
    }
  }

  async cancelFuturePolicy(
    companyId: string,
    id: string,
    input: CancelFutureAttendancePolicyInput,
    user: AuthenticatedUser,
  ): Promise<AttendancePolicyView> {
    const cancellationReason = cleanRequiredReason(input.cancellationReason, "Cancellation Reason");
    const today = dhakaBusinessDate();
    try {
      return await this.prisma.$transaction(
        async tx => {
          await tx.$queryRaw`SELECT id FROM attendance_policies WHERE id = ${id} FOR UPDATE`;
          const target = await tx.attendancePolicy.findFirst({ where: { id, companyId } });
          if (!target) {
            throw new NotFoundException("Attendance Policy was not found.");
          }
          if (dateOnly(target.effectiveFrom) <= today) {
            throw new ConflictException("Only a policy that has not started can be cancelled.");
          }
          if (target.cancelledAt !== null) {
            throw new ConflictException("The policy is already cancelled.");
          }

          if (target.replacesPolicyId !== null) {
            await tx.$queryRaw`SELECT id FROM attendance_policies WHERE id = ${target.replacesPolicyId} FOR UPDATE`;
            const predecessor = await tx.attendancePolicy.findFirst({
              where: { id: target.replacesPolicyId, companyId },
            });
            if (!predecessor) {
              throw new NotFoundException("Attendance Policy predecessor was not found.");
            }
            const dependents = await tx.attendancePolicy.count({
              where: { replacesPolicyId: target.id, cancelledAt: null },
            });
            if (dependents > 0) {
              throw new ConflictException(
                "A later replacement depends on this policy. Cancel it first.",
              );
            }
            const restore = computeCancellationRestore(policyView(target), policyView(predecessor));
            const cancelled = await tx.attendancePolicy.update({
              where: { id: target.id },
              data: {
                cancelledAt: new Date(),
                cancelledById: user.id,
                cancellationReason,
              },
            });
            await tx.attendancePolicy.update({
              where: { id: predecessor.id },
              data: {
                effectiveTo: restore.restoredEffectiveTo
                  ? parseDateOnly(restore.restoredEffectiveTo, "effectiveTo")
                  : null,
              },
            });
            await audit(tx, user.id, "ATTENDANCE_POLICY_FUTURE_CANCELLED", "AttendancePolicy", cancelled.id, {
              attendancePolicyId: cancelled.id,
              predecessorId: predecessor.id,
            });
            return view(cancelled);
          }

          const cancelled = await tx.attendancePolicy.update({
            where: { id: target.id },
            data: {
              cancelledAt: new Date(),
              cancelledById: user.id,
              cancellationReason,
            },
          });
          await audit(tx, user.id, "ATTENDANCE_POLICY_FUTURE_CANCELLED", "AttendancePolicy", cancelled.id, {
            attendancePolicyId: cancelled.id,
          });
          return view(cancelled);
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      normalizeAttendancePrismaError(error);
    }
  }
}
