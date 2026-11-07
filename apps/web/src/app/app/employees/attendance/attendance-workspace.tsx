"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, getDepartments, type Department } from "@/lib/api";
import {
  discardAttendanceEntry,
  finalizeAttendanceDay,
  getAttendanceDay,
  saveAttendanceEntries,
  type AttendanceDay,
  type AttendanceDayRow,
  type AttendanceNeedsReviewRow,
} from "@/lib/attendance-api";
import { buttonClassName, Button, PageIntro } from "../../_components/ui";
import { ConfirmationDialog } from "../../_components/salary-ui";
import {
  businessDateLabel,
  dhakaToday,
  finalizationAvailabilityText,
  localTimeValue,
} from "./attendance-view";
import {
  DailyAttendancePanel,
  type AttendanceDiscardTarget,
} from "./daily-attendance-panel";
import type { AttendancePunchDraft } from "./attendance-day-row";
import { HistoryPanel } from "./history-panel";
import { SettingsRulesPanel } from "./settings-rules-panel";
import { SettingsCalendarPanel } from "./settings-calendar-panel";

type AttendanceTab = "daily" | "history" | "settings";

const STALE_ATTENDANCE_MESSAGE =
  "The attendance entries changed after this page loaded. The latest information is now shown; please review and try again.";

function attendanceErrorMessage(error: unknown): string {
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

function isStaleConflict(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    /changed after this page loaded|changed concurrently/i.test(error.message)
  );
}

export function AttendanceWorkspace() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AttendanceTab>("daily");
  const [businessDate, setBusinessDate] = useState(() => dhakaToday());
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [day, setDay] = useState<AttendanceDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [punchDrafts, setPunchDrafts] = useState<Record<string, AttendancePunchDraft>>({});
  const [actionPending, setActionPending] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<AttendanceDiscardTarget | null>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const dayView = await getAttendanceDay({ businessDate }, signal);
        if (signal?.aborted) return;
        setDay(dayView);
        setLoading(false);
        setError(null);
      } catch (caught) {
        if (signal?.aborted) return;
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }
        setError(attendanceErrorMessage(caught));
        setLoading(false);
      }
    },
    [businessDate, router],
  );

  const loadDepartments = useCallback(async (signal?: AbortSignal) => {
    try {
      const departmentRows = await getDepartments(signal);
      if (signal?.aborted) return;
      setDepartments(departmentRows);
    } catch {
      // The department filter simply stays empty when the department list
      // cannot load; attendance data itself remains fully usable.
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadDepartments(controller.signal);
    });
    return () => controller.abort();
  }, [loadDepartments]);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  const handleBusinessDateChange = useCallback((value: string) => {
    setBusinessDate(value);
    setPunchDrafts({});
    setMessage(null);
    setError(null);
  }, []);

  const handlePunchChange = useCallback(
    (employeeId: string, field: "checkIn" | "checkOut", value: string) => {
      setPunchDrafts(previous => ({
        ...previous,
        [employeeId]: { ...previous[employeeId], [field]: value },
      }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!day || day.finalized) return;
    const entries = day.rows
      .filter(row => punchDrafts[row.employee.employeeId] !== undefined)
      .map(row => {
        const draft = punchDrafts[row.employee.employeeId];
        const checkIn = draft.checkIn !== undefined ? draft.checkIn : localTimeValue(row.checkInAt);
        const checkOut = draft.checkOut !== undefined ? draft.checkOut : localTimeValue(row.checkOutAt);
        return {
          employeeId: row.employee.employeeId,
          checkInLocalTime: checkIn === "" ? null : checkIn,
          checkOutLocalTime: checkOut === "" ? null : checkOut,
          expectedUpdatedAt: row.expectedUpdatedAt ?? undefined,
        };
      });
    if (entries.length === 0) {
      setMessage("No attendance times have been entered to save yet.");
      return;
    }
    setActionPending(true);
    setMessage(null);
    setError(null);
    try {
      const updatedDay = await saveAttendanceEntries({ businessDate, entries });
      setDay(updatedDay);
      setPunchDrafts({});
      setMessage("Attendance saved.");
    } catch (caught) {
      if (isStaleConflict(caught)) {
        setPunchDrafts({});
        await load();
        setMessage(STALE_ATTENDANCE_MESSAGE);
      } else {
        setError(attendanceErrorMessage(caught));
      }
    } finally {
      setActionPending(false);
    }
  }, [businessDate, day, load, punchDrafts]);

  const handleDiscardRow = useCallback((row: AttendanceDayRow) => {
    if (row.expectedUpdatedAt === null) return;
    setDiscardTarget({
      employeeId: row.employee.employeeId,
      employeeName: row.employee.fullName,
      expectedUpdatedAt: row.expectedUpdatedAt,
    });
  }, []);

  const handleDiscardNeedsReview = useCallback((entry: AttendanceNeedsReviewRow) => {
    setDiscardTarget({
      employeeId: entry.employee.employeeId,
      employeeName: entry.employee.fullName,
      expectedUpdatedAt: entry.expectedUpdatedAt,
    });
  }, []);

  const confirmDiscard = useCallback(async () => {
    if (!discardTarget) return;
    const target = discardTarget;
    setActionPending(true);
    try {
      const updatedDay = await discardAttendanceEntry({
        businessDate,
        employeeId: target.employeeId,
        expectedUpdatedAt: target.expectedUpdatedAt,
      });
      setDay(updatedDay);
      setPunchDrafts(previous => {
        const next = { ...previous };
        delete next[target.employeeId];
        return next;
      });
      setDiscardTarget(null);
      setMessage(`The draft attendance entry for ${target.employeeName} was discarded.`);
    } catch (caught) {
      setDiscardTarget(null);
      if (isStaleConflict(caught)) {
        await load();
        setMessage(STALE_ATTENDANCE_MESSAGE);
      } else {
        setError(attendanceErrorMessage(caught));
      }
    } finally {
      setActionPending(false);
    }
  }, [businessDate, discardTarget, load]);

  const requestFinalize = useCallback(() => {
    setFinalizeOpen(true);
  }, []);

  const confirmFinalize = useCallback(async () => {
    setActionPending(true);
    try {
      await finalizeAttendanceDay({ businessDate });
      setFinalizeOpen(false);
      await load();
      setMessage("The day was finalized.");
    } catch (caught) {
      setFinalizeOpen(false);
      if (isStaleConflict(caught)) {
        await load();
        setMessage(STALE_ATTENDANCE_MESSAGE);
      } else {
        setError(attendanceErrorMessage(caught));
      }
    } finally {
      setActionPending(false);
    }
  }, [businessDate, load]);

  const finalizeAllowed = day !== null && !day.finalized && day.canFinalizeNow;
  const availability =
    day !== null && !day.finalized && !day.canFinalizeNow
      ? finalizationAvailabilityText(day.finalizationAllowedAt)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        description="Record daily employee attendance, review saved drafts, and finalize each business day."
        title="Attendance"
      />
      <div aria-label="Attendance sections" className="flex flex-wrap gap-2" role="tablist">
        {activeTab === "daily" ? (
          <span aria-current="page" className={buttonClassName()} role="tab">
            Daily
          </span>
        ) : (
          <Button aria-selected={false} onClick={() => setActiveTab("daily")} role="tab" variant="secondary">
            Daily
          </Button>
        )}
        {activeTab === "history" ? (
          <span aria-current="page" className={buttonClassName()} role="tab">
            History
          </span>
        ) : (
          <Button aria-selected={false} onClick={() => setActiveTab("history")} role="tab" variant="secondary">
            History
          </Button>
        )}
        {activeTab === "settings" ? (
          <span aria-current="page" className={buttonClassName()} role="tab">
            Settings
          </span>
        ) : (
          <Button aria-selected={false} onClick={() => setActiveTab("settings")} role="tab" variant="secondary">
            Settings
          </Button>
        )}
      </div>
      {activeTab === "daily" ? (
        <DailyAttendancePanel
          actionPending={actionPending}
          availability={availability}
          businessDate={businessDate}
          day={day}
          departments={departments}
          departmentFilter={departmentFilter}
          error={error}
          finalizeAllowed={finalizeAllowed}
          loading={loading}
          message={message}
          onBusinessDateChange={handleBusinessDateChange}
          onDepartmentFilterChange={setDepartmentFilter}
          onDiscardNeedsReview={handleDiscardNeedsReview}
          onDiscardRow={handleDiscardRow}
          onFinalize={requestFinalize}
          onPunchChange={handlePunchChange}
          onReload={() => void reload()}
          onSave={() => void handleSave()}
          onSearchFilterChange={setSearchFilter}
          punchDrafts={punchDrafts}
          searchFilter={searchFilter}
        />
      ) : null}
      {activeTab === "history" ? <HistoryPanel /> : null}
      {activeTab === "settings" ? (
        <div className="flex flex-col gap-6">
          <SettingsRulesPanel />
          <SettingsCalendarPanel />
        </div>
      ) : null}
      <ConfirmationDialog
        confirmLabel="Discard Entry"
        description={
          discardTarget
            ? `The saved attendance times for ${discardTarget.employeeName} will be removed. This is possible only before the day is finalized.`
            : ""
        }
        onCancel={() => setDiscardTarget(null)}
        onConfirm={() => void confirmDiscard()}
        open={discardTarget !== null}
        pending={actionPending}
        title="Discard Entry?"
      />
      <ConfirmationDialog
        confirmLabel="Finalize Day"
        description={`Attendance for ${businessDateLabel(businessDate)} will be locked. After finalization, changes require a history correction.`}
        onCancel={() => setFinalizeOpen(false)}
        onConfirm={() => void confirmFinalize()}
        open={finalizeOpen}
        pending={actionPending}
        title="Finalize Day?"
      />
    </div>
  );
}
