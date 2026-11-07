"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, RefreshCw } from "lucide-react";
import {
  ApiError,
  cancelWorkScheduleAssignment,
  createWorkSchedule,
  createWorkScheduleAssignment,
  endWorkScheduleAssignment,
  getEmployees,
  getEffectiveWorkSchedule,
  getWorkScheduleAssignments,
  getWorkSchedules,
  replaceWorkScheduleAssignment,
  updateWorkSchedule,
  type EmployeeListItem,
  type WorkScheduleAssignment,
  type WorkScheduleDefinition,
} from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  LoadingPanel,
  Notice,
  PageIntro,
  StatusBadge,
  TextArea,
  TextInput,
  buttonClassName,
} from "../../_components/ui";
import { ConfirmationDialog } from "../../_components/salary-ui";
import { WorkScheduleAssignmentPanel } from "./work-schedule-assignment-panel";
import {
  WorkScheduleForm,
  type WorkScheduleFormMode,
  type WorkScheduleFormValue,
} from "./work-schedule-form";
import {
  DISPLAY_WEEKDAYS,
  formatScheduleDate,
  minuteLabel,
  nextBusinessDate,
  partitionAssignments,
  realCapitaBusinessDate,
  sharedWorkingHours,
  summarizeWorkingDays,
  weekdayLabel,
} from "./work-schedule-view";

const STALE_SCHEDULE_MESSAGE =
  "The Work Schedule changed after this page loaded. The latest information is now shown; please review and try again.";

function workScheduleErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isUnauthorized) {
      return "Your session has expired. Please sign in again.";
    }
    if (error.isForbidden) {
      return "Your account does not have access to Work Schedule settings.";
    }
    if (error.status >= 500 || error.status === 0) {
      return "The server could not complete the request. Please try again.";
    }
    return error.message;
  }
  return "The request could not be completed. Please try again.";
}

function AssignmentSummary({ row }: { row: WorkScheduleAssignment }) {
  const hours = sharedWorkingHours(row.workSchedule.days);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryValue label="Office hours" value={hours.label} />
      <SummaryValue
        label="Working days"
        value={summarizeWorkingDays(row.workSchedule.days)}
      />
      <SummaryValue label="Break" value={hours.breakLabel} />
      <SummaryValue
        label="Effective From"
        value={formatScheduleDate(row.effectiveFrom)}
      />
    </div>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

function ScheduleDayDetails({ schedule }: { schedule: WorkScheduleDefinition }) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {DISPLAY_WEEKDAYS.map((dayOfWeek) => {
        const day = schedule.days.find((row) => row.dayOfWeek === dayOfWeek);
        if (!day) return null;
        return (
          <div className="rounded-md border border-border p-3 text-sm" key={dayOfWeek}>
            <p className="font-medium">{weekdayLabel(dayOfWeek)}</p>
            {day.isWorkingDay ? (
              <p className="mt-1 leading-6 text-muted-foreground">
                {minuteLabel(day.startMinuteOfDay)} – {minuteLabel(day.endMinuteOfDay)}
                {day.crossesMidnight ? " (ends next day)" : ""}
                <br />
                {day.unpaidBreakMinutes} min unpaid break
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground">Weekly rest day</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function WorkScheduleWorkspace() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<WorkScheduleDefinition[]>([]);
  const [assignments, setAssignments] = useState<WorkScheduleAssignment[]>([]);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [formMode, setFormMode] = useState<WorkScheduleFormMode | null>(null);
  const [viewScheduleId, setViewScheduleId] = useState<string | null>(null);
  const [lifecycleTarget, setLifecycleTarget] =
    useState<WorkScheduleDefinition | null>(null);
  const [metadataTarget, setMetadataTarget] =
    useState<WorkScheduleDefinition | null>(null);
  const [metadataName, setMetadataName] = useState("");
  const [metadataDescription, setMetadataDescription] = useState("");
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] =
    useState<WorkScheduleAssignment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [businessDate] = useState(() => realCapitaBusinessDate());

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const [scheduleRows, assignmentRows, employeeRows] = await Promise.all([
          getWorkSchedules(true, signal),
          getWorkScheduleAssignments(undefined, signal),
          getEmployees({ status: "ACTIVE" }, signal),
        ]);
        setSchedules(scheduleRows);
        setAssignments(assignmentRows);
        setEmployees(employeeRows);
        setStatus("ready");
        setError(null);
        return true;
      } catch (caught) {
        if (signal?.aborted) return false;
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return false;
        }
        setError(workScheduleErrorMessage(caught));
        setStatus("error");
        return false;
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

  const defaults = assignments.filter((row) => row.scope === "COMPANY_DEFAULT");
  const defaultPartition = partitionAssignments(defaults, businessDate);
  const current = defaultPartition.current;
  const planned = defaultPartition.planned;
  const history = defaultPartition.history;
  const minimumFutureDate = nextBusinessDate(businessDate);
  const viewedSchedule = schedules.find((row) => row.id === viewScheduleId);

  async function refresh(successMessage: string) {
    if (!(await load())) return;
    setMessage(successMessage);
    setError(null);
    setFormMode(null);
  }

  async function rethrowControlled(caught: unknown): Promise<never> {
    if (caught instanceof ApiError && caught.isUnauthorized) {
      router.replace("/login");
    }
    if (caught instanceof ApiError && caught.status === 409) {
      await load();
      throw new Error(STALE_SCHEDULE_MESSAGE);
    }
    throw new Error(workScheduleErrorMessage(caught));
  }

  async function submitScheduleForm(value: WorkScheduleFormValue) {
    try {
      if (formMode === "initial") {
        await createWorkScheduleAssignment({
          scope: "COMPANY_DEFAULT",
          effectiveFrom: value.effectiveDate,
          newSchedule: { ...value.definition, code: "STANDARD_OFFICE" },
        });
        await refresh("The initial company Work Schedule is configured.");
        return;
      }
      if (formMode === "change" && current) {
        await replaceWorkScheduleAssignment(current.id, {
          effectiveFrom: value.effectiveDate,
          newSchedule: value.definition,
          changeReason: value.reason,
          expectedUpdatedAt: current.updatedAt,
        });
        await refresh("The future office-hours change is scheduled.");
        return;
      }
      if (formMode === "definition") {
        await createWorkSchedule(value.definition);
        await refresh("The reusable Work Schedule is ready for assignment.");
        return;
      }
      throw new Error("Reload Work Schedule settings and try again.");
    } catch (caught) {
      await rethrowControlled(caught);
    }
  }

  async function runLifecycleAction() {
    if (!lifecycleTarget || actionPending) return;
    setActionPending(true);
    setError(null);
    try {
      const activating = !lifecycleTarget.isActive;
      await updateWorkSchedule(lifecycleTarget.id, { isActive: activating });
      setLifecycleTarget(null);
      await refresh(
        activating
          ? "The Work Schedule is active and available for new assignments."
          : "The Work Schedule is inactive. Existing and historical assignments remain valid.",
      );
    } catch (caught) {
      setLifecycleTarget(null);
      if (caught instanceof ApiError && caught.status === 409) {
        await load();
        setError(STALE_SCHEDULE_MESSAGE);
      } else {
        setError(workScheduleErrorMessage(caught));
      }
    } finally {
      setActionPending(false);
    }
  }

  async function runCancelAction() {
    if (!cancelTarget || actionPending) return;
    if (!cancelReason.trim()) {
      setCancelError("Change Reason is required.");
      return;
    }
    setActionPending(true);
    setCancelError(null);
    try {
      await cancelWorkScheduleAssignment(cancelTarget.id, {
        changeReason: cancelReason.trim(),
        expectedUpdatedAt: cancelTarget.updatedAt,
      });
      setCancelTarget(null);
      setCancelReason("");
      await refresh("The future schedule change was cancelled safely.");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setCancelTarget(null);
        setCancelReason("");
        await load();
        setError(STALE_SCHEDULE_MESSAGE);
      } else {
        setCancelError(workScheduleErrorMessage(caught));
      }
    } finally {
      setActionPending(false);
    }
  }

  function openMetadataEditor(schedule: WorkScheduleDefinition) {
    setMetadataTarget(schedule);
    setMetadataName(schedule.name);
    setMetadataDescription(schedule.description ?? "");
    setMetadataError(null);
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!metadataTarget || actionPending) return;
    if (!metadataName.trim()) {
      setMetadataError("Schedule Name is required.");
      return;
    }
    setActionPending(true);
    setMetadataError(null);
    try {
      await updateWorkSchedule(metadataTarget.id, {
        name: metadataName.trim(),
        description: metadataDescription.trim() || null,
      });
      setMetadataTarget(null);
      await refresh("The Work Schedule details were updated.");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setMetadataTarget(null);
        await load();
        setError(STALE_SCHEDULE_MESSAGE);
      } else {
        setMetadataError(workScheduleErrorMessage(caught));
      }
    } finally {
      setActionPending(false);
    }
  }

  if (status === "loading") {
    return <LoadingPanel message="Loading Work Schedules..." />;
  }

  if (status === "error") {
    return (
      <div>
        <Notice tone="error">{error}</Notice>
        <Button className="mt-4" onClick={() => void load()}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageIntro
          description="Maintain expected weekly office hours without overwriting historical schedules."
          title="Work Schedule Settings"
        />
        <Link
          className={buttonClassName({ variant: "ghost" })}
          href="/app/employees"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Employees
        </Link>
      </div>

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {!current ? (
        <Notice tone="info">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">No work schedule configured</p>
              <p className="mt-1 text-sm">
                {assignments.length === 0
                  ? "Set the approved initial company schedule to continue."
                  : planned.length
                    ? `A future schedule starts ${formatScheduleDate(planned[0].effectiveFrom)}.`
                    : "No company schedule applies today. Review the assignment history before making another change."}
              </p>
            </div>
            {assignments.length === 0 ? (
              <Button onClick={() => setFormMode("initial")}>Set Work Schedule</Button>
            ) : null}
          </div>
        </Notice>
      ) : (
        <Card>
          <CardHeader
            actions={
              <div className="flex flex-wrap gap-2">
                <Button
                  aria-expanded={viewScheduleId === current.workSchedule.id}
                  onClick={() =>
                    setViewScheduleId((value) =>
                      value === current.workSchedule.id
                        ? null
                        : current.workSchedule.id,
                    )
                  }
                  variant="ghost"
                >
                  <Eye aria-hidden="true" className="size-4" />
                  View
                </Button>
                <Button onClick={() => setFormMode("change")}>
                  Change Office Hours
                </Button>
              </div>
            }
            title="Current Office Hours"
          />
          <p className="mt-4 break-words text-sm font-semibold [overflow-wrap:anywhere]">
            {current.workSchedule.name}
          </p>
          <div className="mt-5">
            <AssignmentSummary row={current} />
          </div>
          {current.effectiveTo ? (
            <p className="mt-3 text-sm text-muted-foreground">
              This schedule stops applying on {formatScheduleDate(current.effectiveTo)}.
            </p>
          ) : null}
          {viewedSchedule?.id === current.workSchedule.id ? (
            <ScheduleDayDetails schedule={viewedSchedule} />
          ) : null}
        </Card>
      )}

      {formMode ? (
        <Card>
          <CardHeader
            description={
              formMode === "initial"
                ? "Review the approved Real Capita defaults, then save explicitly."
                : formMode === "change"
                  ? "The current schedule remains unchanged. A new schedule starts on the chosen date."
                  : "Create a reusable weekly schedule before assigning it to an Employee."
            }
            title={
              formMode === "initial"
                ? "Set Work Schedule"
                : formMode === "change"
                  ? "Change Office Hours"
                  : "Create Reusable Work Schedule"
            }
          />
          <WorkScheduleForm
            initial={
              formMode === "change" && current
                ? {
                    name: current.workSchedule.name,
                    description: current.workSchedule.description,
                    days: current.workSchedule.days,
                  }
                : undefined
            }
            minimumEffectiveDate={
              formMode === "change" ? minimumFutureDate : undefined
            }
            mode={formMode}
            onCancel={() => setFormMode(null)}
            onSubmit={submitScheduleForm}
            submitLabel={
              formMode === "initial"
                ? "Set Work Schedule"
                : formMode === "change"
                  ? "Schedule Office Hours Change"
                  : "Create Work Schedule"
            }
          />
        </Card>
      ) : null}

      <Card>
        <CardHeader
          description="Future company schedule changes are shown separately from the hours applying today."
          title="Planned Changes"
        />
        {planned.length ? (
          <div className="mt-4 grid gap-3">
            {planned.map((row) => (
              <div className="rounded-lg border border-border p-4" key={row.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{row.workSchedule.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Starts {formatScheduleDate(row.effectiveFrom)}
                    </p>
                  </div>
                  <StatusBadge tone="neutral">Planned</StatusBadge>
                </div>
                <div className="mt-4">
                  <AssignmentSummary row={row} />
                </div>
                <Button
                  className="mt-4"
                  onClick={() => {
                    setCancelTarget(row);
                    setCancelReason("");
                    setCancelError(null);
                  }}
                  variant="danger"
                >
                  Cancel Planned Change
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              description="Future office-hours changes will appear here."
              title="No planned changes"
            />
          </div>
        )}
      </Card>

      <WorkScheduleAssignmentPanel
        assignments={assignments}
        businessDate={businessDate}
        employees={employees}
        onCreate={async (value) => {
          try {
            await createWorkScheduleAssignment({
              scope: "EMPLOYEE_OVERRIDE",
              ...value,
            });
            await refresh("The Employee Work Schedule override is planned.");
          } catch (caught) {
            await rethrowControlled(caught);
          }
        }}
        onCreateDefinition={() => setFormMode("definition")}
        onEnd={async (row, effectiveTo, reason) => {
          try {
            await endWorkScheduleAssignment(row.id, {
              effectiveTo,
              changeReason: reason,
              expectedUpdatedAt: row.updatedAt,
            });
            await refresh("The Employee override end date is saved.");
          } catch (caught) {
            await rethrowControlled(caught);
          }
        }}
        onRequestCancel={(row) => {
          setCancelTarget(row);
          setCancelReason("");
          setCancelError(null);
        }}
        onResolve={async (employeeId, date) => {
          try {
            return await getEffectiveWorkSchedule(date, employeeId);
          } catch (caught) {
            return rethrowControlled(caught);
          }
        }}
        schedules={schedules}
      />

      <Card>
        <CardHeader
          actions={
            <Button onClick={() => setFormMode("definition")} variant="secondary">
              Create Reusable Schedule
            </Button>
          }
          description="Inactive schedules cannot receive new assignments. Their existing and historical assignments remain valid."
          title="Work Schedule Definitions"
        />
        {schedules.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {schedules.map((schedule) => (
              <div className="rounded-lg border border-border p-4" key={schedule.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-medium [overflow-wrap:anywhere]">
                      {schedule.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {summarizeWorkingDays(schedule.days)} · {sharedWorkingHours(schedule.days).label}
                    </p>
                  </div>
                  <StatusBadge tone={schedule.isActive ? "active" : "inactive"}>
                    {schedule.isActive ? "Active" : "Inactive"}
                  </StatusBadge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    aria-expanded={viewScheduleId === schedule.id}
                    onClick={() =>
                      setViewScheduleId((value) =>
                        value === schedule.id ? null : schedule.id,
                      )
                    }
                    variant="ghost"
                  >
                    <Eye aria-hidden="true" className="size-4" />
                    View
                  </Button>
                  <Button onClick={() => openMetadataEditor(schedule)} variant="ghost">
                    Edit Details
                  </Button>
                  <Button
                    onClick={() => setLifecycleTarget(schedule)}
                    variant="secondary"
                  >
                    {schedule.isActive ? "Inactivate" : "Reactivate"}
                  </Button>
                </div>
                {metadataTarget?.id === schedule.id ? (
                  <form
                    className="mt-4 grid gap-3 rounded-lg border border-border bg-background p-4"
                    onSubmit={saveMetadata}
                  >
                    <Field
                      htmlFor={`schedule-name-${schedule.id}`}
                      label="Schedule Name"
                      required
                    >
                      <TextInput
                        id={`schedule-name-${schedule.id}`}
                        maxLength={150}
                        onChange={(event) => setMetadataName(event.target.value)}
                        required
                        value={metadataName}
                      />
                    </Field>
                    <Field
                      htmlFor={`schedule-description-${schedule.id}`}
                      label="Description"
                    >
                      <TextArea
                        id={`schedule-description-${schedule.id}`}
                        maxLength={500}
                        onChange={(event) =>
                          setMetadataDescription(event.target.value)
                        }
                        value={metadataDescription}
                      />
                    </Field>
                    {metadataError ? (
                      <Notice tone="error">{metadataError}</Notice>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={actionPending} type="submit">
                        {actionPending ? "Saving..." : "Save Details"}
                      </Button>
                      <Button
                        disabled={actionPending}
                        onClick={() => setMetadataTarget(null)}
                        variant="secondary"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : null}
                {viewScheduleId === schedule.id ? (
                  <>
                    {schedule.description ? (
                      <p className="mt-3 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                        {schedule.description}
                      </p>
                    ) : null}
                    <ScheduleDayDetails schedule={schedule} />
                    {schedule.everAssigned ? (
                      <Notice tone="info">
                        Weekly timing is locked because this schedule has assignment history.
                      </Notice>
                    ) : null}
                  </>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              description="The first setup creates the initial reusable schedule."
              title="No Work Schedule definitions"
            />
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          description="Completed and cancelled company assignments remain visible for historical reference."
          title="Company Schedule History"
        />
        {history.length ? (
          <div className="mt-4 grid gap-3">
            {history.map((row) => (
              <div className="rounded-lg border border-border p-4" key={row.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">
                    {row.workSchedule.name}
                  </p>
                  <StatusBadge tone={row.cancelledAt ? "closed" : "inactive"}>
                    {row.cancelledAt ? "Cancelled" : "Ended"}
                  </StatusBadge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Effective from {formatScheduleDate(row.effectiveFrom)}
                  {row.effectiveTo
                    ? `; stopped applying ${formatScheduleDate(row.effectiveTo)}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              description="Schedule changes preserve prior assignments here."
              title="No completed history"
            />
          </div>
        )}
      </Card>

      <ConfirmationDialog
        confirmLabel={lifecycleTarget?.isActive ? "Inactivate" : "Reactivate"}
        description={
          lifecycleTarget?.isActive
            ? "This schedule will not be available for new assignments. Existing and historical assignments remain valid."
            : "This schedule will become available for new assignments again."
        }
        onCancel={() => setLifecycleTarget(null)}
        onConfirm={() => void runLifecycleAction()}
        open={Boolean(lifecycleTarget)}
        pending={actionPending}
        title={lifecycleTarget?.isActive ? "Inactivate Work Schedule?" : "Reactivate Work Schedule?"}
      />

      <ConfirmationDialog
        confirmLabel="Cancel Future Change"
        description="Only an unstarted future assignment can be cancelled. A linked predecessor is restored only when its boundary is still safe."
        onCancel={() => {
          setCancelTarget(null);
          setCancelReason("");
          setCancelError(null);
        }}
        onConfirm={() => void runCancelAction()}
        open={Boolean(cancelTarget)}
        pending={actionPending}
        title="Cancel Planned Schedule?"
      >
        <Field htmlFor="cancel-schedule-reason" label="Change Reason" required>
          <TextArea
            id="cancel-schedule-reason"
            maxLength={500}
            onChange={(event) => setCancelReason(event.target.value)}
            required
            value={cancelReason}
          />
        </Field>
        {cancelError ? (
          <div className="mt-3">
            <Notice tone="error">{cancelError}</Notice>
          </div>
        ) : null}
      </ConfirmationDialog>
    </div>
  );
}
