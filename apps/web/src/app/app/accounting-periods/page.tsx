"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  ApiError,
  createAccountingPeriod,
  getAccountingPeriods,
  getFiscalYears,
  toErrorMessage,
  updateAccountingPeriod,
  type AccountingPeriod,
  type AccountingPeriodStatus,
  type FiscalYear,
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
  Select,
  StatusBadge,
  TextInput,
} from "../_components/ui";

type FormState = {
  id: string | null;
  fiscalYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: AccountingPeriodStatus;
};

const emptyForm: FormState = {
  endDate: "",
  fiscalYearId: "",
  id: null,
  name: "",
  startDate: "",
  status: "OPEN",
};

function toDateInput(value: string): string {
  return value.slice(0, 10);
}

function periodStatusBadge(status: AccountingPeriodStatus) {
  if (status === "OPEN") {
    return <StatusBadge tone="active">Open</StatusBadge>;
  }

  if (status === "LOCKED") {
    return <StatusBadge tone="closed">Locked</StatusBadge>;
  }

  return <StatusBadge tone="inactive">Closed</StatusBadge>;
}

function fiscalYearLabel(period: AccountingPeriod) {
  const fiscalYear = period.fiscalYear;

  if (!fiscalYear) {
    return "Fiscal year not loaded";
  }

  return fiscalYear.name;
}

export default function AccountingPeriodsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [periodData, fiscalYearData] = await Promise.all([
          getAccountingPeriods(controller.signal),
          getFiscalYears(controller.signal),
        ]);

        setPeriods(periodData);
        setFiscalYears(fiscalYearData);
        setStatus("ready");
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }

        setLoadError(toErrorMessage(caught));
        setStatus("error");
      }
    }

    void load();

    return () => controller.abort();
  }, [router]);

  async function reloadPeriods() {
    try {
      setPeriods(await getAccountingPeriods());
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }

      setFormError(toErrorMessage(caught));
    }
  }

  function startCreate() {
    setForm(emptyForm);
    setFormError(null);
    setFormSuccess(null);
  }

  function startEdit(period: AccountingPeriod) {
    setForm({
      endDate: toDateInput(period.endDate),
      fiscalYearId: period.fiscalYearId,
      id: period.id,
      name: period.name,
      startDate: toDateInput(period.startDate),
      status: period.status,
    });
    setFormError(null);
    setFormSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const name = form.name.trim();
    if (!form.fiscalYearId || !name || !form.startDate || !form.endDate) {
      setFormError("Fiscal year, name, start date, and end date are required.");
      return;
    }

    if (form.endDate <= form.startDate) {
      setFormError("End date must be after the start date.");
      return;
    }

    setIsSaving(true);

    try {
      if (form.id) {
        await updateAccountingPeriod(form.id, {
          endDate: form.endDate,
          fiscalYearId: form.fiscalYearId,
          name,
          startDate: form.startDate,
          status: form.status,
        });
        setFormSuccess("Accounting period updated.");
      } else {
        await createAccountingPeriod({
          endDate: form.endDate,
          fiscalYearId: form.fiscalYearId,
          name,
          startDate: form.startDate,
          status: form.status,
        });
        setFormSuccess("Accounting period created.");
      }

      setForm(emptyForm);
      await reloadPeriods();
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }

      setFormError(toErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  const isEditing = form.id !== null;
  const hasFiscalYears = fiscalYears.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        description="Define monthly or custom accounting periods inside a fiscal year. Voucher posting is still deferred."
        title="Accounting Periods"
      />

      {status === "loading" ? (
        <LoadingPanel message="Loading accounting periods..." />
      ) : null}

      {status === "error" ? (
        <Notice tone="error">{loadError}</Notice>
      ) : null}

      {status === "ready" ? (
        <>
          {!hasFiscalYears ? (
            <Notice tone="info">
              Create a fiscal year before adding accounting periods.
            </Notice>
          ) : null}

          <Card>
            <CardHeader
              actions={
                isEditing ? (
                  <Button onClick={startCreate} variant="ghost">
                    Cancel edit
                  </Button>
                ) : null
              }
              description={
                isEditing
                  ? "Update the selected period and status."
                  : "Add a period within a fiscal year."
              }
              title={isEditing ? "Edit accounting period" : "New accounting period"}
            />

            <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  className="sm:col-span-2"
                  htmlFor="period-fiscal-year"
                  label="Fiscal year"
                  required
                >
                  <Select
                    disabled={!hasFiscalYears}
                    id="period-fiscal-year"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        fiscalYearId: event.target.value,
                      }))
                    }
                    required
                    value={form.fiscalYearId}
                  >
                    <option value="">Select fiscal year</option>
                    {fiscalYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field htmlFor="period-name" label="Name" required>
                  <TextInput
                    disabled={!hasFiscalYears}
                    id="period-name"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    placeholder="July 2026"
                    required
                    value={form.name}
                  />
                </Field>

                <Field htmlFor="period-status" label="Status" required>
                  <Select
                    disabled={!hasFiscalYears}
                    id="period-status"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        status: event.target.value as AccountingPeriodStatus,
                      }))
                    }
                    value={form.status}
                  >
                    <option value="OPEN">Open</option>
                    <option value="LOCKED">Locked</option>
                    <option value="CLOSED">Closed</option>
                  </Select>
                </Field>

                <Field htmlFor="period-start" label="Start date" required>
                  <TextInput
                    disabled={!hasFiscalYears}
                    id="period-start"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        startDate: event.target.value,
                      }))
                    }
                    required
                    type="date"
                    value={form.startDate}
                  />
                </Field>

                <Field htmlFor="period-end" label="End date" required>
                  <TextInput
                    disabled={!hasFiscalYears}
                    id="period-end"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        endDate: event.target.value,
                      }))
                    }
                    required
                    type="date"
                    value={form.endDate}
                  />
                </Field>
              </div>

              {formError ? <Notice tone="error">{formError}</Notice> : null}
              {formSuccess ? (
                <Notice tone="success">{formSuccess}</Notice>
              ) : null}

              <div className="flex items-center gap-3">
                <Button disabled={isSaving || !hasFiscalYears} type="submit">
                  {isSaving
                    ? "Saving..."
                    : isEditing
                      ? "Save changes"
                      : "Create period"}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader
              description="Periods ordered by start date."
              title="Accounting periods"
            />

            {periods.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  description="Create the first accounting period using the form above."
                  title="No accounting periods yet"
                />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2.5">Name</th>
                      <th className="px-3 py-2.5">Fiscal year</th>
                      <th className="px-3 py-2.5">Start</th>
                      <th className="px-3 py-2.5">End</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((period) => (
                      <tr
                        className="border-b border-border/70 last:border-0"
                        key={period.id}
                      >
                        <td className="px-3 py-3 font-medium text-foreground">
                          {period.name}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {fiscalYearLabel(period)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {toDateInput(period.startDate)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {toDateInput(period.endDate)}
                        </td>
                        <td className="px-3 py-3">
                          {periodStatusBadge(period.status)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end">
                            <Button
                              onClick={() => startEdit(period)}
                              variant="ghost"
                            >
                              <Pencil aria-hidden="true" className="size-4" />
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
