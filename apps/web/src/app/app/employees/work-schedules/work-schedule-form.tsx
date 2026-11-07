"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  WorkScheduleDay,
  WorkScheduleDefinitionInput,
} from "@/lib/api";
import { Button, Field, Notice, TextArea, TextInput } from "../../_components/ui";
import {
  DISPLAY_WEEKDAYS,
  initialWorkScheduleDays,
  minuteLabel,
  weekdayLabel,
} from "./work-schedule-view";

export { formatScheduleDate, minuteLabel } from "./work-schedule-view";

export type WorkScheduleFormMode = "initial" | "change" | "definition";

export type WorkScheduleFormValue = {
  definition: WorkScheduleDefinitionInput;
  effectiveDate: string;
  reason: string;
};

type WorkScheduleFormProps = {
  mode: WorkScheduleFormMode;
  initial?: WorkScheduleDefinitionInput;
  minimumEffectiveDate?: string;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (value: WorkScheduleFormValue) => Promise<void>;
};

function toTimeInput(value: number | null): string {
  if (value === null) return "";
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function fromTimeInput(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function copyDays(days: WorkScheduleDay[]): WorkScheduleDay[] {
  return DISPLAY_WEEKDAYS.map((dayOfWeek) => {
    const row = days.find((day) => day.dayOfWeek === dayOfWeek);
    if (!row) {
      return {
        dayOfWeek,
        isWorkingDay: false,
        startMinuteOfDay: null,
        endMinuteOfDay: null,
        unpaidBreakMinutes: 0,
        crossesMidnight: false,
      };
    }
    return { ...row };
  });
}

export function WorkScheduleForm({
  mode,
  initial,
  minimumEffectiveDate,
  submitLabel,
  onCancel,
  onSubmit,
}: WorkScheduleFormProps) {
  const initialDays = useMemo(
    () => copyDays(initial?.days ?? initialWorkScheduleDays()),
    [initial],
  );
  const [name, setName] = useState(initial?.name ?? "Standard Office Schedule");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [days, setDays] = useState(initialDays);
  const [effectiveDate, setEffectiveDate] = useState(
    mode === "initial" ? "2026-09-01" : "",
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const requiresEffectiveDate = mode !== "definition";
  const requiresReason = mode === "change";

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function patchDay(index: number, patch: Partial<WorkScheduleDay>) {
    setDirty(true);
    setDays((current) =>
      current.map((day, rowIndex) =>
        rowIndex === index ? { ...day, ...patch } : day,
      ),
    );
  }

  function cancel() {
    if (dirty && !window.confirm("Discard unsaved Work Schedule changes?")) return;
    onCancel();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (
      !name.trim() ||
      (requiresEffectiveDate && !effectiveDate) ||
      (requiresReason && !reason.trim())
    ) {
      setError("Complete the required fields before saving.");
      return;
    }
    if (
      mode === "change" &&
      minimumEffectiveDate &&
      effectiveDate < minimumEffectiveDate
    ) {
      setError(`Effective From must be ${minimumEffectiveDate} or later.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        definition: {
          name: name.trim(),
          description: description.trim() || null,
          days,
        },
        effectiveDate,
        reason: reason.trim(),
      });
      setDirty(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save the Work Schedule.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="mt-5 flex min-w-0 flex-col gap-5" onSubmit={save}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="work-schedule-name" label="Schedule Name" required>
          <TextInput
            id="work-schedule-name"
            maxLength={150}
            onChange={(event) => {
              setDirty(true);
              setName(event.target.value);
            }}
            required
            value={name}
          />
        </Field>
        {requiresEffectiveDate ? (
          <Field
            htmlFor="work-schedule-effective-from"
            hint={
              mode === "initial"
                ? "Approved initial setup date."
                : "The new office hours start on this date."
            }
            label="Effective From"
            required
          >
            <TextInput
              id="work-schedule-effective-from"
              min={minimumEffectiveDate}
              onChange={(event) => {
                setDirty(true);
                setEffectiveDate(event.target.value);
              }}
              required
              type="date"
              value={effectiveDate}
            />
          </Field>
        ) : null}
        <Field
          className="sm:col-span-2"
          htmlFor="work-schedule-description"
          label="Description"
        >
          <TextArea
            id="work-schedule-description"
            maxLength={500}
            onChange={(event) => {
              setDirty(true);
              setDescription(event.target.value);
            }}
            value={description}
          />
        </Field>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground">Weekly hours</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Select the working days. Friday is an initial business setting, not a fixed system rule.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {days.map((day, index) => (
            <div className="min-w-0 rounded-lg border border-border p-4" key={day.dayOfWeek}>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  checked={day.isWorkingDay}
                  className="size-4 accent-primary"
                  onChange={(event) =>
                    patchDay(
                      index,
                      event.target.checked
                        ? {
                            isWorkingDay: true,
                            startMinuteOfDay: 600,
                            endMinuteOfDay: 1080,
                            unpaidBreakMinutes: 60,
                            crossesMidnight: false,
                          }
                        : {
                            isWorkingDay: false,
                            startMinuteOfDay: null,
                            endMinuteOfDay: null,
                            unpaidBreakMinutes: 0,
                            crossesMidnight: false,
                          },
                    )
                  }
                  type="checkbox"
                />
                {weekdayLabel(day.dayOfWeek)}
              </label>
              {day.isWorkingDay ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field htmlFor={`work-schedule-start-${index}`} label="Start" required>
                    <TextInput
                      id={`work-schedule-start-${index}`}
                      onChange={(event) =>
                        patchDay(index, {
                          startMinuteOfDay: fromTimeInput(event.target.value),
                        })
                      }
                      required
                      type="time"
                      value={toTimeInput(day.startMinuteOfDay)}
                    />
                  </Field>
                  <Field htmlFor={`work-schedule-end-${index}`} label="End" required>
                    <TextInput
                      id={`work-schedule-end-${index}`}
                      onChange={(event) =>
                        patchDay(index, {
                          endMinuteOfDay: fromTimeInput(event.target.value),
                        })
                      }
                      required
                      type="time"
                      value={toTimeInput(day.endMinuteOfDay)}
                    />
                  </Field>
                  <Field
                    htmlFor={`work-schedule-break-${index}`}
                    label="Unpaid Break (minutes)"
                    required
                  >
                    <TextInput
                      id={`work-schedule-break-${index}`}
                      min={0}
                      onChange={(event) =>
                        patchDay(index, {
                          unpaidBreakMinutes: Number(event.target.value),
                        })
                      }
                      required
                      type="number"
                      value={day.unpaidBreakMinutes}
                    />
                  </Field>
                  <details className="rounded-md border border-border px-3 py-2 text-sm">
                    <summary className="cursor-pointer font-medium">Advanced</summary>
                    <label className="mt-3 flex items-center gap-2">
                      <input
                        checked={day.crossesMidnight}
                        className="size-4 accent-primary"
                        onChange={(event) =>
                          patchDay(index, { crossesMidnight: event.target.checked })
                        }
                        type="checkbox"
                      />
                      Ends next day
                    </label>
                  </details>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    {minuteLabel(day.startMinuteOfDay)} – {minuteLabel(day.endMinuteOfDay)}
                    {day.crossesMidnight ? " (ends next day)" : ""}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Weekly rest day</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {requiresReason ? (
        <Field htmlFor="work-schedule-change-reason" label="Change Reason" required>
          <TextArea
            id="work-schedule-change-reason"
            maxLength={500}
            onChange={(event) => {
              setDirty(true);
              setReason(event.target.value);
            }}
            required
            value={reason}
          />
        </Field>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-wrap gap-3">
        <Button disabled={saving} type="submit">
          {saving ? "Saving..." : submitLabel}
        </Button>
        <Button disabled={saving} onClick={cancel} variant="secondary">
          Cancel
        </Button>
      </div>
    </form>
  );
}
