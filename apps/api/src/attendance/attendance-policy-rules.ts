import { AttendanceRuleError, buildDhakaInstant } from "./attendance-time";

export type AttendancePolicyView = {
  id: string;
  companyId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  replacesPolicyId: string | null;
  cancelledAt: Date | null;
};

export type AttendancePolicySplice = {
  predecessor: { id: string; effectiveFrom: string; effectiveTo: string };
  replacement: { effectiveFrom: string; effectiveTo: string | null; replacesPolicyId: string };
};

export type AttendancePolicyRestore = {
  restoredEffectiveTo: string | null;
};

export function policyStartInstant(policy: AttendancePolicyView): Date {
  return buildDhakaInstant(policy.effectiveFrom, { hours: 0, minutes: 0 });
}

export function computeReplacementSplice(
  predecessor: AttendancePolicyView,
  replacementDate: string,
): AttendancePolicySplice {
  if (predecessor.cancelledAt !== null) {
    throw new AttendanceRuleError("A cancelled policy cannot be replaced.");
  }
  if (replacementDate <= predecessor.effectiveFrom) {
    throw new AttendanceRuleError("The replacement date must be after the predecessor start.");
  }
  if (predecessor.effectiveTo !== null && replacementDate >= predecessor.effectiveTo) {
    throw new AttendanceRuleError("The replacement date must lie inside the predecessor live range.");
  }
  return {
    predecessor: {
      id: predecessor.id,
      effectiveFrom: predecessor.effectiveFrom,
      effectiveTo: replacementDate,
    },
    replacement: {
      effectiveFrom: replacementDate,
      effectiveTo: predecessor.effectiveTo,
      replacesPolicyId: predecessor.id,
    },
  };
}

export function computeCancellationRestore(
  target: AttendancePolicyView,
  predecessor: AttendancePolicyView,
): AttendancePolicyRestore {
  if (target.cancelledAt !== null) {
    throw new AttendanceRuleError("Only an uncancelled policy can be cancelled.");
  }
  if (target.replacesPolicyId !== predecessor.id) {
    throw new AttendanceRuleError("The policy does not replace the provided predecessor.");
  }
  if (predecessor.effectiveTo !== target.effectiveFrom) {
    throw new AttendanceRuleError("The predecessor boundary no longer matches the replacement start.");
  }
  return { restoredEffectiveTo: target.effectiveTo };
}

export function isEverEffective(policy: AttendancePolicyView, today: string): boolean {
  if (policy.effectiveFrom > today) {
    return false;
  }
  if (policy.cancelledAt !== null && policy.cancelledAt < policyStartInstant(policy)) {
    return false;
  }
  return true;
}

export function canCreateInitial(
  policies: AttendancePolicyView[],
  today: string,
): boolean {
  if (policies.some((policy) => policy.cancelledAt === null)) {
    return false;
  }
  return !policies.some((policy) => isEverEffective(policy, today));
}

export function uncancelledDependentsOf(
  policies: AttendancePolicyView[],
  policyId: string,
): AttendancePolicyView[] {
  return policies.filter((policy) => policy.cancelledAt === null && policy.replacesPolicyId === policyId);
}
