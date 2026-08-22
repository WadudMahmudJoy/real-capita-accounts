"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Pencil, Plus, RefreshCw, X } from "lucide-react";
import {
  ApiError,
  approveSalaryAssignment,
  createSalaryAssignment,
  getSalaryAssignments,
  getSalaryStructures,
  updateSalaryAssignment,
  type EmployeeSalaryAssignment,
  type SalaryAssignmentInput,
  type SalaryStructure,
} from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  LoadingPanel,
  Notice,
  Select,
  TextArea,
  TextInput,
} from "./ui";
import {
  ConfirmationDialog,
  FieldError,
  dateInputValue,
  fieldErrorProps,
  formatBdt,
  formatEffectivePeriod,
  formatSalaryDate,
  isPositiveDecimal,
  nullableText,
  salaryErrorMessage,
  salaryStatusBadge,
} from "./salary-ui";

type AssignmentForm = {
  salaryStructureId: string;
  grossSalary: string;
  effectiveFrom: string;
  effectiveTo: string;
  changeReason: string;
};

const emptyForm: AssignmentForm = {
  salaryStructureId: "",
  grossSalary: "",
  effectiveFrom: "",
  effectiveTo: "",
  changeReason: "",
};

export function SalaryAssignmentPanel({
  employeeId,
  employeeActive,
}: {
  employeeId: string;
  employeeActive: boolean;
}) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<EmployeeSalaryAssignment[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeSalaryAssignment | null>(null);
  const [form, setForm] = useState<AssignmentForm>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<EmployeeSalaryAssignment | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const [assignmentRows, structureRows] = await Promise.all([
          getSalaryAssignments(employeeId, signal),
          getSalaryStructures(signal),
        ]);
        setAssignments(assignmentRows);
        setStructures(structureRows);
        setLoadError(null);
        setStatus("ready");
      } catch (caught) {
        if (signal?.aborted) return;
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }
        setLoadError(salaryErrorMessage(caught));
        setStatus("error");
      }
    },
    [employeeId, router],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function initialLoad() {
      try {
        const [assignmentRows, structureRows] = await Promise.all([
          getSalaryAssignments(employeeId, controller.signal),
          getSalaryStructures(controller.signal),
        ]);
        setAssignments(assignmentRows);
        setStructures(structureRows);
        setLoadError(null);
        setStatus("ready");
      } catch (caught) {
        if (controller.signal.aborted) return;
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }
        setLoadError(salaryErrorMessage(caught));
        setStatus("error");
      }
    }
    void initialLoad();
    return () => controller.abort();
  }, [employeeId, router]);

  const approvedStructures = useMemo(
    () => structures.filter((structure) => structure.status === "APPROVED"),
    [structures],
  );
  const hasApprovedHistory = assignments.some((row) => row.status === "APPROVED");

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      salaryStructureId: approvedStructures[0]?.id ?? "",
    });
    setFieldErrors({});
    setFormError(null);
    setSuccess(null);
    setFormOpen(true);
  }

  function openEdit(row: EmployeeSalaryAssignment) {
    setEditing(row);
    setForm({
      salaryStructureId: row.salaryStructureId,
      grossSalary: row.grossSalary,
      effectiveFrom: dateInputValue(row.effectiveFrom),
      effectiveTo: dateInputValue(row.effectiveTo),
      changeReason: row.changeReason ?? "",
    });
    setFieldErrors({});
    setFormError(null);
    setSuccess(null);
    setFormOpen(true);
  }

  function validate() {
    const errors: Record<string, string> = {};
    if (!form.salaryStructureId) errors.salaryStructureId = "Select an approved Salary Structure.";
    if (!isPositiveDecimal(form.grossSalary, 2)) {
      errors.grossSalary = "Gross Salary must be greater than zero with at most two decimal places.";
    }
    if (!form.effectiveFrom) errors.effectiveFrom = "Effective From is required.";
    if (form.effectiveTo && form.effectiveTo <= form.effectiveFrom) {
      errors.effectiveTo = "Effective To (exclusive) must be later than Effective From.";
    }
    if (hasApprovedHistory && !form.changeReason.trim()) {
      errors.changeReason = "Change Reason is required for a salary revision.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || !validate()) return;
    setIsSaving(true);
    setFormError(null);
    setSuccess(null);

    const payload: SalaryAssignmentInput = {
      salaryStructureId: form.salaryStructureId,
      grossSalary: form.grossSalary.trim(),
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
      changeReason: nullableText(form.changeReason),
    };

    try {
      if (editing) {
        await updateSalaryAssignment(editing.id, payload);
        setSuccess("Draft Salary Assignment updated.");
      } else {
        await createSalaryAssignment(employeeId, payload);
        setSuccess("Draft Salary Assignment created.");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }
      setFormError(salaryErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  async function approve() {
    if (!approvalTarget || isApproving) return;
    setIsApproving(true);
    setFormError(null);
    setSuccess(null);
    try {
      await approveSalaryAssignment(approvalTarget.id);
      setApprovalTarget(null);
      setSuccess("Salary Assignment approved. The effective history was refreshed.");
      await load();
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }
      setApprovalTarget(null);
      setFormError(salaryErrorMessage(caught));
    } finally {
      setIsApproving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Salary Assignment"
        description="Gross Salary and its approved Salary Structure are effective-dated. Approved records remain historical and read-only."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void load()} variant="ghost">
              <RefreshCw aria-hidden="true" className="size-4" />
              Refresh
            </Button>
            <Button
              disabled={!employeeActive || approvedStructures.length === 0}
              onClick={openCreate}
            >
              <Plus aria-hidden="true" className="size-4" />
              New Salary Assignment
            </Button>
          </div>
        }
      />

      {!employeeActive ? (
        <div className="mt-5">
          <Notice tone="info">Activate the employee before creating or approving Salary configuration.</Notice>
        </div>
      ) : null}
      {status === "loading" ? <div className="mt-5"><LoadingPanel message="Loading Salary Assignments..." /></div> : null}
      {status === "error" ? <div className="mt-5"><Notice tone="error">{loadError}</Notice></div> : null}
      {status === "ready" && approvedStructures.length === 0 ? (
        <div className="mt-5">
          <Notice tone="info">
            Approve a valid <Link className="font-medium underline" href="/app/salary-structures">Salary Structure</Link> before creating an assignment.
          </Notice>
        </div>
      ) : null}
      {success ? <div className="mt-5"><Notice tone="success">{success}</Notice></div> : null}
      {formError ? <div className="mt-5"><Notice tone="error">{formError}</Notice></div> : null}

      {formOpen ? (
        <form className="mt-6 rounded-lg border border-border bg-background p-5" onSubmit={submit}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-foreground">
                {editing ? "Edit Draft Assignment" : "New Draft Assignment"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">Gross Salary is transmitted as a Decimal string. Approval is a separate action.</p>
            </div>
            <Button disabled={isSaving} onClick={() => setFormOpen(false)} variant="ghost">
              <X aria-hidden="true" className="size-4" /> Close
            </Button>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field htmlFor="assignment-structure" label="Salary Structure" required>
              <Select
                {...fieldErrorProps("assignment-structure", fieldErrors.salaryStructureId)}
                id="assignment-structure"
                onChange={(event) => setForm({ ...form, salaryStructureId: event.target.value })}
                value={form.salaryStructureId}
              >
                <option value="">Select approved structure</option>
                {approvedStructures.map((structure) => (
                  <option key={structure.id} value={structure.id}>
                    {structure.code} v{structure.version} - {structure.name} (APPROVED)
                  </option>
                ))}
              </Select>
              <FieldError controlId="assignment-structure" message={fieldErrors.salaryStructureId} />
            </Field>
            <Field htmlFor="assignment-gross" label="Gross Salary (BDT)" required>
              <TextInput
                {...fieldErrorProps("assignment-gross", fieldErrors.grossSalary)}
                id="assignment-gross"
                inputMode="decimal"
                onChange={(event) => setForm({ ...form, grossSalary: event.target.value })}
                placeholder="100000.00"
                value={form.grossSalary}
              />
              <FieldError controlId="assignment-gross" message={fieldErrors.grossSalary} />
            </Field>
            <Field htmlFor="assignment-from" label="Effective From" required>
              <TextInput {...fieldErrorProps("assignment-from", fieldErrors.effectiveFrom)} id="assignment-from" onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} type="date" value={form.effectiveFrom} />
              <FieldError controlId="assignment-from" message={fieldErrors.effectiveFrom} />
            </Field>
            <Field htmlFor="assignment-to" label="Effective To (exclusive)" hint="The assignment stops applying on this date.">
              <TextInput {...fieldErrorProps("assignment-to", fieldErrors.effectiveTo)} id="assignment-to" onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })} type="date" value={form.effectiveTo} />
              <FieldError controlId="assignment-to" message={fieldErrors.effectiveTo} />
            </Field>
            <Field className="sm:col-span-2" htmlFor="assignment-reason" label="Change Reason" required={hasApprovedHistory}>
              <TextArea {...fieldErrorProps("assignment-reason", fieldErrors.changeReason)} id="assignment-reason" onChange={(event) => setForm({ ...form, changeReason: event.target.value })} placeholder={hasApprovedHistory ? "Required for a salary revision" : "Optional for the first assignment"} value={form.changeReason} />
              <FieldError controlId="assignment-reason" message={fieldErrors.changeReason} />
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button disabled={isSaving} type="submit">{isSaving ? "Saving..." : editing ? "Save Draft" : "Create Draft"}</Button>
            <Button disabled={isSaving} onClick={() => setFormOpen(false)} variant="secondary">Cancel</Button>
          </div>
        </form>
      ) : null}

      {status === "ready" ? (
        <div className="mt-6 overflow-x-auto">
          {assignments.length === 0 ? (
            <EmptyState title="No Salary Assignments" description="Create a draft assignment after an approved Salary Structure is available." />
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-3 pr-4 font-medium">Gross Salary</th><th className="py-3 pr-4 font-medium">Salary Structure</th><th className="py-3 pr-4 font-medium">Effective Period</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 pr-4 font-medium">Change Reason</th><th className="py-3 pr-4 font-medium">Approved</th><th className="py-3 font-medium">Actions</th>
              </tr></thead>
              <tbody>{assignments.map((row) => (
                <tr className="border-b border-border/80 align-top" key={row.id}>
                  <td className="py-3 pr-4 whitespace-nowrap font-medium tabular-nums">{formatBdt(row.grossSalary)}</td>
                  <td className="py-3 pr-4">{row.salaryStructure ? `${row.salaryStructure.code} v${row.salaryStructure.version} - ${row.salaryStructure.name}` : "-"}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{formatEffectivePeriod(row.effectiveFrom, row.effectiveTo)}</td>
                  <td className="py-3 pr-4">{salaryStatusBadge(row.status)}</td>
                  <td className="max-w-64 py-3 pr-4">{row.changeReason ?? "-"}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{formatSalaryDate(row.approvedAt)}</td>
                  <td className="py-3"><div className="flex flex-wrap gap-2">
                    {row.status === "DRAFT" ? <>
                      <Button className="h-9 px-3" onClick={() => openEdit(row)} variant="ghost"><Pencil aria-hidden="true" className="size-4" />Edit Draft</Button>
                      <Button className="h-9 px-3" disabled={!employeeActive} onClick={() => setApprovalTarget(row)} variant="secondary"><Check aria-hidden="true" className="size-4" />Approve</Button>
                    </> : <span className="text-xs text-muted-foreground">Historical - read only</span>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      ) : null}

      <ConfirmationDialog
        confirmLabel="Approve Assignment"
        description="You are about to approve this Salary Assignment. Approved records become historical and cannot be edited."
        onCancel={() => setApprovalTarget(null)}
        onConfirm={() => void approve()}
        open={Boolean(approvalTarget)}
        pending={isApproving}
        title="Approve Salary Assignment?"
      >
        {approvalTarget ? (
          <dl className="grid gap-3 rounded-md bg-secondary/60 p-4 sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Gross Salary</dt><dd className="font-medium tabular-nums">{formatBdt(approvalTarget.grossSalary)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Effective Period</dt><dd className="font-medium">{formatEffectivePeriod(approvalTarget.effectiveFrom, approvalTarget.effectiveTo)}</dd></div>
          </dl>
        ) : null}
      </ConfirmationDialog>
    </Card>
  );
}
