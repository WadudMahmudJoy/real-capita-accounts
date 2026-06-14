"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  activateFiscalYear,
  ApiError,
  createFiscalYear,
  getCompany,
  getFiscalYears,
  toErrorMessage,
  updateFiscalYear,
  type FiscalYear,
} from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  CheckboxField,
  EmptyState,
  Field,
  LoadingPanel,
  Notice,
  PageIntro,
  StatusBadge,
  TextInput,
} from "../_components/ui";

type FormState = {
  id: string | null;
  name: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
};

const emptyForm: FormState = {
  endDate: "",
  id: null,
  isClosed: false,
  name: "",
  startDate: "",
};

function toDateInput(value: string): string {
  return value.slice(0, 10);
}

function statusBadge(year: FiscalYear) {
  if (year.isClosed) {
    return <StatusBadge tone="closed">Closed</StatusBadge>;
  }

  if (year.isActive) {
    return <StatusBadge tone="active">Active</StatusBadge>;
  }

  return <StatusBadge tone="inactive">Inactive</StatusBadge>;
}

export default function FiscalYearsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyMissing, setCompanyMissing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [years, company] = await Promise.all([
          getFiscalYears(controller.signal),
          getCompany(controller.signal).catch((caught) => {
            if (caught instanceof ApiError && caught.isNotFound) {
              return null;
            }
            throw caught;
          }),
        ]);

        setFiscalYears(years);
        setCompanyId(company?.id ?? null);
        setCompanyMissing(company === null);
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

  async function reloadFiscalYears() {
    try {
      const years = await getFiscalYears();
      setFiscalYears(years);
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }

      setListError(toErrorMessage(caught));
    }
  }

  function startCreate() {
    setForm(emptyForm);
    setFormError(null);
    setFormSuccess(null);
  }

  function startEdit(year: FiscalYear) {
    setForm({
      endDate: toDateInput(year.endDate),
      id: year.id,
      isClosed: year.isClosed,
      name: year.name,
      startDate: toDateInput(year.startDate),
    });
    setFormError(null);
    setFormSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const name = form.name.trim();
    if (!name || !form.startDate || !form.endDate) {
      setFormError("Name, start date, and end date are required.");
      return;
    }

    if (form.endDate <= form.startDate) {
      setFormError("End date must be after the start date.");
      return;
    }

    setIsSaving(true);

    try {
      if (form.id) {
        await updateFiscalYear(form.id, {
          endDate: form.endDate,
          isClosed: form.isClosed,
          name,
          startDate: form.startDate,
        });
        setFormSuccess("Fiscal year updated.");
      } else {
        if (!companyId) {
          setFormError("Create the company profile before adding fiscal years.");
          return;
        }

        await createFiscalYear({
          companyId,
          endDate: form.endDate,
          name,
          startDate: form.startDate,
        });
        setFormSuccess("Fiscal year created.");
      }

      setForm(emptyForm);
      await reloadFiscalYears();
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

  async function handleActivate(year: FiscalYear) {
    setListError(null);
    setActivatingId(year.id);

    try {
      await activateFiscalYear(year.id);
      await reloadFiscalYears();
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }

      setListError(toErrorMessage(caught));
    } finally {
      setActivatingId(null);
    }
  }

  const isEditing = form.id !== null;
  const createDisabled = !isEditing && companyMissing;

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        description="Create fiscal years for the company and mark the single active year. End date must be after the start date."
        title="Fiscal Years"
      />

      {status === "loading" ? (
        <LoadingPanel message="Loading fiscal years..." />
      ) : null}

      {status === "error" ? (
        <Notice tone="error">{loadError}</Notice>
      ) : null}

      {status === "ready" ? (
        <>
          {companyMissing ? (
            <Notice tone="info">
              No company profile exists yet. Create the company profile in{" "}
              <Link className="font-medium underline" href="/app/company">
                Company Setup
              </Link>{" "}
              before adding fiscal years.
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
                  ? "Update this fiscal year. Closing a fiscal year also clears its active status."
                  : "Add a new fiscal year for the company."
              }
              title={isEditing ? "Edit fiscal year" : "New fiscal year"}
            />

            <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  className="sm:col-span-2"
                  htmlFor="fy-name"
                  label="Name"
                  required
                >
                  <TextInput
                    disabled={createDisabled}
                    id="fy-name"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    placeholder="FY 2025-2026"
                    required
                    value={form.name}
                  />
                </Field>

                <Field htmlFor="fy-start" label="Start date" required>
                  <TextInput
                    disabled={createDisabled}
                    id="fy-start"
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

                <Field htmlFor="fy-end" label="End date" required>
                  <TextInput
                    disabled={createDisabled}
                    id="fy-end"
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

                {isEditing ? (
                  <div className="sm:col-span-2">
                    <CheckboxField
                      checked={form.isClosed}
                      description="A closed fiscal year cannot be set active."
                      id="fy-closed"
                      label="Closed"
                      onChange={(checked) =>
                        setForm((previous) => ({
                          ...previous,
                          isClosed: checked,
                        }))
                      }
                    />
                  </div>
                ) : null}
              </div>

              {formError ? <Notice tone="error">{formError}</Notice> : null}
              {formSuccess ? (
                <Notice tone="success">{formSuccess}</Notice>
              ) : null}

              <div className="flex items-center gap-3">
                <Button disabled={isSaving || createDisabled} type="submit">
                  {isSaving
                    ? "Saving..."
                    : isEditing
                      ? "Save changes"
                      : "Create fiscal year"}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader
              description="All fiscal years, newest first."
              title="Fiscal years"
            />

            {listError ? (
              <div className="mt-4">
                <Notice tone="error">{listError}</Notice>
              </div>
            ) : null}

            {fiscalYears.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  description="Create the first fiscal year using the form above."
                  title="No fiscal years yet"
                />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2.5">Name</th>
                      <th className="px-3 py-2.5">Start</th>
                      <th className="px-3 py-2.5">End</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiscalYears.map((year) => (
                      <tr
                        className="border-b border-border/70 last:border-0"
                        key={year.id}
                      >
                        <td className="px-3 py-3 font-medium text-foreground">
                          {year.name}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {toDateInput(year.startDate)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {toDateInput(year.endDate)}
                        </td>
                        <td className="px-3 py-3">{statusBadge(year)}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {!year.isActive && !year.isClosed ? (
                              <Button
                                disabled={activatingId === year.id}
                                onClick={() => handleActivate(year)}
                                variant="secondary"
                              >
                                {activatingId === year.id
                                  ? "Activating..."
                                  : "Activate"}
                              </Button>
                            ) : null}
                            <Button
                              onClick={() => startEdit(year)}
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
