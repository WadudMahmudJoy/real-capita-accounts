"use client";

import { useMemo } from "react";
import type { Department } from "@/lib/api";
import type {
  AttendanceDay,
  AttendanceDayRow,
  AttendanceNeedsReviewRow,
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
  TextInput,
} from "../../_components/ui";
import { AttendanceDayRowView, type AttendancePunchDraft } from "./attendance-day-row";
import { businessDateLabel, daySummaryChips, dhakaToday, punchTimeLabel } from "./attendance-view";

export type AttendanceDiscardTarget = {
  employeeId: string;
  employeeName: string;
  expectedUpdatedAt: string;
};

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function DailyAttendancePanel({
  day,
  loading,
  error,
  message,
  departments,
  businessDate,
  departmentFilter,
  searchFilter,
  punchDrafts,
  actionPending,
  finalizeAllowed,
  availability,
  onBusinessDateChange,
  onDepartmentFilterChange,
  onSearchFilterChange,
  onPunchChange,
  onSave,
  onDiscardRow,
  onDiscardNeedsReview,
  onFinalize,
  onReload,
}: {
  day: AttendanceDay | null;
  loading: boolean;
  error: string | null;
  message: string | null;
  departments: Department[];
  businessDate: string;
  departmentFilter: string;
  searchFilter: string;
  punchDrafts: Record<string, AttendancePunchDraft>;
  actionPending: boolean;
  finalizeAllowed: boolean;
  availability: string | null;
  onBusinessDateChange: (value: string) => void;
  onDepartmentFilterChange: (value: string) => void;
  onSearchFilterChange: (value: string) => void;
  onPunchChange: (employeeId: string, field: "checkIn" | "checkOut", value: string) => void;
  onSave: () => void;
  onDiscardRow: (row: AttendanceDayRow) => void;
  onDiscardNeedsReview: (entry: AttendanceNeedsReviewRow) => void;
  onFinalize: () => void;
  onReload: () => void;
}) {
  const filteredRows = useMemo(() => {
    if (!day) return [];
    const search = searchFilter.trim().toLowerCase();
    return day.rows.filter(row => {
      if (departmentFilter && row.employee.department?.id !== departmentFilter) {
        return false;
      }
      if (search) {
        const haystack = `${row.employee.fullName} ${row.employee.employeeCode}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [day, departmentFilter, searchFilter]);

  const editable = day !== null && !day.finalized;
  const chips = day ? daySummaryChips(day) : null;
  const hasDraftsToSave = day?.rows.some(row => punchDrafts[row.employee.employeeId] !== undefined) ?? false;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field htmlFor="attendance-date" label="Date">
            <TextInput
              id="attendance-date"
              max={dhakaToday()}
              onChange={event => onBusinessDateChange(event.target.value)}
              type="date"
              value={businessDate}
            />
          </Field>
          <Field htmlFor="attendance-department" label="Department">
            <Select
              id="attendance-department"
              onChange={event => onDepartmentFilterChange(event.target.value)}
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
          <Field htmlFor="attendance-search" label="Search">
            <TextInput
              id="attendance-search"
              onChange={event => onSearchFilterChange(event.target.value)}
              placeholder="Search by name or code"
              type="search"
              value={searchFilter}
            />
          </Field>
        </div>
      </Card>

      {loading && day === null ? <LoadingPanel message="Loading attendance..." /> : null}

      {error && day === null && !loading ? (
        <div className="flex flex-col gap-3">
          <Notice tone="error">{error}</Notice>
          <div>
            <Button onClick={onReload} variant="secondary">
              Try Again
            </Button>
          </div>
        </div>
      ) : null}

      {day ? (
        <div className="flex flex-col gap-6">
          {error ? <Notice tone="error">{error}</Notice> : null}
          {message ? <Notice tone="info">{message}</Notice> : null}
          {day.finalized ? (
            <Notice tone="success">
              {`This day is finalized. Attendance for ${businessDateLabel(businessDate)} is locked and can only be changed through a correction.`}
            </Notice>
          ) : null}
          {availability ? <Notice tone="info">{availability}</Notice> : null}

          {chips ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <SummaryChip label="Expected" value={chips.expected} />
              <SummaryChip label="Present" value={chips.present} />
              <SummaryChip label="Late" value={chips.late} />
              <SummaryChip label="Pending" value={chips.pending} />
              <SummaryChip label="Incomplete" value={chips.incomplete} />
            </div>
          ) : null}

          {day.needsReview.length > 0 ? (
            <Card>
              <CardHeader
                description="These saved attendance entries belong to employees who are no longer in the eligible roster for this date. Review each entry and discard it if it should not be counted. The day cannot be finalized while these entries remain."
                title="Needs review"
              />
              <ul className="mt-4 flex flex-col gap-3">
                {day.needsReview.map(entry => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3"
                    key={entry.employee.employeeId}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="break-words text-sm font-medium text-foreground">
                        {entry.employee.fullName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.employee.department
                          ? `${entry.employee.employeeCode} · ${entry.employee.department.name}`
                          : entry.employee.employeeCode}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {`${punchTimeLabel(entry.checkInAt)} – ${punchTimeLabel(entry.checkOutAt)}`}
                      </span>
                      <Button
                        disabled={actionPending}
                        onClick={() => onDiscardNeedsReview(entry)}
                        variant="danger"
                      >
                        Discard Entry
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {filteredRows.length === 0 ? (
            <EmptyState
              description={
                day.rows.length === 0
                  ? "No employees are eligible for attendance on this date."
                  : "No employees match the current filters."
              }
              title={day.rows.length === 0 ? "No attendance to record" : "No matching employees"}
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-xl border border-border bg-card sm:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 font-medium">Employee</th>
                      <th className="px-3 py-3 font-medium">Expected</th>
                      <th className="px-3 py-3 font-medium">Check In</th>
                      <th className="px-3 py-3 font-medium">Check Out</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRows.map(row => (
                      <AttendanceDayRowView
                        actionPending={actionPending}
                        draft={punchDrafts[row.employee.employeeId]}
                        editable={editable}
                        key={row.employee.employeeId}
                        onDiscard={onDiscardRow}
                        onPunchChange={onPunchChange}
                        row={row}
                        variant="table"
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 sm:hidden">
                {filteredRows.map(row => (
                  <AttendanceDayRowView
                    actionPending={actionPending}
                    draft={punchDrafts[row.employee.employeeId]}
                    editable={editable}
                    key={row.employee.employeeId}
                    onDiscard={onDiscardRow}
                    onPunchChange={onPunchChange}
                    row={row}
                    variant="card"
                  />
                ))}
              </div>
            </>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              disabled={!editable || actionPending || !hasDraftsToSave}
              onClick={onSave}
              variant="secondary"
            >
              Save Attendance
            </Button>
            <Button
              disabled={!finalizeAllowed || actionPending}
              onClick={onFinalize}
            >
              Finalize Day
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
