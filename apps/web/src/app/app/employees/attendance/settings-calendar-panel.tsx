"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  cancelCalendarException,
  createCalendarException,
  getCalendarExceptions,
  historicalCalendarCorrect,
  updateCalendarException,
  type CalendarException,
  type CalendarExceptionType,
} from "@/lib/attendance-api";
import {
  Button,
  Card,
  CardHeader,
  CheckboxField,
  EmptyState,
  Field,
  LoadingPanel,
  Notice,
  Select,
  StatusBadge,
  TextInput,
} from "../../_components/ui";
import { ConfirmationDialog, Detail } from "../../_components/salary-ui";
import { businessDateLabel, dhakaToday, minuteLabel } from "./attendance-view";

const HISTORICAL_WARNING =
  "This changes the historical calendar interpretation for a finalized attendance date. Applicable attendance records may be re-evaluated and new correction history may be created. Existing history is not deleted.";

function calendarErrorMessage(error: unknown): string {
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

function toMinutes(value: string): number | null {
  if (value === "") return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function fromMinutes(value: number | null): string {
  if (value === null) return "";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function isNonNegativeInteger(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function exceptionStatusLabel(exception: CalendarException): "live" | "superseded" | "cancelled" {
  if (exception.cancelledAt !== null) return "cancelled";
  if (exception.supersededAt !== null) return "superseded";
  return "live";
}

function exceptionWindowLabel(exception: CalendarException): string {
  if (exception.exceptionType === "HOLIDAY") return "Full day";
  const start = minuteLabel(exception.startMinuteOfDay);
  const end = minuteLabel(exception.endMinuteOfDay);
  const overnight = exception.crossesMidnight ? " (ends next day)" : "";
  const breakMinutes =
    exception.unpaidBreakMinutes > 0 ? ` · ${exception.unpaidBreakMinutes} min break` : "";
  return `${start} – ${end}${overnight}${breakMinutes}`;
}

export function SettingsCalendarPanel() {
  const router = useRouter();
  const today = dhakaToday();
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(`${Number(today.slice(0, 4)) + 1}-12-31`);
  const [exceptions, setExceptions] = useState<CalendarException[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [exceptionType, setExceptionType] = useState<CalendarExceptionType>("HOLIDAY");
  const [createName, setCreateName] = useState("");
  const [createDate, setCreateDate] = useState("");
  const [createStart, setCreateStart] = useState("");
  const [createEnd, setCreateEnd] = useState("");
  const [createBreak, setCreateBreak] = useState("0");
  const [createOvernight, setCreateOvernight] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<CalendarException | null>(null);
  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editBreak, setEditBreak] = useState("0");
  const [editOvernight, setEditOvernight] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [cancelTarget, setCancelTarget] = useState<CalendarException | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [historicalOpen, setHistoricalOpen] = useState(false);
  const [historicalDate, setHistoricalDate] = useState("");
  const [historicalTarget, setHistoricalTarget] = useState<"HOLIDAY" | "SPECIAL_WORKING_DAY" | "NONE">("HOLIDAY");
  const [historicalName, setHistoricalName] = useState("");
  const [historicalStart, setHistoricalStart] = useState("");
  const [historicalEnd, setHistoricalEnd] = useState("");
  const [historicalBreak, setHistoricalBreak] = useState("0");
  const [historicalOvernight, setHistoricalOvernight] = useState(false);
  const [historicalReason, setHistoricalReason] = useState("");
  const [historicalError, setHistoricalError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const rows = await getCalendarExceptions(from, to, signal);
        if (signal?.aborted) return;
        setExceptions(rows);
        setError(null);
        setLoading(false);
      } catch (caught) {
        if (signal?.aborted) return;
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }
        setError(calendarErrorMessage(caught));
        setLoading(false);
      }
    },
    [from, router, to],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  function validateWorkingWindow(start: string, end: string, breakMinutes: string): string | null {
    if (toMinutes(start) === null) return "Start time is required.";
    if (toMinutes(end) === null) return "End time is required.";
    if (toMinutes(start) === toMinutes(end)) return "Start and end times cannot be equal.";
    if (!isNonNegativeInteger(breakMinutes)) return "Enter the unpaid break in whole minutes.";
    return null;
  }

  function openCreateForm() {
    setExceptionType("HOLIDAY");
    setCreateName("");
    setCreateDate("");
    setCreateStart("");
    setCreateEnd("");
    setCreateBreak("0");
    setCreateOvernight(false);
    setCreateError(null);
    setCreateOpen(true);
  }

  async function submitCreate() {
    if (!createName.trim()) {
      setCreateError("Name is required.");
      return;
    }
    if (!createDate) {
      setCreateError("Business date is required.");
      return;
    }
    if (exceptionType === "SPECIAL_WORKING_DAY") {
      const windowError = validateWorkingWindow(createStart, createEnd, createBreak);
      if (windowError) {
        setCreateError(windowError);
        return;
      }
    }
    setActionPending(true);
    setCreateError(null);
    try {
      await createCalendarException({
        businessDate: createDate,
        exceptionType,
        name: createName.trim(),
        ...(exceptionType === "SPECIAL_WORKING_DAY"
          ? {
              startMinuteOfDay: toMinutes(createStart)!,
              endMinuteOfDay: toMinutes(createEnd)!,
              unpaidBreakMinutes: Number(createBreak),
              crossesMidnight: createOvernight,
            }
          : {}),
      });
      setCreateOpen(false);
      setMessage("The calendar exception was created.");
      await load();
    } catch (caught) {
      setCreateError(calendarErrorMessage(caught));
    } finally {
      setActionPending(false);
    }
  }

  function openEditDialog(exception: CalendarException) {
    setEditTarget(exception);
    setEditName(exception.name);
    setEditStart(fromMinutes(exception.startMinuteOfDay));
    setEditEnd(fromMinutes(exception.endMinuteOfDay));
    setEditBreak(String(exception.unpaidBreakMinutes));
    setEditOvernight(exception.crossesMidnight);
    setEditError(null);
  }

  async function submitEdit() {
    if (!editTarget) return;
    if (!editName.trim()) {
      setEditError("Name is required.");
      return;
    }
    if (editTarget.exceptionType === "SPECIAL_WORKING_DAY") {
      const windowError = validateWorkingWindow(editStart, editEnd, editBreak);
      if (windowError) {
        setEditError(windowError);
        return;
      }
    }
    setActionPending(true);
    setEditError(null);
    try {
      await updateCalendarException(editTarget.id, {
        name: editName.trim(),
        ...(editTarget.exceptionType === "SPECIAL_WORKING_DAY"
          ? {
              startMinuteOfDay: toMinutes(editStart)!,
              endMinuteOfDay: toMinutes(editEnd)!,
              unpaidBreakMinutes: Number(editBreak),
              crossesMidnight: editOvernight,
            }
          : {}),
      });
      setEditTarget(null);
      setMessage("The calendar exception was updated.");
      await load();
    } catch (caught) {
      setEditError(calendarErrorMessage(caught));
    } finally {
      setActionPending(false);
    }
  }

  function openCancelDialog(exception: CalendarException) {
    setCancelTarget(exception);
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
      await cancelCalendarException(cancelTarget.id, {
        cancellationReason: cancelReason.trim(),
      });
      setCancelTarget(null);
      setMessage("The calendar exception was cancelled.");
      await load();
    } catch (caught) {
      setCancelError(calendarErrorMessage(caught));
    } finally {
      setActionPending(false);
    }
  }

  function openHistoricalForm() {
    setHistoricalDate("");
    setHistoricalTarget("HOLIDAY");
    setHistoricalName("");
    setHistoricalStart("");
    setHistoricalEnd("");
    setHistoricalBreak("0");
    setHistoricalOvernight(false);
    setHistoricalReason("");
    setHistoricalError(null);
    setHistoricalOpen(true);
  }

  async function submitHistorical() {
    if (!historicalDate) {
      setHistoricalError("Business date is required.");
      return;
    }
    if (historicalTarget !== "NONE" && !historicalName.trim()) {
      setHistoricalError("Name is required.");
      return;
    }
    if (historicalTarget === "SPECIAL_WORKING_DAY") {
      const windowError = validateWorkingWindow(historicalStart, historicalEnd, historicalBreak);
      if (windowError) {
        setHistoricalError(windowError);
        return;
      }
    }
    if (!historicalReason.trim()) {
      setHistoricalError("Change reason is required.");
      return;
    }
    setActionPending(true);
    setHistoricalError(null);
    try {
      const result = await historicalCalendarCorrect({
        businessDate: historicalDate,
        target: historicalTarget,
        ...(historicalTarget === "NONE" ? {} : { name: historicalName.trim() }),
        ...(historicalTarget === "SPECIAL_WORKING_DAY"
          ? {
              startMinuteOfDay: toMinutes(historicalStart)!,
              endMinuteOfDay: toMinutes(historicalEnd)!,
              unpaidBreakMinutes: Number(historicalBreak),
              crossesMidnight: historicalOvernight,
            }
          : {}),
        changeReason: historicalReason.trim(),
      });
      setHistoricalOpen(false);
      setMessage(
        `The historical calendar correction was completed. ${result.attendanceRevisionsCreated} attendance record${result.attendanceRevisionsCreated === 1 ? " was" : "s were"} re-evaluated.`,
      );
      await load();
    } catch (caught) {
      setHistoricalError(calendarErrorMessage(caught));
    } finally {
      setActionPending(false);
    }
  }

  return (
    <Card>
      <CardHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={openCreateForm} variant="secondary">
              Add Exception
            </Button>
            <Button onClick={openHistoricalForm}>Correct Historical Calendar</Button>
          </div>
        }
        description="Holidays and special working days override the normal weekly schedule on their date. Historical corrections apply to finalized dates."
        title="Calendar & Holidays"
      />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field htmlFor="calendar-from" label="From date">
          <TextInput
            id="calendar-from"
            max={to}
            onChange={event => setFrom(event.target.value)}
            type="date"
            value={from}
          />
        </Field>
        <Field htmlFor="calendar-to" label="To date">
          <TextInput
            id="calendar-to"
            min={from}
            onChange={event => setTo(event.target.value)}
            type="date"
            value={to}
          />
        </Field>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {message ? <Notice tone="success">{message}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        {loading ? <LoadingPanel message="Loading calendar exceptions..." /> : null}
        {!loading && exceptions.length === 0 ? (
          <EmptyState
            description="No calendar exceptions are configured in this date range."
            title="No calendar exceptions"
          />
        ) : null}
        <ul className="flex flex-col gap-3">
          {exceptions.map((exception, index) => {
            const status = exceptionStatusLabel(exception);
            return (
              <li
                className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4"
                key={`${exception.businessDate}-${exception.name}-${index}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {status === "live" ? (
                        <StatusBadge tone="active">
                          {exception.exceptionType === "HOLIDAY" ? "Holiday" : "Special Working Day"}
                        </StatusBadge>
                      ) : status === "superseded" ? (
                        <StatusBadge tone="inactive">Superseded</StatusBadge>
                      ) : (
                        <StatusBadge tone="inactive">Cancelled</StatusBadge>
                      )}
                      <span className="text-sm font-medium text-foreground">
                        {exception.name}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {businessDateLabel(exception.businessDate)}
                    </span>
                    {status === "live" ? (
                      <span className="text-sm text-muted-foreground">
                        {exceptionWindowLabel(exception)}
                      </span>
                    ) : null}
                    {exception.cancelledAt !== null && exception.cancellationReason ? (
                      <span className="break-words text-xs text-muted-foreground">
                        {`Cancelled: ${exception.cancellationReason}`}
                      </span>
                    ) : null}
                  </div>
                  {status === "live" ? (
                    <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                      <Button
                        disabled={actionPending}
                        onClick={() => openEditDialog(exception)}
                        variant="secondary"
                      >
                        Edit
                      </Button>
                      <Button
                        disabled={actionPending}
                        onClick={() => openCancelDialog(exception)}
                        variant="danger"
                      >
                        Cancel Exception
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <ConfirmationDialog
        confirmLabel="Create Exception"
        description="Holidays remove attendance requirements for the date. Special working days replace the normal schedule with the times you set."
        onCancel={() => setCreateOpen(false)}
        onConfirm={() => void submitCreate()}
        open={createOpen}
        pending={actionPending}
        title="Add Calendar Exception"
      >
        <div className="flex flex-col gap-4">
          {createError ? <Notice tone="error">{createError}</Notice> : null}
          <Field htmlFor="calendar-create-type" label="Type" required>
            <Select
              disabled={actionPending}
              id="calendar-create-type"
              onChange={event => setExceptionType(event.target.value as CalendarExceptionType)}
              value={exceptionType}
            >
              <option value="HOLIDAY">Holiday</option>
              <option value="SPECIAL_WORKING_DAY">Special Working Day</option>
            </Select>
          </Field>
          <Field htmlFor="calendar-create-name" label="Name" required>
            <TextInput
              disabled={actionPending}
              id="calendar-create-name"
              onChange={event => setCreateName(event.target.value)}
              value={createName}
            />
          </Field>
          <Field htmlFor="calendar-create-date" label="Business date" required>
            <TextInput
              disabled={actionPending}
              id="calendar-create-date"
              onChange={event => setCreateDate(event.target.value)}
              type="date"
              value={createDate}
            />
          </Field>
          {exceptionType === "HOLIDAY" ? null : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="calendar-create-start" label="Start time" required>
                  <TextInput
                    disabled={actionPending}
                    id="calendar-create-start"
                    onChange={event => setCreateStart(event.target.value)}
                    type="time"
                    value={createStart}
                  />
                </Field>
                <Field htmlFor="calendar-create-end" label="End time" required>
                  <TextInput
                    disabled={actionPending}
                    id="calendar-create-end"
                    onChange={event => setCreateEnd(event.target.value)}
                    type="time"
                    value={createEnd}
                  />
                </Field>
              </div>
              <Field htmlFor="calendar-create-break" label="Unpaid break (minutes)">
                <TextInput
                  disabled={actionPending}
                  id="calendar-create-break"
                  inputMode="numeric"
                  min={0}
                  onChange={event => setCreateBreak(event.target.value)}
                  type="number"
                  value={createBreak}
                />
              </Field>
              <CheckboxField
                checked={createOvernight}
                description="Enable when the working window continues into the next day."
                id="calendar-create-overnight"
                label="Ends next day"
                onChange={setCreateOvernight}
              />
            </>
          )}
        </div>
      </ConfirmationDialog>

      <ConfirmationDialog
        confirmLabel="Save Changes"
        description="Ordinary editing applies to dates that have not been finalized. Finalized dates need a historical correction."
        onCancel={() => setEditTarget(null)}
        onConfirm={() => void submitEdit()}
        open={editTarget !== null}
        pending={actionPending}
        title="Edit Calendar Exception"
      >
        <div className="flex flex-col gap-4">
          {editError ? <Notice tone="error">{editError}</Notice> : null}
          <Field htmlFor="calendar-edit-name" label="Name" required>
            <TextInput
              disabled={actionPending}
              id="calendar-edit-name"
              onChange={event => setEditName(event.target.value)}
              value={editName}
            />
          </Field>
          {editTarget?.exceptionType === "SPECIAL_WORKING_DAY" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="calendar-edit-start" label="Start time" required>
                  <TextInput
                    disabled={actionPending}
                    id="calendar-edit-start"
                    onChange={event => setEditStart(event.target.value)}
                    type="time"
                    value={editStart}
                  />
                </Field>
                <Field htmlFor="calendar-edit-end" label="End time" required>
                  <TextInput
                    disabled={actionPending}
                    id="calendar-edit-end"
                    onChange={event => setEditEnd(event.target.value)}
                    type="time"
                    value={editEnd}
                  />
                </Field>
              </div>
              <Field htmlFor="calendar-edit-break" label="Unpaid break (minutes)">
                <TextInput
                  disabled={actionPending}
                  id="calendar-edit-break"
                  inputMode="numeric"
                  min={0}
                  onChange={event => setEditBreak(event.target.value)}
                  type="number"
                  value={editBreak}
                />
              </Field>
              <CheckboxField
                checked={editOvernight}
                description="Enable when the working window continues into the next day."
                id="calendar-edit-overnight"
                label="Ends next day"
                onChange={setEditOvernight}
              />
            </>
          ) : null}
        </div>
      </ConfirmationDialog>

      <ConfirmationDialog
        confirmLabel="Cancel Exception"
        description="The calendar exception will no longer apply from now on. Dates that were already finalized are not affected."
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => void submitCancel()}
        open={cancelTarget !== null}
        pending={actionPending}
        title="Cancel Calendar Exception"
      >
        <div className="flex flex-col gap-4">
          {cancelError ? <Notice tone="error">{cancelError}</Notice> : null}
          <Detail label="Exception">
            {cancelTarget ? `${cancelTarget.name} · ${businessDateLabel(cancelTarget.businessDate)}` : ""}
          </Detail>
          <Field htmlFor="calendar-cancel-reason" label="Cancellation reason" required>
            <TextInput
              disabled={actionPending}
              id="calendar-cancel-reason"
              onChange={event => setCancelReason(event.target.value)}
              value={cancelReason}
            />
          </Field>
        </div>
      </ConfirmationDialog>

      <ConfirmationDialog
        confirmLabel="Apply Historical Correction"
        description="Use this only for dates that are already finalized."
        onCancel={() => setHistoricalOpen(false)}
        onConfirm={() => void submitHistorical()}
        open={historicalOpen}
        pending={actionPending}
        title="Correct Historical Calendar"
      >
        <div className="flex flex-col gap-4">
          {historicalError ? <Notice tone="error">{historicalError}</Notice> : null}
          <Notice tone="info">{HISTORICAL_WARNING}</Notice>
          <Field htmlFor="calendar-historical-date" label="Business date" required>
            <TextInput
              disabled={actionPending}
              id="calendar-historical-date"
              max={today}
              onChange={event => setHistoricalDate(event.target.value)}
              type="date"
              value={historicalDate}
            />
          </Field>
          <Field htmlFor="calendar-historical-target" label="Correction" required>
            <Select
              disabled={actionPending}
              id="calendar-historical-target"
              onChange={event =>
                setHistoricalTarget(event.target.value as "HOLIDAY" | "SPECIAL_WORKING_DAY" | "NONE")
              }
              value={historicalTarget}
            >
              <option value="HOLIDAY">Holiday</option>
              <option value="SPECIAL_WORKING_DAY">Special Working Day</option>
              <option value="NONE">None — return to normal schedule</option>
            </Select>
          </Field>
          {historicalTarget === "NONE" ? null : (
            <Field htmlFor="calendar-historical-name" label="Name" required>
              <TextInput
                disabled={actionPending}
                id="calendar-historical-name"
                onChange={event => setHistoricalName(event.target.value)}
                value={historicalName}
              />
            </Field>
          )}
          {historicalTarget === "SPECIAL_WORKING_DAY" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="calendar-historical-start" label="Start time" required>
                  <TextInput
                    disabled={actionPending}
                    id="calendar-historical-start"
                    onChange={event => setHistoricalStart(event.target.value)}
                    type="time"
                    value={historicalStart}
                  />
                </Field>
                <Field htmlFor="calendar-historical-end" label="End time" required>
                  <TextInput
                    disabled={actionPending}
                    id="calendar-historical-end"
                    onChange={event => setHistoricalEnd(event.target.value)}
                    type="time"
                    value={historicalEnd}
                  />
                </Field>
              </div>
              <Field htmlFor="calendar-historical-break" label="Unpaid break (minutes)">
                <TextInput
                  disabled={actionPending}
                  id="calendar-historical-break"
                  inputMode="numeric"
                  min={0}
                  onChange={event => setHistoricalBreak(event.target.value)}
                  type="number"
                  value={historicalBreak}
                />
              </Field>
              <CheckboxField
                checked={historicalOvernight}
                description="Enable when the working window continues into the next day."
                id="calendar-historical-overnight"
                label="Ends next day"
                onChange={setHistoricalOvernight}
              />
            </>
          ) : null}
          <Field htmlFor="calendar-historical-reason" label="Change reason" required>
            <TextInput
              disabled={actionPending}
              id="calendar-historical-reason"
              onChange={event => setHistoricalReason(event.target.value)}
              value={historicalReason}
            />
          </Field>
        </div>
      </ConfirmationDialog>
    </Card>
  );
}
