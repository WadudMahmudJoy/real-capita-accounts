"use client";

import type { AttendanceDayRow } from "@/lib/attendance-api";
import { Button, StatusBadge, TextInput } from "../../_components/ui";
import {
  expectedWindowLabel,
  localTimeValue,
  punchTimeLabel,
  statusLabel,
  statusTone,
} from "./attendance-view";

export type AttendancePunchDraft = {
  checkIn?: string;
  checkOut?: string;
};

export function AttendanceDayRowView({
  row,
  variant,
  editable,
  draft,
  actionPending,
  onPunchChange,
  onDiscard,
}: {
  row: AttendanceDayRow;
  variant: "table" | "card";
  editable: boolean;
  draft?: AttendancePunchDraft;
  actionPending: boolean;
  onPunchChange: (employeeId: string, field: "checkIn" | "checkOut", value: string) => void;
  onDiscard: (row: AttendanceDayRow) => void;
}) {
  const employee = row.employee;
  const checkInValue = draft?.checkIn !== undefined ? draft.checkIn : localTimeValue(row.checkInAt);
  const checkOutValue = draft?.checkOut !== undefined ? draft.checkOut : localTimeValue(row.checkOutAt);
  const canDiscard = editable && row.expectedUpdatedAt !== null && !actionPending;
  const employeeMeta = employee.department
    ? `${employee.employeeCode} · ${employee.department.name}`
    : employee.employeeCode;

  if (variant === "table") {
    return (
      <tr className="align-middle">
        <td className="px-3 py-3">
          <div className="flex flex-col">
            <span className="break-words text-sm font-medium text-foreground">
              {employee.fullName}
            </span>
            <span className="text-xs text-muted-foreground">{employeeMeta}</span>
          </div>
        </td>
        <td className="px-3 py-3 text-sm text-muted-foreground">
          {expectedWindowLabel(row)}
        </td>
        <td className="px-3 py-3">
          {editable ? (
            <TextInput
              aria-label={`Check In for ${employee.fullName}`}
              className="h-9 w-28"
              disabled={actionPending}
              id={`attendance-check-in-${employee.employeeId}`}
              onChange={event => onPunchChange(employee.employeeId, "checkIn", event.target.value)}
              type="time"
              value={checkInValue}
            />
          ) : (
            <span className="text-sm text-foreground">{punchTimeLabel(row.checkInAt)}</span>
          )}
        </td>
        <td className="px-3 py-3">
          {editable ? (
            <TextInput
              aria-label={`Check Out for ${employee.fullName}`}
              className="h-9 w-28"
              disabled={actionPending}
              id={`attendance-check-out-${employee.employeeId}`}
              onChange={event => onPunchChange(employee.employeeId, "checkOut", event.target.value)}
              type="time"
              value={checkOutValue}
            />
          ) : (
            <span className="text-sm text-foreground">{punchTimeLabel(row.checkOutAt)}</span>
          )}
        </td>
        <td className="px-3 py-3">
          <StatusBadge tone={statusTone(row.status)}>{statusLabel(row)}</StatusBadge>
        </td>
        <td className="px-3 py-3 text-right">
          {canDiscard ? (
            <Button
              disabled={actionPending}
              onClick={() => onDiscard(row)}
              variant="danger"
            >
              Discard Entry
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="break-words text-sm font-medium text-foreground">
            {employee.fullName}
          </span>
          <span className="text-xs text-muted-foreground">{employeeMeta}</span>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Expected
          </dt>
          <dd className="text-sm text-foreground">{expectedWindowLabel(row)}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </dt>
          <dd>
            <StatusBadge tone={statusTone(row.status)}>{statusLabel(row)}</StatusBadge>
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Check In
          </dt>
          <dd>
            {editable ? (
              <TextInput
                aria-label={`Check In for ${employee.fullName}`}
                className="h-9"
                disabled={actionPending}
                id={`attendance-card-check-in-${employee.employeeId}`}
                onChange={event => onPunchChange(employee.employeeId, "checkIn", event.target.value)}
                type="time"
                value={checkInValue}
              />
            ) : (
              <span className="text-sm text-foreground">{punchTimeLabel(row.checkInAt)}</span>
            )}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Check Out
          </dt>
          <dd>
            {editable ? (
              <TextInput
                aria-label={`Check Out for ${employee.fullName}`}
                className="h-9"
                disabled={actionPending}
                id={`attendance-card-check-out-${employee.employeeId}`}
                onChange={event => onPunchChange(employee.employeeId, "checkOut", event.target.value)}
                type="time"
                value={checkOutValue}
              />
            ) : (
              <span className="text-sm text-foreground">{punchTimeLabel(row.checkOutAt)}</span>
            )}
          </dd>
        </div>
      </dl>
      {canDiscard ? (
        <Button
          className="self-start"
          disabled={actionPending}
          onClick={() => onDiscard(row)}
          variant="danger"
        >
          Discard Entry
        </Button>
      ) : null}
    </article>
  );
}
