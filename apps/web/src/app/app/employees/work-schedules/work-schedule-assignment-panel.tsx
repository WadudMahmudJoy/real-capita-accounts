"use client";

import { useState, type FormEvent } from "react";
import type {
  EffectiveWorkSchedule,
  EmployeeListItem,
  WorkScheduleAssignment,
  WorkScheduleDefinition,
} from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Notice,
  Select,
  StatusBadge,
  TextArea,
  TextInput,
} from "../../_components/ui";
import {
  employeeOverridesForDisplay,
  formatScheduleDate,
  minuteLabel,
  nextBusinessDate,
} from "./work-schedule-view";

type CreateOverrideValue = {
  employeeId: string;
  workScheduleId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export function WorkScheduleAssignmentPanel({
  employees,
  schedules,
  assignments,
  businessDate,
  onCreate,
  onCreateDefinition,
  onEnd,
  onRequestCancel,
  onResolve,
}: {
  employees: EmployeeListItem[];
  schedules: WorkScheduleDefinition[];
  assignments: WorkScheduleAssignment[];
  businessDate: string;
  onCreate: (value: CreateOverrideValue) => Promise<void>;
  onCreateDefinition: () => void;
  onEnd: (
    row: WorkScheduleAssignment,
    effectiveTo: string,
    reason: string,
  ) => Promise<void>;
  onRequestCancel: (row: WorkScheduleAssignment) => void;
  onResolve: (
    employeeId: string,
    businessDate: string,
  ) => Promise<EffectiveWorkSchedule>;
}) {
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [workScheduleId, setWorkScheduleId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewEmployeeId, setPreviewEmployeeId] = useState("");
  const [previewDate, setPreviewDate] = useState(businessDate);
  const [preview, setPreview] = useState<EffectiveWorkSchedule | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const activeSchedules = schedules.filter((schedule) => schedule.isActive);
  const overrides = assignments.filter(
    (row) => row.scope === "EMPLOYEE_OVERRIDE",
  );
  const visible = employeeOverridesForDisplay(overrides, businessDate);
  const minimumDate = nextBusinessDate(businessDate);
  const employeeById = new Map(
    employees.map((employee) => [employee.id, employee]),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employeeId || !workScheduleId || !effectiveFrom) {
      setError("Employee, Work Schedule, and Effective From are required.");
      return;
    }
    if (effectiveFrom < minimumDate) {
      setError(`Effective From must be ${minimumDate} or later.`);
      return;
    }
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      setError("Effective Until must be later than Effective From.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        employeeId,
        workScheduleId,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
      });
      setEmployeeId("");
      setWorkScheduleId("");
      setEffectiveFrom("");
      setEffectiveTo("");
      setOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to set the Employee override.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function resolvePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!previewEmployeeId || !previewDate) {
      setPreviewError("Employee and Business Date are required.");
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    setPreview(null);
    try {
      setPreview(await onResolve(previewEmployeeId, previewDate));
    } catch (caught) {
      setPreviewError(
        caught instanceof Error
          ? caught.message
          : "Unable to resolve the effective schedule.",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader
        actions={
          <Button
            aria-controls="employee-override-form"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            variant="secondary"
          >
            {open ? "Close" : "Set Employee Override"}
          </Button>
        }
        description="Use only when an active Employee needs a different schedule. The company schedule resumes after the optional end date."
        title="Employee Schedule Override"
      />
      {open ? (
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          id="employee-override-form"
          onSubmit={submit}
        >
          <Field htmlFor="override-employee" label="Employee" required>
            <Select
              id="override-employee"
              onChange={(event) => setEmployeeId(event.target.value)}
              required
              value={employeeId}
            >
              <option value="">Select active Employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employeeCode} - {employee.fullName}
                </option>
              ))}
            </Select>
          </Field>
          <Field htmlFor="override-schedule" label="Work Schedule" required>
            <Select
              id="override-schedule"
              onChange={(event) => setWorkScheduleId(event.target.value)}
              required
              value={workScheduleId}
            >
              <option value="">Select active schedule</option>
              {activeSchedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {schedule.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field htmlFor="override-from" label="Effective From" required>
            <TextInput
              id="override-from"
              min={minimumDate}
              onChange={(event) => setEffectiveFrom(event.target.value)}
              required
              type="date"
              value={effectiveFrom}
            />
          </Field>
          <Field
            htmlFor="override-until"
            hint="This schedule stops applying on this date."
            label="Effective Until"
          >
            <TextInput
              id="override-until"
              min={effectiveFrom ? nextBusinessDate(effectiveFrom) : minimumDate}
              onChange={(event) => setEffectiveTo(event.target.value)}
              type="date"
              value={effectiveTo}
            />
          </Field>
          {error ? (
            <div className="sm:col-span-2">
              <Notice tone="error">{error}</Notice>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <Button disabled={saving} type="submit">
              {saving ? "Saving..." : "Set Employee Override"}
            </Button>
            <Button onClick={onCreateDefinition} variant="ghost">
              Create a different schedule
            </Button>
          </div>
        </form>
      ) : null}

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="text-sm font-semibold text-foreground">
          Check Effective Schedule
        </h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Confirm which schedule applies to an Employee on a Real Capita business date.
        </p>
        <form className="mt-3 grid gap-3 sm:grid-cols-3" onSubmit={resolvePreview}>
          <Field htmlFor="preview-employee" label="Employee" required>
            <Select
              id="preview-employee"
              onChange={(event) => setPreviewEmployeeId(event.target.value)}
              required
              value={previewEmployeeId}
            >
              <option value="">Select active Employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employeeCode} - {employee.fullName}
                </option>
              ))}
            </Select>
          </Field>
          <Field htmlFor="preview-date" label="Business Date" required>
            <TextInput
              id="preview-date"
              onChange={(event) => setPreviewDate(event.target.value)}
              required
              type="date"
              value={previewDate}
            />
          </Field>
          <div className="flex items-end">
            <Button className="w-full sm:w-auto" disabled={previewLoading} type="submit">
              {previewLoading ? "Checking..." : "Check Schedule"}
            </Button>
          </div>
        </form>
        {previewError ? (
          <div className="mt-3">
            <Notice tone="error">{previewError}</Notice>
          </div>
        ) : null}
        {preview ? (
          <div className="mt-3 rounded-lg border border-border bg-background p-4">
            {preview.kind === "NOT_CONFIGURED" ? (
              <Notice tone="info">
                No Work Schedule is configured for this Employee and date.
              </Notice>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="break-words font-medium [overflow-wrap:anywhere]">
                    {preview.name}
                  </p>
                  <StatusBadge tone={preview.source === "EMPLOYEE_OVERRIDE" ? "neutral" : "active"}>
                    {preview.source === "EMPLOYEE_OVERRIDE"
                      ? "Employee override"
                      : "Company schedule"}
                  </StatusBadge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {preview.isWorkingDay
                    ? `${minuteLabel(preview.startMinuteOfDay)} – ${minuteLabel(preview.endMinuteOfDay)} · ${preview.unpaidBreakMinutes} min break · ${preview.expectedWorkMinutes} expected work minutes`
                    : "Scheduled weekly rest day"}
                </p>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="text-sm font-semibold text-foreground">Override history</h3>
        {visible.length ? (
          <div className="mt-3 grid gap-3">
            {visible.map((row) => {
              const employee = row.employeeId
                ? employeeById.get(row.employeeId)
                : undefined;
              const isCancelled = Boolean(row.cancelledAt);
              const isPlanned = !isCancelled && row.effectiveFrom > businessDate;
              const isCurrent =
                !isCancelled &&
                row.effectiveFrom <= businessDate &&
                (!row.effectiveTo || row.effectiveTo > businessDate);
              return (
                <div className="rounded-lg border border-border p-4" key={row.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-medium text-foreground [overflow-wrap:anywhere]">
                        {employee
                          ? `${employee.employeeCode} - ${employee.fullName}`
                          : "Employee record"}
                      </p>
                      <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                        {row.workSchedule.name}
                      </p>
                    </div>
                    <StatusBadge
                      tone={
                        isCancelled
                          ? "closed"
                          : isCurrent
                            ? "active"
                            : isPlanned
                              ? "neutral"
                              : "inactive"
                      }
                    >
                      {isCancelled
                        ? "Cancelled"
                        : isCurrent
                          ? "Current"
                          : isPlanned
                            ? "Planned"
                            : "Ended"}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm">
                    Effective from {formatScheduleDate(row.effectiveFrom)}
                    {row.effectiveTo
                      ? `; stops applying ${formatScheduleDate(row.effectiveTo)}`
                      : " onward"}
                  </p>
                  {!isCancelled && isPlanned ? (
                    <Button
                      className="mt-3"
                      onClick={() => onRequestCancel(row)}
                      variant="danger"
                    >
                      Cancel Planned Override
                    </Button>
                  ) : null}
                  {!isCancelled && isCurrent ? (
                    <EndOverrideForm
                      businessDate={businessDate}
                      onEnd={onEnd}
                      row={row}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState
              description="Employees currently inherit the company schedule."
              title="No Employee overrides"
            />
          </div>
        )}
      </div>
    </Card>
  );
}

function EndOverrideForm({
  row,
  businessDate,
  onEnd,
}: {
  row: WorkScheduleAssignment;
  businessDate: string;
  onEnd: (
    row: WorkScheduleAssignment,
    date: string,
    reason: string,
  ) => Promise<void>;
}) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date || !reason.trim()) {
      setError("Effective Until and Change Reason are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onEnd(row, date, reason.trim());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to end the override.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="mt-3 rounded-md border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Set Effective Until
      </summary>
      <form className="mt-3 grid gap-3" onSubmit={submit}>
        <Field
          htmlFor={`override-end-${row.id}`}
          hint="This schedule stops applying on this date."
          label="Effective Until"
          required
        >
          <TextInput
            id={`override-end-${row.id}`}
            min={nextBusinessDate(businessDate)}
            onChange={(event) => setDate(event.target.value)}
            required
            type="date"
            value={date}
          />
        </Field>
        <Field
          htmlFor={`override-end-reason-${row.id}`}
          label="Change Reason"
          required
        >
          <TextArea
            id={`override-end-reason-${row.id}`}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            required
            value={reason}
          />
        </Field>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button disabled={saving} type="submit">
          {saving ? "Saving..." : "End Override"}
        </Button>
      </form>
    </details>
  );
}
