"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  cancelFutureAttendancePolicy,
  createInitialAttendancePolicy,
  getAttendancePolicies,
  replaceAttendancePolicy,
  type AttendancePolicy,
} from "@/lib/attendance-api";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  LoadingPanel,
  Notice,
  StatusBadge,
  TextInput,
} from "../../_components/ui";
import { ConfirmationDialog, formatEffectivePeriod } from "../../_components/salary-ui";
import { dhakaToday } from "./attendance-view";

const INITIAL_CONFLICT_MESSAGE =
  "Attendance Rules already exist. Use Replace Rules to make a new effective version.";

function rulesErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isUnauthorized) return "Your session has expired. Please sign in again.";
    if (error.isForbidden) return "Your account does not have access to Attendance settings.";
    if (error.status >= 500 || error.status === 0) {
      return "The server could not complete the request. Please try again.";
    }
    return error.message;
  }
  return "The request could not be completed. Please try again.";
}

type PolicyPhase = "in-effect" | "scheduled" | "ended" | "cancelled";

function policyPhase(policy: AttendancePolicy, today: string): PolicyPhase {
  if (policy.cancelledAt !== null) return "cancelled";
  if (policy.effectiveFrom.slice(0, 10) > today) return "scheduled";
  if (policy.effectiveTo === null || policy.effectiveTo.slice(0, 10) > today) return "in-effect";
  return "ended";
}

function phaseBadge(phase: PolicyPhase) {
  if (phase === "in-effect") return <StatusBadge tone="active">In effect</StatusBadge>;
  if (phase === "scheduled") return <StatusBadge tone="closed">Scheduled</StatusBadge>;
  if (phase === "cancelled") return <StatusBadge tone="inactive">Cancelled</StatusBadge>;
  return <StatusBadge tone="inactive">Ended</StatusBadge>;
}

function isNonNegativeInteger(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export function SettingsRulesPanel() {
  const router = useRouter();
  const [policies, setPolicies] = useState<AttendancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createEffectiveFrom, setCreateEffectiveFrom] = useState("");
  const [createLateGrace, setCreateLateGrace] = useState("");
  const [createEarlyGrace, setCreateEarlyGrace] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceEffectiveFrom, setReplaceEffectiveFrom] = useState("");
  const [replaceLateGrace, setReplaceLateGrace] = useState("");
  const [replaceEarlyGrace, setReplaceEarlyGrace] = useState("");
  const [replaceReason, setReplaceReason] = useState("");
  const [replaceError, setReplaceError] = useState<string | null>(null);

  const [cancelTarget, setCancelTarget] = useState<AttendancePolicy | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  const today = dhakaToday();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const rows = await getAttendancePolicies(signal);
        if (signal?.aborted) return;
        setPolicies(rows);
        setError(null);
        setLoading(false);
      } catch (caught) {
        if (signal?.aborted) return;
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }
        setError(rulesErrorMessage(caught));
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const hasLivePolicy = policies.some(policy => policy.cancelledAt === null);
  const hasStartedPolicy = policies.some(policy => policy.effectiveFrom.slice(0, 10) <= today);
  const initialPolicyAvailable = !hasLivePolicy && !hasStartedPolicy;
  const currentPolicy =
    policies.find(
      policy =>
        policy.cancelledAt === null &&
        policy.effectiveFrom.slice(0, 10) <= today &&
        (policy.effectiveTo === null || policy.effectiveTo.slice(0, 10) > today),
    ) ?? null;

  function validateGrace(late: string, early: string): string | null {
    if (!isNonNegativeInteger(late)) return "Enter the late grace in whole minutes.";
    if (!isNonNegativeInteger(early)) return "Enter the early leave grace in whole minutes.";
    return null;
  }

  function openCreateForm() {
    setCreateEffectiveFrom("");
    setCreateLateGrace("");
    setCreateEarlyGrace("");
    setCreateError(null);
    setCreateOpen(true);
  }

  async function submitInitial() {
    const graceError = validateGrace(createLateGrace, createEarlyGrace);
    if (!createEffectiveFrom) {
      setCreateError("Effective from is required.");
      return;
    }
    if (graceError) {
      setCreateError(graceError);
      return;
    }
    setActionPending(true);
    setCreateError(null);
    try {
      await createInitialAttendancePolicy({
        effectiveFrom: createEffectiveFrom,
        lateGraceMinutes: Number(createLateGrace),
        earlyLeaveGraceMinutes: Number(createEarlyGrace),
      });
      setCreateOpen(false);
      setMessage("The initial Attendance Rules were created.");
      await load();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setCreateError(INITIAL_CONFLICT_MESSAGE);
      } else {
        setCreateError(rulesErrorMessage(caught));
      }
    } finally {
      setActionPending(false);
    }
  }

  function openReplaceForm() {
    setReplaceEffectiveFrom("");
    setReplaceLateGrace("");
    setReplaceEarlyGrace("");
    setReplaceReason("");
    setReplaceError(null);
    setReplaceOpen(true);
  }

  async function submitReplace() {
    if (!currentPolicy) return;
    if (!replaceEffectiveFrom) {
      setReplaceError("Effective from is required.");
      return;
    }
    const graceError = validateGrace(replaceLateGrace, replaceEarlyGrace);
    if (graceError) {
      setReplaceError(graceError);
      return;
    }
    if (!replaceReason.trim()) {
      setReplaceError("Change reason is required.");
      return;
    }
    setActionPending(true);
    setReplaceError(null);
    try {
      await replaceAttendancePolicy(currentPolicy.id, {
        effectiveFrom: replaceEffectiveFrom,
        lateGraceMinutes: Number(replaceLateGrace),
        earlyLeaveGraceMinutes: Number(replaceEarlyGrace),
        changeReason: replaceReason.trim(),
      });
      setReplaceOpen(false);
      setMessage("The Attendance Rules replacement was scheduled.");
      await load();
    } catch (caught) {
      setReplaceError(rulesErrorMessage(caught));
    } finally {
      setActionPending(false);
    }
  }

  function openCancelDialog(policy: AttendancePolicy) {
    setCancelTarget(policy);
    setCancelReason("");
    setCancelError(null);
  }

  async function submitCancel() {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      setCancelError("Cancellation reason is required.");
      return;
    }
    setActionPending(true);
    setCancelError(null);
    try {
      await cancelFutureAttendancePolicy(cancelTarget.id, {
        cancellationReason: cancelReason.trim(),
      });
      setCancelTarget(null);
      setMessage("The future Attendance Rules were cancelled.");
      await load();
    } catch (caught) {
      setCancelError(rulesErrorMessage(caught));
    } finally {
      setActionPending(false);
    }
  }

  return (
    <Card>
      <CardHeader
        actions={
          initialPolicyAvailable ? (
            <Button onClick={openCreateForm}>Create Initial Rules</Button>
          ) : currentPolicy ? (
            <Button onClick={openReplaceForm}>Replace Rules</Button>
          ) : null
        }
        description="Grace minutes control how attendance is evaluated on working days. Changes take effect from their effective date."
        title="Attendance Rules"
      />
      <div className="mt-4 flex flex-col gap-3">
        {message ? <Notice tone="success">{message}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        {loading ? <LoadingPanel message="Loading Attendance Rules..." /> : null}
        {!loading && policies.length === 0 ? (
          <EmptyState
            description="No Attendance Rules are configured yet. Create the initial rules so working-day attendance can be evaluated."
            title="No Attendance Rules yet"
          />
        ) : null}
        {!loading && policies.length > 0 && initialPolicyAvailable ? (
          <Notice tone="info">
            No Attendance Rules are currently in effect. Create initial rules to start a new
            effective version.
          </Notice>
        ) : null}
        <ul className="flex flex-col gap-3">
          {policies.map((policy, index) => {
            const phase = policyPhase(policy, today);
            return (
              <li
                className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                key={`${policy.effectiveFrom}-${policy.lateGraceMinutes}-${index}`}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {phaseBadge(phase)}
                    <span className="text-sm font-medium text-foreground">
                      {formatEffectivePeriod(policy.effectiveFrom, policy.effectiveTo)}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {`Late grace ${policy.lateGraceMinutes} min · Early leave grace ${policy.earlyLeaveGraceMinutes} min`}
                  </span>
                  {policy.changeReason ? (
                    <span className="break-words text-xs text-muted-foreground">
                      {policy.changeReason}
                    </span>
                  ) : null}
                  {policy.cancelledAt !== null && policy.cancellationReason ? (
                    <span className="break-words text-xs text-muted-foreground">
                      {`Cancelled: ${policy.cancellationReason}`}
                    </span>
                  ) : null}
                </div>
                {phase === "scheduled" ? (
                  <Button
                    className="self-start sm:self-auto"
                    disabled={actionPending}
                    onClick={() => openCancelDialog(policy)}
                    variant="danger"
                  >
                    Cancel Future Rules
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <ConfirmationDialog
        confirmLabel="Create Initial Rules"
        description="These rules apply from their effective date until they are replaced. Grace minutes must be whole numbers."
        onCancel={() => setCreateOpen(false)}
        onConfirm={() => void submitInitial()}
        open={createOpen}
        pending={actionPending}
        title="Create Initial Attendance Rules"
      >
        <div className="flex flex-col gap-4">
          {createError ? <Notice tone="error">{createError}</Notice> : null}
          <Field htmlFor="rules-create-from" label="Effective from" required>
            <TextInput
              disabled={actionPending}
              id="rules-create-from"
              onChange={event => setCreateEffectiveFrom(event.target.value)}
              type="date"
              value={createEffectiveFrom}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor="rules-create-late" label="Late grace (minutes)" required>
              <TextInput
                disabled={actionPending}
                id="rules-create-late"
                inputMode="numeric"
                min={0}
                onChange={event => setCreateLateGrace(event.target.value)}
                type="number"
                value={createLateGrace}
              />
            </Field>
            <Field htmlFor="rules-create-early" label="Early leave grace (minutes)" required>
              <TextInput
                disabled={actionPending}
                id="rules-create-early"
                inputMode="numeric"
                min={0}
                onChange={event => setCreateEarlyGrace(event.target.value)}
                type="number"
                value={createEarlyGrace}
              />
            </Field>
          </div>
        </div>
      </ConfirmationDialog>

      <ConfirmationDialog
        confirmLabel="Replace Rules"
        description="The new rules take effect from the future date you choose. The current rules keep applying until then."
        onCancel={() => setReplaceOpen(false)}
        onConfirm={() => void submitReplace()}
        open={replaceOpen}
        pending={actionPending}
        title="Replace Attendance Rules"
      >
        <div className="flex flex-col gap-4">
          {replaceError ? <Notice tone="error">{replaceError}</Notice> : null}
          <Field
            htmlFor="rules-replace-from"
            label="Effective from"
            required
            hint="The replacement must start on a future date."
          >
            <TextInput
              disabled={actionPending}
              id="rules-replace-from"
              min={nextDay(today)}
              onChange={event => setReplaceEffectiveFrom(event.target.value)}
              type="date"
              value={replaceEffectiveFrom}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor="rules-replace-late" label="Late grace (minutes)" required>
              <TextInput
                disabled={actionPending}
                id="rules-replace-late"
                inputMode="numeric"
                min={0}
                onChange={event => setReplaceLateGrace(event.target.value)}
                type="number"
                value={replaceLateGrace}
              />
            </Field>
            <Field htmlFor="rules-replace-early" label="Early leave grace (minutes)" required>
              <TextInput
                disabled={actionPending}
                id="rules-replace-early"
                inputMode="numeric"
                min={0}
                onChange={event => setReplaceEarlyGrace(event.target.value)}
                type="number"
                value={replaceEarlyGrace}
              />
            </Field>
          </div>
          <Field htmlFor="rules-replace-reason" label="Change reason" required>
            <TextInput
              disabled={actionPending}
              id="rules-replace-reason"
              onChange={event => setReplaceReason(event.target.value)}
              value={replaceReason}
            />
          </Field>
        </div>
      </ConfirmationDialog>

      <ConfirmationDialog
        confirmLabel="Cancel Future Rules"
        description="The scheduled future rules will be cancelled and the previous rules will continue. This is not a deletion."
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => void submitCancel()}
        open={cancelTarget !== null}
        pending={actionPending}
        title="Cancel Future Attendance Rules"
      >
        <div className="flex flex-col gap-4">
          {cancelError ? <Notice tone="error">{cancelError}</Notice> : null}
          <Field htmlFor="rules-cancel-reason" label="Cancellation reason" required>
            <TextInput
              disabled={actionPending}
              id="rules-cancel-reason"
              onChange={event => setCancelReason(event.target.value)}
              value={cancelReason}
            />
          </Field>
        </div>
      </ConfirmationDialog>
    </Card>
  );
}

function nextDay(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}
