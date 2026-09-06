"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  correctAttendance,
  getAttendanceHistoryDetail,
  markAttendanceNotApplicable,
  type AttendanceHistoryDetail as AttendanceHistoryDetailData,
  type AttendanceHistoryRevision,
  type AttendanceHistoryStatus,
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
  TextArea,
  TextInput,
} from "../../_components/ui";
import { ConfirmationDialog, Detail } from "../../_components/salary-ui";
import { businessDateLabel, localTimeValue, punchTimeLabel } from "./attendance-view";

const STALE_HISTORY_MESSAGE =
  "This attendance record changed after you opened it. Review the latest history before trying again.";

const recordedAtFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "long",
  timeZone: "Asia/Dhaka",
  year: "numeric",
});

function recordedAtLabel(value: string): string {
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? "—" : recordedAtFormatter.format(instant);
}

function historyErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isUnauthorized) return "Your session has expired. Please sign in again.";
    if (error.isForbidden) return "Your account does not have access to Attendance.";
    if (error.status >= 500 || error.status === 0) {
      return "The server could not complete the request. Please try again.";
    }
    return error.message;
  }
  return "The request could not be completed. Please try again.";
}

function isStaleHistoryConflict(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    /changed after this page loaded|changed concurrently/i.test(error.message)
  );
}

export function historyStatusLabel(status: AttendanceHistoryStatus): string {
  if (status.kind === "NOT_APPLICABLE") return "Not Applicable";
  if (status.presenceState === "NOT_REQUIRED") return "Not Required";
  if (status.presenceState === "ABSENT") return "Absent";
  if (status.presenceState === "INCOMPLETE") return "Incomplete";
  if (status.isNonWorkingDayAttendance) return "Present · Non-working Day";
  if (status.isLate) return "Present · Late";
  if (status.isEarlyLeave) return "Present · Early Leave";
  return "Present";
}

export function historyStatusTone(status: AttendanceHistoryStatus): "active" | "closed" | "neutral" {
  if (status.kind === "NOT_APPLICABLE" || status.presenceState === "NOT_REQUIRED") return "neutral";
  if (status.presenceState === "PRESENT") return "active";
  return "closed";
}

function revisionStatusLabel(revision: AttendanceHistoryRevision): string {
  if (revision.finalizedAt === null) return "Saved draft";
  if (revision.isAttendanceApplicable === false) return "Not Applicable";
  switch (revision.presenceState) {
    case "PRESENT":
      return "Present";
    case "ABSENT":
      return "Absent";
    case "INCOMPLETE":
      return "Incomplete";
    case "NOT_REQUIRED":
      return "Not Required";
    default:
      return "Recorded";
  }
}

function revisionTone(revision: AttendanceHistoryRevision): "active" | "closed" | "neutral" {
  if (revision.finalizedAt === null) return "neutral";
  if (revision.isAttendanceApplicable === false) return "neutral";
  if (revision.presenceState === "PRESENT") return "active";
  if (revision.presenceState === "NOT_REQUIRED" || revision.presenceState === null) return "neutral";
  return "closed";
}

export function AttendanceHistoryDetail({
  employeeId,
  businessDate,
  onClose,
  onChanged,
}: {
  employeeId: string;
  businessDate: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<AttendanceHistoryDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const [correctOpen, setCorrectOpen] = useState(false);
  const [correctCheckIn, setCorrectCheckIn] = useState("");
  const [correctCheckOut, setCorrectCheckOut] = useState("");
  const [correctNote, setCorrectNote] = useState("");
  const [correctReason, setCorrectReason] = useState("");
  const [correctError, setCorrectError] = useState<string | null>(null);

  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreCheckIn, setRestoreCheckIn] = useState("");
  const [restoreCheckOut, setRestoreCheckOut] = useState("");
  const [restoreNote, setRestoreNote] = useState("");
  const [restoreReason, setRestoreReason] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const detailData = await getAttendanceHistoryDetail(employeeId, businessDate, signal);
        if (signal?.aborted) return;
        setDetail(detailData);
        setNotFound(false);
        setError(null);
        setLoading(false);
      } catch (caught) {
        if (signal?.aborted) return;
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }
        if (caught instanceof ApiError && caught.isNotFound) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setError(historyErrorMessage(caught));
        setLoading(false);
      }
    },
    [businessDate, employeeId, router],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const latest = detail?.revisions[0] ?? null;
  const latestFinalized = latest !== null && latest.finalizedAt !== null;
  const isVoid = latest !== null && latest.isAttendanceApplicable === false;
  const canCorrect = detail !== null && detail.finalized && latestFinalized && !isVoid;
  const canRestore = detail !== null && detail.finalized && isVoid;

  function openCorrection() {
    if (!latest) return;
    setCorrectCheckIn(localTimeValue(latest.checkInAt));
    setCorrectCheckOut(localTimeValue(latest.checkOutAt));
    setCorrectNote(latest.note ?? "");
    setCorrectReason("");
    setCorrectError(null);
    setCorrectOpen(true);
  }

  async function submitCorrection() {
    if (!latest || !latestFinalized) return;
    const reason = correctReason.trim();
    if (!reason) {
      setCorrectError("Change reason is required.");
      return;
    }
    setActionPending(true);
    setCorrectError(null);
    try {
      await correctAttendance(employeeId, businessDate, {
        checkInLocalTime: correctCheckIn === "" ? null : correctCheckIn,
        checkOutLocalTime: correctCheckOut === "" ? null : correctCheckOut,
        note: correctNote.trim() === "" ? null : correctNote.trim(),
        changeReason: reason,
        expectedRevisionNo: latest.revisionNo,
      });
      setCorrectOpen(false);
      setMessage("The correction was saved.");
      await load();
      onChanged();
    } catch (caught) {
      if (isStaleHistoryConflict(caught)) {
        setCorrectOpen(false);
        await load();
        onChanged();
        setMessage(STALE_HISTORY_MESSAGE);
      } else {
        setCorrectError(historyErrorMessage(caught));
      }
    } finally {
      setActionPending(false);
    }
  }

  function openVoidDialog() {
    setVoidReason("");
    setVoidError(null);
    setVoidOpen(true);
  }

  async function submitVoid() {
    if (!latest || !latestFinalized) return;
    const reason = voidReason.trim();
    if (!reason) {
      setVoidError("Change reason is required.");
      return;
    }
    setActionPending(true);
    setVoidError(null);
    try {
      await markAttendanceNotApplicable(employeeId, businessDate, {
        changeReason: reason,
        expectedRevisionNo: latest.revisionNo,
      });
      setVoidOpen(false);
      setMessage("The attendance entry was marked not applicable.");
      await load();
      onChanged();
    } catch (caught) {
      if (isStaleHistoryConflict(caught)) {
        setVoidOpen(false);
        await load();
        onChanged();
        setMessage(STALE_HISTORY_MESSAGE);
      } else {
        setVoidError(historyErrorMessage(caught));
      }
    } finally {
      setActionPending(false);
    }
  }

  function openRestoreDialog() {
    if (!latest) return;
    setRestoreCheckIn("");
    setRestoreCheckOut("");
    setRestoreNote(latest.note ?? "");
    setRestoreReason("");
    setRestoreError(null);
    setRestoreOpen(true);
  }

  async function submitRestore() {
    if (!latest || !isVoid) return;
    const reason = restoreReason.trim();
    if (!reason) {
      setRestoreError("Change reason is required.");
      return;
    }
    setActionPending(true);
    setRestoreError(null);
    try {
      await correctAttendance(employeeId, businessDate, {
        ...(restoreCheckIn === "" ? {} : { checkInLocalTime: restoreCheckIn }),
        ...(restoreCheckOut === "" ? {} : { checkOutLocalTime: restoreCheckOut }),
        note: restoreNote.trim() === "" ? null : restoreNote.trim(),
        changeReason: reason,
        expectedRevisionNo: latest.revisionNo,
      });
      setRestoreOpen(false);
      setMessage("The attendance entry was restored.");
      await load();
      onChanged();
    } catch (caught) {
      if (isStaleHistoryConflict(caught)) {
        setRestoreOpen(false);
        await load();
        onChanged();
        setMessage(STALE_HISTORY_MESSAGE);
      } else {
        setRestoreError(historyErrorMessage(caught));
      }
    } finally {
      setActionPending(false);
    }
  }

  if (loading && detail === null) {
    return (
      <Card>
        <LoadingPanel message="Loading attendance history..." />
      </Card>
    );
  }

  if (notFound) {
    return (
      <Card>
        <Notice tone="error">
          The attendance history for this employee and date was not found.
        </Notice>
        <div className="mt-4">
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        </div>
      </Card>
    );
  }

  if (error !== null && detail === null) {
    return (
      <Card>
        <Notice tone="error">{error}</Notice>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => void load()} variant="secondary">
            Try Again
          </Button>
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
        </div>
      </Card>
    );
  }

  if (detail === null || detail.revisions.length === 0) {
    return (
      <Card>
        <EmptyState
          description="No attendance history is recorded for this employee and date."
          title="Nothing recorded"
        />
        <div className="mt-4">
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        </div>
      </Card>
    );
  }

  const latestLabel = latest ? revisionStatusLabel(latest) : "—";
  const latestTone = latest ? revisionTone(latest) : "neutral";

  return (
    <Card>
      <CardHeader
        actions={
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        }
        description={`${detail.employee.employeeCode}${detail.employee.department ? ` · ${detail.employee.department.name}` : ""}`}
        title={`${detail.employee.fullName} — ${businessDateLabel(businessDate)}`}
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <StatusBadge tone={latestTone}>{latestLabel}</StatusBadge>
        {detail.finalized ? (
          <StatusBadge tone="active">Finalized Day</StatusBadge>
        ) : (
          <StatusBadge tone="closed">Not Finalized</StatusBadge>
        )}
        <span className="text-sm text-muted-foreground">
          {`${punchTimeLabel(latest?.checkInAt ?? null)} – ${punchTimeLabel(latest?.checkOutAt ?? null)}`}
        </span>
      </div>
      {message ? (
        <div className="mt-4">
          <Notice tone="info">{message}</Notice>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
      {isVoid ? (
        <div className="mt-4">
          <Notice tone="info">
            This attendance entry is marked Not Applicable. Earlier recorded facts remain in the history below as evidence.
          </Notice>
        </div>
      ) : null}
      {!detail.finalized ? (
        <div className="mt-4">
          <Notice tone="info">
            This date is not finalized yet. Corrections become available after the day is
            finalized.
          </Notice>
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        {canCorrect ? (
          <>
            <Button onClick={openCorrection}>Correct Attendance</Button>
            <Button onClick={openVoidDialog} variant="danger">
              Mark Attendance Not Applicable
            </Button>
          </>
        ) : null}
        {canRestore ? <Button onClick={openRestoreDialog}>Restore Attendance</Button> : null}
      </div>
      <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        History timeline
      </h3>
      <ol className="mt-3 flex flex-col gap-3">
        {detail.revisions.map(revision => (
          <li className="rounded-lg border border-border bg-background p-4" key={revision.revisionNo}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusBadge tone={revisionTone(revision)}>{revisionStatusLabel(revision)}</StatusBadge>
              <span className="text-xs text-muted-foreground">
                {recordedAtLabel(revision.createdAt)}
              </span>
            </div>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <Detail label="Recorded by">{revision.createdByName ?? "—"}</Detail>
              <Detail label="Reason">{revision.changeReason ?? "Initial record"}</Detail>
              <Detail label="Check In">{punchTimeLabel(revision.checkInAt)}</Detail>
              <Detail label="Check Out">{punchTimeLabel(revision.checkOutAt)}</Detail>
              {revision.note ? <Detail label="Note">{revision.note}</Detail> : null}
            </dl>
          </li>
        ))}
      </ol>

      <ConfirmationDialog
        confirmLabel="Save Correction"
        description="Update the recorded attendance times or note for this employee. The change is added to the history; earlier entries remain recorded."
        onCancel={() => setCorrectOpen(false)}
        onConfirm={() => void submitCorrection()}
        open={correctOpen}
        pending={actionPending}
        title="Correct Attendance"
      >
        <div className="flex flex-col gap-4">
          {correctError ? <Notice tone="error">{correctError}</Notice> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor="history-correct-check-in" label="Check In">
              <TextInput
                disabled={actionPending}
                id="history-correct-check-in"
                onChange={event => setCorrectCheckIn(event.target.value)}
                type="time"
                value={correctCheckIn}
              />
            </Field>
            <Field htmlFor="history-correct-check-out" label="Check Out">
              <TextInput
                disabled={actionPending}
                id="history-correct-check-out"
                onChange={event => setCorrectCheckOut(event.target.value)}
                type="time"
                value={correctCheckOut}
              />
            </Field>
          </div>
          <Field htmlFor="history-correct-note" label="Note">
            <TextArea
              disabled={actionPending}
              id="history-correct-note"
              onChange={event => setCorrectNote(event.target.value)}
              value={correctNote}
            />
          </Field>
          <Field htmlFor="history-correct-reason" label="Change reason" required>
            <TextArea
              disabled={actionPending}
              id="history-correct-reason"
              onChange={event => setCorrectReason(event.target.value)}
              value={correctReason}
            />
          </Field>
        </div>
      </ConfirmationDialog>

      <ConfirmationDialog
        confirmLabel="Mark Not Applicable"
        description="This action is only valid when the employee's corrected joining or separation date shows they were not eligible on this date. The recorded times stay in the history as evidence."
        onCancel={() => setVoidOpen(false)}
        onConfirm={() => void submitVoid()}
        open={voidOpen}
        pending={actionPending}
        title="Mark Attendance Not Applicable"
      >
        <div className="flex flex-col gap-4">
          {voidError ? <Notice tone="error">{voidError}</Notice> : null}
          <Field htmlFor="history-void-reason" label="Change reason" required>
            <TextArea
              disabled={actionPending}
              id="history-void-reason"
              onChange={event => setVoidReason(event.target.value)}
              value={voidReason}
            />
          </Field>
        </div>
      </ConfirmationDialog>

      <ConfirmationDialog
        confirmLabel="Restore"
        description="Restore this entry to applicable attendance. Leave the times blank to keep the times already recorded in the history."
        onCancel={() => setRestoreOpen(false)}
        onConfirm={() => void submitRestore()}
        open={restoreOpen}
        pending={actionPending}
        title="Restore Attendance"
      >
        <div className="flex flex-col gap-4">
          {restoreError ? <Notice tone="error">{restoreError}</Notice> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor="history-restore-check-in" label="Check In">
              <TextInput
                disabled={actionPending}
                id="history-restore-check-in"
                onChange={event => setRestoreCheckIn(event.target.value)}
                type="time"
                value={restoreCheckIn}
              />
            </Field>
            <Field htmlFor="history-restore-check-out" label="Check Out">
              <TextInput
                disabled={actionPending}
                id="history-restore-check-out"
                onChange={event => setRestoreCheckOut(event.target.value)}
                type="time"
                value={restoreCheckOut}
              />
            </Field>
          </div>
          <Field htmlFor="history-restore-note" label="Note">
            <TextArea
              disabled={actionPending}
              id="history-restore-note"
              onChange={event => setRestoreNote(event.target.value)}
              value={restoreNote}
            />
          </Field>
          <Field htmlFor="history-restore-reason" label="Change reason" required>
            <TextArea
              disabled={actionPending}
              id="history-restore-reason"
              onChange={event => setRestoreReason(event.target.value)}
              value={restoreReason}
            />
          </Field>
        </div>
      </ConfirmationDialog>
    </Card>
  );
}
