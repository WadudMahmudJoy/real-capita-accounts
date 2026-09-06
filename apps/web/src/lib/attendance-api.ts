import { apiFetch } from "./api";

// ---------------------------------------------------------------------------
// Attendance resource types (HR-2C)
//
// These mirror the JSON returned by the guarded `/attendance/*` endpoints.
// Mutation payload types never contain server-owned fields (companyId,
// createdById, finalizedById, timeZone); the backend derives them.
// ---------------------------------------------------------------------------

export type AttendanceExpectedDayKind =
  | "WORKING_DAY"
  | "WEEKLY_REST"
  | "HOLIDAY"
  | "SPECIAL_WORKING_DAY";

export type AttendancePresenceState =
  | "PRESENT"
  | "ABSENT"
  | "INCOMPLETE"
  | "NOT_REQUIRED";

export type AttendanceEmployeeSummary = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  department: { id: string; code: string; name: string } | null;
};

export type AttendanceOperationalStatus =
  | { kind: "PENDING" }
  | { kind: "NON_WORKING_NO_ATTENDANCE" }
  | {
      kind: "CHECKED_IN" | "CHECKED_IN_LATE" | "INCOMPLETE" | "PRESENT";
      nonWorkingDay: boolean;
      provisionalLate: boolean | null;
      provisionalEarlyLeave: boolean | null;
    };

export type AttendanceFinalizedStatus = {
  kind: "FINALIZED";
  presenceState: AttendancePresenceState;
  isLate: boolean;
  isEarlyLeave: boolean;
  isNonWorkingDayAttendance: boolean;
};

export type AttendanceRowStatus =
  | AttendanceFinalizedStatus
  | { kind: "NOT_APPLICABLE" }
  | AttendanceOperationalStatus;

export type AttendanceDayRow = {
  employee: AttendanceEmployeeSummary;
  expectedDayKind: AttendanceExpectedDayKind;
  attendanceRequired: boolean;
  scheduledStartMinute: number | null;
  scheduledEndMinute: number | null;
  crossesMidnight: boolean | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  note: string | null;
  status: AttendanceRowStatus;
  /** Freshness token for draft editing; null while no draft exists. */
  expectedUpdatedAt: string | null;
};

export type AttendanceNeedsReviewRow = {
  employee: AttendanceEmployeeSummary;
  checkInAt: string | null;
  checkOutAt: string | null;
  expectedUpdatedAt: string;
};

export type AttendanceDaySummary = {
  expected: number;
  present: number;
  late: number;
  pending: number;
  incomplete: number;
};

export type AttendanceDay = {
  businessDate: string;
  finalized: boolean;
  finalizationAllowedAt: string | null;
  canFinalizeNow: boolean;
  summary: AttendanceDaySummary;
  rows: AttendanceDayRow[];
  needsReview: AttendanceNeedsReviewRow[];
};

export type AttendanceEntryInput = {
  employeeId: string;
  checkInLocalTime?: string | null;
  checkOutLocalTime?: string | null;
  note?: string | null;
  expectedUpdatedAt?: string | null;
};

export type BulkAttendanceSaveInput = {
  businessDate: string;
  entries: AttendanceEntryInput[];
};

export type DiscardAttendanceEntryInput = {
  businessDate: string;
  employeeId: string;
  expectedUpdatedAt: string | null;
};

export type FinalizeAttendanceDayInput = {
  businessDate: string;
};

export type AttendanceDayFilters = {
  businessDate: string;
  departmentId?: string;
  search?: string;
};

export type AttendanceHistoryStatus =
  | { kind: "FINALIZED"; presenceState: AttendancePresenceState; isLate: boolean; isEarlyLeave: boolean; isNonWorkingDayAttendance: boolean }
  | { kind: "NOT_APPLICABLE" };

export type AttendanceHistoryRow = {
  employee: AttendanceEmployeeSummary;
  businessDate: string;
  status: AttendanceHistoryStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  note: string | null;
  /** Freshness token used by the correction workflow. */
  expectedRevisionNo: number;
};

export type AttendanceHistoryRevision = {
  revisionNo: number;
  isAttendanceApplicable: boolean | null;
  presenceState: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  note: string | null;
  changeReason: string | null;
  createdByName: string | null;
  finalizedAt: string | null;
  createdAt: string;
};

export type AttendanceHistoryDetail = {
  employee: AttendanceEmployeeSummary;
  businessDate: string;
  finalized: boolean;
  revisions: AttendanceHistoryRevision[];
};

export type AttendanceHistoryFilters = {
  from: string;
  to: string;
  employeeId?: string;
  departmentId?: string;
  presenceState?: "PRESENT" | "ABSENT" | "INCOMPLETE" | "NOT_REQUIRED" | "NOT_APPLICABLE";
  search?: string;
};

export type CorrectAttendanceInput = {
  checkInLocalTime?: string | null;
  checkOutLocalTime?: string | null;
  note?: string | null;
  changeReason: string;
  /** null when adding a previously omitted employee (Path B). */
  expectedRevisionNo: number | null;
};

export type MarkAttendanceNotApplicableInput = {
  changeReason: string;
  expectedRevisionNo: number;
};

export type AttendanceCorrectionResult = {
  employeeId: string;
  businessDate: string;
  revisionNo: number;
  isAttendanceApplicable: boolean;
  presenceState: string | null;
};

export type AttendancePolicy = {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  changeReason: string | null;
  replacesPolicyId: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateInitialAttendancePolicyInput = {
  effectiveFrom: string;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  changeReason?: string | null;
};

export type ReplaceAttendancePolicyInput = {
  effectiveFrom: string;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  changeReason: string;
};

export type CancelFutureAttendancePolicyInput = {
  cancellationReason: string;
};

export type CalendarExceptionType = "HOLIDAY" | "SPECIAL_WORKING_DAY";

export type CalendarException = {
  id: string;
  businessDate: string;
  exceptionType: CalendarExceptionType;
  name: string;
  startMinuteOfDay: number | null;
  endMinuteOfDay: number | null;
  unpaidBreakMinutes: number;
  crossesMidnight: boolean;
  changeReason: string | null;
  replacesExceptionId: string | null;
  supersededAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
};

export type CreateCalendarExceptionInput = {
  businessDate: string;
  exceptionType: CalendarExceptionType;
  name: string;
  startMinuteOfDay?: number | null;
  endMinuteOfDay?: number | null;
  unpaidBreakMinutes?: number;
  crossesMidnight?: boolean;
};

export type UpdateCalendarExceptionInput = {
  name?: string;
  startMinuteOfDay?: number | null;
  endMinuteOfDay?: number | null;
  unpaidBreakMinutes?: number;
  crossesMidnight?: boolean;
};

export type CancelCalendarExceptionInput = {
  cancellationReason: string;
};

export type HistoricalCalendarCorrectionInput = {
  businessDate: string;
  target: CalendarExceptionType | "NONE";
  name?: string;
  startMinuteOfDay?: number | null;
  endMinuteOfDay?: number | null;
  unpaidBreakMinutes?: number;
  crossesMidnight?: boolean;
  changeReason: string;
};

export type HistoricalCalendarCorrectionResult = {
  businessDate: string;
  target: CalendarExceptionType | "NONE";
  attendanceRevisionsCreated: number;
};

// ---------------------------------------------------------------------------
// Attendance client (HR-2C)
// ---------------------------------------------------------------------------

function buildAttendanceDayQuery(filters: AttendanceDayFilters): string {
  const params = new URLSearchParams({ businessDate: filters.businessDate });
  if (filters.departmentId) params.set("departmentId", filters.departmentId);
  if (filters.search) params.set("search", filters.search);
  return `?${params.toString()}`;
}

function buildAttendanceHistoryQuery(filters: AttendanceHistoryFilters): string {
  const params = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.employeeId) params.set("employeeId", filters.employeeId);
  if (filters.departmentId) params.set("departmentId", filters.departmentId);
  if (filters.presenceState) params.set("presenceState", filters.presenceState);
  if (filters.search) params.set("search", filters.search);
  return `?${params.toString()}`;
}

function attendanceHistoryPath(employeeId: string, businessDate: string): string {
  return `/attendance/history/${encodeURIComponent(employeeId)}/${encodeURIComponent(businessDate)}`;
}

export function getAttendanceDay(
  filters: AttendanceDayFilters,
  signal?: AbortSignal,
): Promise<AttendanceDay> {
  return apiFetch<AttendanceDay>(
    `/attendance/day${buildAttendanceDayQuery(filters)}`,
    { signal },
  );
}

export function saveAttendanceEntries(
  input: BulkAttendanceSaveInput,
): Promise<AttendanceDay> {
  // The shared apiFetch method union (GET/POST/PATCH/DELETE) predates the
  // Attendance routes and does not include PUT, which the accepted Attendance
  // API surface uses for saving day entries. apiFetch forwards `method`
  // untouched to fetch, so this documented single-point widening passes the
  // verb through while apiFetch keeps owning cookie auth, error mapping, and
  // JSON handling. No fetch infrastructure is duplicated.
  return apiFetch<AttendanceDay>("/attendance/entries", {
    body: input,
    method: "PUT" as unknown as "POST",
  });
}

export function discardAttendanceEntry(
  input: DiscardAttendanceEntryInput,
): Promise<AttendanceDay> {
  return apiFetch<AttendanceDay>("/attendance/entries/discard", {
    body: input,
    method: "POST",
  });
}

export type FinalizeAttendanceDayResult = {
  businessDate: string;
  finalizedAt: string;
  summary: { present: number; absent: number; incomplete: number; notRequired: number };
};

export function finalizeAttendanceDay(
  input: FinalizeAttendanceDayInput,
): Promise<FinalizeAttendanceDayResult> {
  return apiFetch<FinalizeAttendanceDayResult>("/attendance/finalize", {
    body: input,
    method: "POST",
  });
}

export function getAttendanceHistory(
  filters: AttendanceHistoryFilters,
  signal?: AbortSignal,
): Promise<AttendanceHistoryRow[]> {
  return apiFetch<AttendanceHistoryRow[]>(
    `/attendance/history${buildAttendanceHistoryQuery(filters)}`,
    { signal },
  );
}

export function getAttendanceHistoryDetail(
  employeeId: string,
  businessDate: string,
  signal?: AbortSignal,
): Promise<AttendanceHistoryDetail> {
  return apiFetch<AttendanceHistoryDetail>(
    attendanceHistoryPath(employeeId, businessDate),
    { signal },
  );
}

export function correctAttendance(
  employeeId: string,
  businessDate: string,
  input: CorrectAttendanceInput,
): Promise<AttendanceCorrectionResult> {
  return apiFetch<AttendanceCorrectionResult>(
    `${attendanceHistoryPath(employeeId, businessDate)}/corrections`,
    { body: input, method: "POST" },
  );
}

export function markAttendanceNotApplicable(
  employeeId: string,
  businessDate: string,
  input: MarkAttendanceNotApplicableInput,
): Promise<AttendanceCorrectionResult> {
  return apiFetch<AttendanceCorrectionResult>(
    `${attendanceHistoryPath(employeeId, businessDate)}/not-applicable`,
    { body: input, method: "POST" },
  );
}

export function getAttendancePolicies(signal?: AbortSignal): Promise<AttendancePolicy[]> {
  return apiFetch<AttendancePolicy[]>("/attendance/policies", { signal });
}

export function createInitialAttendancePolicy(
  input: CreateInitialAttendancePolicyInput,
): Promise<AttendancePolicy> {
  return apiFetch<AttendancePolicy>("/attendance/policies", {
    body: input,
    method: "POST",
  });
}

export function replaceAttendancePolicy(
  id: string,
  input: ReplaceAttendancePolicyInput,
): Promise<AttendancePolicy> {
  return apiFetch<AttendancePolicy>(
    `/attendance/policies/${encodeURIComponent(id)}/replace`,
    { body: input, method: "POST" },
  );
}

export function cancelFutureAttendancePolicy(
  id: string,
  input: CancelFutureAttendancePolicyInput,
): Promise<AttendancePolicy> {
  return apiFetch<AttendancePolicy>(
    `/attendance/policies/${encodeURIComponent(id)}/cancel-future`,
    { body: input, method: "POST" },
  );
}

export function getCalendarExceptions(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<CalendarException[]> {
  const params = new URLSearchParams({ from, to });
  return apiFetch<CalendarException[]>(
    `/attendance/calendar?${params.toString()}`,
    { signal },
  );
}

export function createCalendarException(
  input: CreateCalendarExceptionInput,
): Promise<CalendarException> {
  return apiFetch<CalendarException>("/attendance/calendar/exceptions", {
    body: input,
    method: "POST",
  });
}

export function updateCalendarException(
  id: string,
  input: UpdateCalendarExceptionInput,
): Promise<CalendarException> {
  return apiFetch<CalendarException>(
    `/attendance/calendar/exceptions/${encodeURIComponent(id)}`,
    { body: input, method: "PATCH" },
  );
}

export function cancelCalendarException(
  id: string,
  input: CancelCalendarExceptionInput,
): Promise<CalendarException> {
  return apiFetch<CalendarException>(
    `/attendance/calendar/exceptions/${encodeURIComponent(id)}/cancel`,
    { body: input, method: "POST" },
  );
}

export function historicalCalendarCorrect(
  input: HistoricalCalendarCorrectionInput,
): Promise<HistoricalCalendarCorrectionResult> {
  return apiFetch<HistoricalCalendarCorrectionResult>(
    "/attendance/calendar/historical-corrections",
    { body: input, method: "POST" },
  );
}
