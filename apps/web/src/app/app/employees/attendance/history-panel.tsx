"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getDepartments,
  getEmployees,
  type Department,
  type EmployeeListItem,
} from "@/lib/api";
import {
  correctAttendance,
  getAttendanceHistory,
  type AttendanceHistoryRow,
} from "@/lib/attendance-api";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  LoadingPanel,
  Notice,
  Select,
  StatusBadge,
  TextArea,
  TextInput,
} from "../../_components/ui";
import { Detail } from "../../_components/salary-ui";
import { AttendanceHistoryDetail, historyStatusLabel, historyStatusTone } from "./attendance-history-detail";
import { businessDateLabel, dhakaToday, punchTimeLabel } from "./attendance-view";

const PATH_B_CONFLICT_MESSAGE =
  "An attendance record was created while this form was open. Review the latest history before trying again.";

type HistoryStatusFilter = "" | "PRESENT" | "ABSENT" | "INCOMPLETE" | "NOT_REQUIRED" | "NOT_APPLICABLE";

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

function monthStart(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

export function HistoryPanel() {
  const router = useRouter();
  const [today] = useState(() => dhakaToday());
  const [from, setFrom] = useState(() => monthStart(dhakaToday()));
  const [to, setTo] = useState(() => dhakaToday());
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [rows, setRows] = useState<AttendanceHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selected, setSelected] = useState<{ employeeId: string; businessDate: string } | null>(null);
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingEmployee, setMissingEmployee] = useState("");
  const [missingDate, setMissingDate] = useState("");
  const [missingCheckIn, setMissingCheckIn] = useState("");
  const [missingCheckOut, setMissingCheckOut] = useState("");
  const [missingNote, setMissingNote] = useState("");
  const [missingReason, setMissingReason] = useState("");
  const [missingError, setMissingError] = useState<string | null>(null);
  const [missingPending, setMissingPending] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadReferenceData = useCallback(async (signal?: AbortSignal) => {
    try {
      const [employeeRows, departmentRows] = await Promise.all([
        getEmployees({ status: "ALL" }, signal),
        getDepartments(signal),
      ]);
      if (signal?.aborted) return;
      setEmployees(employeeRows);
      setDepartments(departmentRows);
    } catch {
      // The history list itself still loads; the filter dropdowns simply stay empty.
    }
  }, []);

  const loadRows = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const historyRows = await getAttendanceHistory(
          {
            from,
            to,
            ...(employeeFilter ? { employeeId: employeeFilter } : {}),
            ...(departmentFilter ? { departmentId: departmentFilter } : {}),
            ...(statusFilter ? { presenceState: statusFilter } : {}),
            ...(appliedSearch ? { search: appliedSearch } : {}),
          },
          signal,
        );
        if (signal?.aborted) return;
        setRows(historyRows);
        setError(null);
        setLoading(false);
      } catch (caught) {
        if (signal?.aborted) return;
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }
        setError(historyErrorMessage(caught));
        setLoading(false);
      }
    },
    [appliedSearch, departmentFilter, employeeFilter, from, router, statusFilter, to],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setLoading(true);
        void loadRows(controller.signal);
      }
    });
    return () => controller.abort();
  }, [loadRows]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadReferenceData(controller.signal);
    });
    return () => controller.abort();
  }, [loadReferenceData]);

  function resetMissingForm() {
    setMissingEmployee("");
    setMissingDate("");
    setMissingCheckIn("");
    setMissingCheckOut("");
    setMissingNote("");
    setMissingReason("");
    setMissingError(null);
  }

  async function submitMissingRecord() {
    const reason = missingReason.trim();
    if (!missingEmployee || !missingDate) {
      setMissingError("Select an employee and a business date.");
      return;
    }
    if (!reason) {
      setMissingError("Change reason is required.");
      return;
    }
    setMissingPending(true);
    setMissingError(null);
    try {
      await correctAttendance(missingEmployee, missingDate, {
        checkInLocalTime: missingCheckIn === "" ? null : missingCheckIn,
        checkOutLocalTime: missingCheckOut === "" ? null : missingCheckOut,
        note: missingNote.trim() === "" ? null : missingNote.trim(),
        changeReason: reason,
        expectedRevisionNo: null,
      });
      const addedFor = { employeeId: missingEmployee, businessDate: missingDate };
      setMissingOpen(false);
      resetMissingForm();
      setMessage("The missing attendance record was added to history.");
      setSelected(addedFor);
      await loadRows();
    } catch (caught) {
      if (isStaleHistoryConflict(caught)) {
        setMissingError(PATH_B_CONFLICT_MESSAGE);
      } else {
        setMissingError(historyErrorMessage(caught));
      }
    } finally {
      setMissingPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field htmlFor="history-from" label="From date">
            <TextInput
              id="history-from"
              max={to}
              onChange={event => setFrom(event.target.value)}
              type="date"
              value={from}
            />
          </Field>
          <Field htmlFor="history-to" label="To date">
            <TextInput
              id="history-to"
              max={today}
              onChange={event => setTo(event.target.value)}
              type="date"
              value={to}
            />
          </Field>
          <Field htmlFor="history-employee" label="Employee">
            <Select
              id="history-employee"
              onChange={event => setEmployeeFilter(event.target.value)}
              value={employeeFilter}
            >
              <option value="">All employees</option>
              {employees.map(employee => (
                <option key={employee.id} value={employee.id}>
                  {`${employee.fullName} (${employee.employeeCode})`}
                </option>
              ))}
            </Select>
          </Field>
          <Field htmlFor="history-department" label="Department">
            <Select
              id="history-department"
              onChange={event => setDepartmentFilter(event.target.value)}
              value={departmentFilter}
            >
              <option value="">All departments</option>
              {departments.map(department => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field htmlFor="history-status" label="Status">
            <Select
              id="history-status"
              onChange={event => setStatusFilter(event.target.value as HistoryStatusFilter)}
              value={statusFilter}
            >
              <option value="">All statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="INCOMPLETE">Incomplete</option>
              <option value="NOT_REQUIRED">Not Required</option>
              <option value="NOT_APPLICABLE">Not Applicable</option>
            </Select>
          </Field>
          <Field htmlFor="history-search" label="Search">
            <TextInput
              id="history-search"
              onChange={event => setSearchInput(event.target.value)}
              placeholder="Search by name or code"
              type="search"
              value={searchInput}
            />
          </Field>
        </div>
      </Card>

      {message ? <Notice tone="success">{message}</Notice> : null}

      {selected ? (
        <AttendanceHistoryDetail
          businessDate={selected.businessDate}
          employeeId={selected.employeeId}
          onChanged={() => {
            setMessage(null);
            void loadRows();
          }}
          onClose={() => setSelected(null)}
        />
      ) : null}

      {loading && rows.length === 0 ? <LoadingPanel message="Loading attendance history..." /> : null}

      {!loading && error && rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          <Notice tone="error">{error}</Notice>
          <div>
            <Button onClick={() => void loadRows()} variant="secondary">
              Try Again
            </Button>
          </div>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card sm:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Employee</th>
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Check In</th>
                  <th className="px-3 py-3 font-medium">Check Out</th>
                  <th className="px-3 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(row => (
                  <tr key={`${row.employee.employeeId}-${row.businessDate}`}>
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <span className="break-words text-sm font-medium text-foreground">
                          {row.employee.fullName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {row.employee.department
                            ? `${row.employee.employeeCode} · ${row.employee.department.name}`
                            : row.employee.employeeCode}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      {businessDateLabel(row.businessDate)}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge tone={historyStatusTone(row.status)}>
                        {historyStatusLabel(row.status)}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-3 text-sm text-foreground">
                      {punchTimeLabel(row.checkInAt)}
                    </td>
                    <td className="px-3 py-3 text-sm text-foreground">
                      {punchTimeLabel(row.checkOutAt)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        onClick={() =>
                          setSelected({
                            employeeId: row.employee.employeeId,
                            businessDate: row.businessDate,
                          })
                        }
                        variant="secondary"
                      >
                        View History
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 sm:hidden">
            {rows.map(row => (
              <article
                className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4"
                key={`${row.employee.employeeId}-${row.businessDate}`}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="break-words text-sm font-medium text-foreground">
                    {row.employee.fullName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.employee.department
                      ? `${row.employee.employeeCode} · ${row.employee.department.name}`
                      : row.employee.employeeCode}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-3">
                  <Detail label="Date">{businessDateLabel(row.businessDate)}</Detail>
                  <div className="flex min-w-0 flex-col gap-1">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Status
                    </dt>
                    <dd>
                      <StatusBadge tone={historyStatusTone(row.status)}>
                        {historyStatusLabel(row.status)}
                      </StatusBadge>
                    </dd>
                  </div>
                  <Detail label="Check In">{punchTimeLabel(row.checkInAt)}</Detail>
                  <Detail label="Check Out">{punchTimeLabel(row.checkOutAt)}</Detail>
                </dl>
                <Button
                  className="self-start"
                  onClick={() =>
                    setSelected({
                      employeeId: row.employee.employeeId,
                      businessDate: row.businessDate,
                    })
                  }
                  variant="secondary"
                >
                  View History
                </Button>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          description="No finalized attendance matches the current filters."
          title="No attendance history found"
        />
      ) : null}

      <Card>
        <CardHeader
          actions={
            <Button
              onClick={() => {
                setMissingOpen(open => !open);
                setMissingError(null);
              }}
              variant="secondary"
            >
              {missingOpen ? "Close" : "Add Missing Record"}
            </Button>
          }
          description="Add a missing attendance record when a finalized date should have attendance for an employee but none was recorded. The employee must have been eligible on that date."
          title="Missing attendance record"
        />
        {missingOpen ? (
          <div className="mt-4 flex flex-col gap-4">
            {missingError ? <Notice tone="error">{missingError}</Notice> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field htmlFor="missing-employee" label="Employee" required>
                <Select
                  disabled={missingPending}
                  id="missing-employee"
                  onChange={event => setMissingEmployee(event.target.value)}
                  value={missingEmployee}
                >
                  <option value="">Select an employee</option>
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {`${employee.fullName} (${employee.employeeCode})`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field htmlFor="missing-date" label="Business date" required>
                <TextInput
                  disabled={missingPending}
                  id="missing-date"
                  max={today}
                  onChange={event => setMissingDate(event.target.value)}
                  type="date"
                  value={missingDate}
                />
              </Field>
              <Field htmlFor="missing-check-in" label="Check In">
                <TextInput
                  disabled={missingPending}
                  id="missing-check-in"
                  onChange={event => setMissingCheckIn(event.target.value)}
                  type="time"
                  value={missingCheckIn}
                />
              </Field>
              <Field htmlFor="missing-check-out" label="Check Out">
                <TextInput
                  disabled={missingPending}
                  id="missing-check-out"
                  onChange={event => setMissingCheckOut(event.target.value)}
                  type="time"
                  value={missingCheckOut}
                />
              </Field>
            </div>
            <Field htmlFor="missing-note" label="Note">
              <TextArea
                disabled={missingPending}
                id="missing-note"
                onChange={event => setMissingNote(event.target.value)}
                value={missingNote}
              />
            </Field>
            <Field
              htmlFor="missing-reason"
              label="Change reason"
              required
              hint="Explain why this attendance record should have existed."
            >
              <TextArea
                disabled={missingPending}
                id="missing-reason"
                onChange={event => setMissingReason(event.target.value)}
                value={missingReason}
              />
            </Field>
            <div className="flex justify-end">
              <Button disabled={missingPending} onClick={() => void submitMissingRecord()}>
                Save Missing Record
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
