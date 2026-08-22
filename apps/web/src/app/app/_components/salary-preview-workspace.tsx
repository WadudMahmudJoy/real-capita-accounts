"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Calculator, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  ApiError,
  getEmployees,
  getPaymentProfiles,
  getSalaryAssignments,
  getSalaryStructures,
  previewSalary,
  type Employee,
  type EmployeePaymentProfile,
  type EmployeeSalaryAssignment,
  type OtherApprovedDeductionInput,
  type SalaryPreviewInput,
  type SalaryPreviewResult,
  type SalaryStructure,
} from "@/lib/api";
import {
  FieldError,
  fieldErrorProps,
  formatBdt,
  formatPercentage,
  formatSalaryDate,
  isDecimalInput,
  isPercentage,
  isPositiveDecimal,
  isZeroDecimal,
  salaryErrorMessage,
} from "./salary-ui";
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
  TextInput,
} from "./ui";

type OtherDeductionForm = OtherApprovedDeductionInput & { key: number };

type PreviewForm = {
  employeeId: string;
  assignmentId: string;
  paymentProfileId: string;
  grossSalary: string;
  salaryStructureId: string;
  selectedBankPercentage: string;
  attendanceDeduction: string;
  providentFundDeduction: string;
  loanOrSalaryAdvanceDeduction: string;
  aitDeduction: string;
};

const emptyForm: PreviewForm = {
  employeeId: "",
  assignmentId: "",
  paymentProfileId: "",
  grossSalary: "",
  salaryStructureId: "",
  selectedBankPercentage: "60",
  attendanceDeduction: "0.00",
  providentFundDeduction: "0.00",
  loanOrSalaryAdvanceDeduction: "0.00",
  aitDeduction: "0.00",
};

let deductionKey = 1;

export function SalaryPreviewWorkspace() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [assignments, setAssignments] = useState<EmployeeSalaryAssignment[]>([]);
  const [profiles, setProfiles] = useState<EmployeePaymentProfile[]>([]);
  const [form, setForm] = useState<PreviewForm>(emptyForm);
  const [otherDeductions, setOtherDeductions] = useState<OtherDeductionForm[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [configStatus, setConfigStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [result, setResult] = useState<SalaryPreviewResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const loadReferences = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const [employeeRows, structureRows] = await Promise.all([
          getEmployees({ includeInactive: true }, signal),
          getSalaryStructures(signal),
        ]);
        setEmployees(employeeRows);
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
    [router],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function initialLoad() {
      try {
        const [employeeRows, structureRows] = await Promise.all([
          getEmployees({ includeInactive: true }, controller.signal),
          getSalaryStructures(controller.signal),
        ]);
        setEmployees(employeeRows);
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
  }, [router]);

  const approvedStructures = useMemo(
    () => structures.filter((structure) => structure.status === "APPROVED"),
    [structures],
  );
  const approvedAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          assignment.status === "APPROVED" &&
          assignment.salaryStructure?.status === "APPROVED",
      ),
    [assignments],
  );
  const approvedProfiles = useMemo(
    () => profiles.filter((profile) => profile.status === "APPROVED"),
    [profiles],
  );

  async function selectEmployee(employeeId: string) {
    setForm((current) => ({ ...current, employeeId, assignmentId: "", paymentProfileId: "" }));
    setAssignments([]);
    setProfiles([]);
    setConfigError(null);
    setResult(null);
    if (!employeeId) {
      setConfigStatus("idle");
      return;
    }
    setConfigStatus("loading");
    try {
      const [assignmentRows, profileRows] = await Promise.all([
        getSalaryAssignments(employeeId),
        getPaymentProfiles(employeeId),
      ]);
      setAssignments(assignmentRows);
      setProfiles(profileRows);
      const assignment = assignmentRows.find(
        (row) => row.status === "APPROVED" && row.salaryStructure?.status === "APPROVED",
      );
      const profile = profileRows.find((row) => row.status === "APPROVED");
      setForm((current) => ({
        ...current,
        employeeId,
        assignmentId: assignment?.id ?? "",
        grossSalary: assignment?.grossSalary ?? current.grossSalary,
        salaryStructureId: assignment?.salaryStructureId ?? current.salaryStructureId,
        paymentProfileId: profile?.id ?? "",
        selectedBankPercentage:
          profile?.selectedBankPercentage ?? current.selectedBankPercentage,
      }));
      setConfigStatus("ready");
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }
      setConfigError(salaryErrorMessage(caught));
      setConfigStatus("error");
    }
  }

  function selectAssignment(id: string) {
    const assignment = approvedAssignments.find((row) => row.id === id);
    setForm((current) => ({
      ...current,
      assignmentId: id,
      grossSalary: assignment?.grossSalary ?? current.grossSalary,
      salaryStructureId: assignment?.salaryStructureId ?? current.salaryStructureId,
    }));
    setResult(null);
  }

  function selectProfile(id: string) {
    const profile = approvedProfiles.find((row) => row.id === id);
    setForm((current) => ({
      ...current,
      paymentProfileId: id,
      selectedBankPercentage:
        profile?.selectedBankPercentage ?? current.selectedBankPercentage,
    }));
    setResult(null);
  }

  function validate() {
    const errors: Record<string, string> = {};
    if (!isPositiveDecimal(form.grossSalary, 2)) {
      errors.grossSalary = "Gross Salary must be greater than zero with at most two decimal places.";
    }
    if (!form.salaryStructureId) errors.salaryStructureId = "Select an approved Salary Structure.";
    if (!isPercentage(form.selectedBankPercentage, 40)) {
      errors.selectedBankPercentage = "Enter a percentage from 0 to 100 without scientific notation.";
    }
    const deductions: Array<[keyof PreviewForm, string]> = [
      ["attendanceDeduction", "Attendance Deduction"],
      ["providentFundDeduction", "PF / GPF / Pension Deduction"],
      ["loanOrSalaryAdvanceDeduction", "Loan / Salary Advance Deduction"],
      ["aitDeduction", "AIT Deduction"],
    ];
    deductions.forEach(([key, label]) => {
      if (!isDecimalInput(form[key], 2)) errors[key] = `${label} must be non-negative with at most two decimal places.`;
    });
    otherDeductions.forEach((item, index) => {
      if (!isDecimalInput(item.amount, 2)) errors[`other.${index}.amount`] = "Amount must be non-negative with at most two decimal places.";
      if (isDecimalInput(item.amount, 2) && !isZeroDecimal(item.amount) && !item.description.trim()) {
        errors[`other.${index}.description`] = "Description is required for a positive amount.";
      }
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCalculating || !validate()) return;
    setIsCalculating(true);
    setPreviewError(null);
    setResult(null);
    const payload: SalaryPreviewInput = {
      grossSalary: form.grossSalary.trim(),
      salaryStructureId: form.salaryStructureId,
      selectedBankPercentage: form.selectedBankPercentage.trim(),
      attendanceDeduction: form.attendanceDeduction.trim(),
      providentFundDeduction: form.providentFundDeduction.trim(),
      loanOrSalaryAdvanceDeduction: form.loanOrSalaryAdvanceDeduction.trim(),
      aitDeduction: form.aitDeduction.trim(),
      otherApprovedDeductions: otherDeductions.map(({ amount, description, approvalReference }) => ({
        amount: amount.trim(),
        description: description.trim(),
        ...(approvalReference?.trim()
          ? { approvalReference: approvalReference.trim() }
          : {}),
      })),
    };
    try {
      setResult(await previewSalary(payload));
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }
      setPreviewError(salaryErrorMessage(caught));
    } finally {
      setIsCalculating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="HR & Salary - Salary Preview" description="Preview Gross earnings, deductions, Net Pay, and Bank/Cash allocation through the verified backend calculator. Nothing on this page creates a payroll or accounting transaction." />
      {status === "loading" ? <LoadingPanel message="Loading Salary Preview references..." /> : null}
      {status === "error" ? <Card><Notice tone="error">{loadError}</Notice><Button className="mt-4" onClick={() => void loadReferences()} variant="secondary"><RefreshCw aria-hidden="true" className="size-4" />Retry</Button></Card> : null}

      {status === "ready" ? (
        <form className="flex flex-col gap-6" onSubmit={calculate}>
          <Card>
            <CardHeader title="Employee / Configuration" description="Choose an employee to load approved histories, or enter an approved Structure and Gross Salary manually." />
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field htmlFor="preview-employee" label="Employee (optional)">
                <Select id="preview-employee" onChange={(event) => void selectEmployee(event.target.value)} value={form.employeeId}>
                  <option value="">Manual Preview</option>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} - {employee.fullName}{employee.isActive ? "" : " (Inactive)"}</option>)}
                </Select>
              </Field>
              <Field htmlFor="preview-assignment" label="Approved Salary Assignment">
                <Select disabled={!form.employeeId || configStatus === "loading"} id="preview-assignment" onChange={(event) => selectAssignment(event.target.value)} value={form.assignmentId}>
                  <option value="">Select assignment or enter manually</option>
                  {approvedAssignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{formatBdt(assignment.grossSalary)} - {assignment.salaryStructure?.code} v{assignment.salaryStructure?.version} - from {formatSalaryDate(assignment.effectiveFrom)}</option>)}
                </Select>
              </Field>
              <Field htmlFor="preview-profile" label="Approved Payment Profile">
                <Select disabled={!form.employeeId || configStatus === "loading"} id="preview-profile" onChange={(event) => selectProfile(event.target.value)} value={form.paymentProfileId}>
                  <option value="">Select profile or enter manually</option>
                  {approvedProfiles.map((profile) => <option key={profile.id} value={profile.id}>Bank {formatPercentage(profile.selectedBankPercentage)} - from {formatSalaryDate(profile.effectiveFrom)}</option>)}
                </Select>
              </Field>
              <Field htmlFor="preview-structure" label="Salary Structure" required>
                <Select {...fieldErrorProps("preview-structure", fieldErrors.salaryStructureId)} id="preview-structure" onChange={(event) => setForm({ ...form, salaryStructureId: event.target.value, assignmentId: "" })} value={form.salaryStructureId}>
                  <option value="">Select approved structure</option>
                  {approvedStructures.map((structure) => <option key={structure.id} value={structure.id}>{structure.code} v{structure.version} - {structure.name}</option>)}
                </Select>
                <FieldError controlId="preview-structure" message={fieldErrors.salaryStructureId} />
              </Field>
              <Field htmlFor="preview-gross" label="Gross Salary (BDT)" required>
                <TextInput {...fieldErrorProps("preview-gross", fieldErrors.grossSalary)} id="preview-gross" inputMode="decimal" onChange={(event) => setForm({ ...form, grossSalary: event.target.value, assignmentId: "" })} placeholder="100000.00" value={form.grossSalary} />
                <FieldError controlId="preview-gross" message={fieldErrors.grossSalary} />
              </Field>
              <Field className="sm:col-span-2" htmlFor="preview-bank-percentage" label="Selected Bank Percentage" required hint="Preview only - this does not update the Employee Payment Profile. Calculation-only precision up to 40 decimal places is accepted by the backend.">
                <TextInput {...fieldErrorProps("preview-bank-percentage", fieldErrors.selectedBankPercentage)} id="preview-bank-percentage" inputMode="decimal" onChange={(event) => setForm({ ...form, selectedBankPercentage: event.target.value, paymentProfileId: "" })} value={form.selectedBankPercentage} />
                <FieldError controlId="preview-bank-percentage" message={fieldErrors.selectedBankPercentage} />
              </Field>
            </div>
            {configStatus === "loading" ? <div className="mt-5"><LoadingPanel message="Loading Employee Salary configuration..." /></div> : null}
            {configError ? <div className="mt-5"><Notice tone="error">{configError}</Notice></div> : null}
            {configStatus === "ready" && approvedAssignments.length === 0 ? <div className="mt-5"><Notice tone="info">This employee has no approved, previewable Salary Assignment. Manual inputs remain available.</Notice></div> : null}
          </Card>

          <Card>
            <CardHeader title="Deductions" description="All values default to zero and are sent as Decimal strings. The backend determines Total Deductions and Net Pay." />
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field htmlFor="preview-attendance" label="Attendance Deduction"><TextInput {...fieldErrorProps("preview-attendance", fieldErrors.attendanceDeduction)} id="preview-attendance" inputMode="decimal" onChange={(event) => setForm({ ...form, attendanceDeduction: event.target.value })} value={form.attendanceDeduction} /><FieldError controlId="preview-attendance" message={fieldErrors.attendanceDeduction} /></Field>
              <Field htmlFor="preview-pf" label="PF / GPF / Pension"><TextInput {...fieldErrorProps("preview-pf", fieldErrors.providentFundDeduction)} id="preview-pf" inputMode="decimal" onChange={(event) => setForm({ ...form, providentFundDeduction: event.target.value })} value={form.providentFundDeduction} /><FieldError controlId="preview-pf" message={fieldErrors.providentFundDeduction} /></Field>
              <Field htmlFor="preview-loan" label="Loan / Salary Advance"><TextInput {...fieldErrorProps("preview-loan", fieldErrors.loanOrSalaryAdvanceDeduction)} id="preview-loan" inputMode="decimal" onChange={(event) => setForm({ ...form, loanOrSalaryAdvanceDeduction: event.target.value })} value={form.loanOrSalaryAdvanceDeduction} /><FieldError controlId="preview-loan" message={fieldErrors.loanOrSalaryAdvanceDeduction} /></Field>
              <Field htmlFor="preview-ait" label="AIT Deduction"><TextInput {...fieldErrorProps("preview-ait", fieldErrors.aitDeduction)} id="preview-ait" inputMode="decimal" onChange={(event) => setForm({ ...form, aitDeduction: event.target.value })} value={form.aitDeduction} /><FieldError controlId="preview-ait" message={fieldErrors.aitDeduction} /></Field>
            </div>

            <div className="mt-7 flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-foreground">Other Approved Deductions</h3><p className="mt-1 text-sm text-muted-foreground">Add as many approved items as needed for this preview.</p></div><Button onClick={() => setOtherDeductions([...otherDeductions, { key: deductionKey++, description: "", amount: "0.00", approvalReference: "" }])} variant="secondary"><Plus aria-hidden="true" className="size-4" />Add Deduction</Button></div>
              {otherDeductions.length === 0 ? <EmptyState title="No Other Approved Deductions" description="Use Add Deduction when an approved item needs to be included in this calculation." /> : null}
              {otherDeductions.map((item, index) => (
                <div className="grid gap-4 rounded-md border border-border bg-background p-4 sm:grid-cols-[1.5fr_1fr_1fr_auto]" key={item.key}>
                  <Field htmlFor={`other-description-${item.key}`} label="Description" required={!isZeroDecimal(item.amount)}><TextInput {...fieldErrorProps(`other-description-${item.key}`, fieldErrors[`other.${index}.description`])} id={`other-description-${item.key}`} onChange={(event) => setOtherDeductions(otherDeductions.map((row) => row.key === item.key ? { ...row, description: event.target.value } : row))} value={item.description} /><FieldError controlId={`other-description-${item.key}`} message={fieldErrors[`other.${index}.description`]} /></Field>
                  <Field htmlFor={`other-amount-${item.key}`} label="Amount" required><TextInput {...fieldErrorProps(`other-amount-${item.key}`, fieldErrors[`other.${index}.amount`])} id={`other-amount-${item.key}`} inputMode="decimal" onChange={(event) => setOtherDeductions(otherDeductions.map((row) => row.key === item.key ? { ...row, amount: event.target.value } : row))} value={item.amount} /><FieldError controlId={`other-amount-${item.key}`} message={fieldErrors[`other.${index}.amount`]} /></Field>
                  <Field htmlFor={`other-reference-${item.key}`} label="Approval Reference"><TextInput id={`other-reference-${item.key}`} onChange={(event) => setOtherDeductions(otherDeductions.map((row) => row.key === item.key ? { ...row, approvalReference: event.target.value } : row))} value={item.approvalReference} /></Field>
                  <div className="flex items-end"><Button aria-label={`Remove Other Approved Deduction ${index + 1}`} onClick={() => setOtherDeductions(otherDeductions.filter((row) => row.key !== item.key))} variant="ghost"><Trash2 aria-hidden="true" className="size-4" /><span className="sm:sr-only">Remove</span></Button></div>
                </div>
              ))}
            </div>
          </Card>

          {previewError ? <Notice tone="error">{previewError}</Notice> : null}
          <div><Button disabled={isCalculating} type="submit"><Calculator aria-hidden="true" className="size-4" />{isCalculating ? "Calculating..." : "Calculate Salary Preview"}</Button></div>
        </form>
      ) : null}

      {result ? <PreviewResult result={result} /> : null}
    </div>
  );
}

function PreviewResult({ result }: { result: SalaryPreviewResult }) {
  const reconciled = isZeroDecimal(result.reconciliationDifference);
  return (
    <section aria-live="polite" className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Earnings" description={`Backend rounding policy: ${result.roundingPolicy}`} />
        <div className="mt-5 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="py-3 pr-4">Component</th><th className="py-3 pr-4">Percentage</th><th className="py-3 text-right">Amount</th></tr></thead><tbody>{result.earningComponents.map((component) => <tr className="border-b border-border/80" key={`${component.code}-${component.displayOrder}`}><td className="py-3 pr-4"><span className="font-medium">{component.name}</span><span className="ml-2 text-xs text-muted-foreground">{component.code}</span></td><td className="py-3 pr-4 tabular-nums">{formatPercentage(component.percentage)}</td><td className="py-3 text-right font-medium tabular-nums">{formatBdt(component.amount)}</td></tr>)}</tbody><tfoot><tr className="border-t-2 border-border font-semibold"><td className="py-4" colSpan={2}>Gross Salary / Total Earnings</td><td className="py-4 text-right tabular-nums">{formatBdt(result.totalEarnings)}</td></tr></tfoot></table></div>
      </Card>

      <Card>
        <CardHeader title="Deductions" description="Category values and Other Approved Deductions returned by the backend." />
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><ResultLine label="Attendance Deduction" value={result.attendanceDeduction} /><ResultLine label="PF / GPF / Pension" value={result.providentFundDeduction} /><ResultLine label="Loan / Salary Advance" value={result.loanOrSalaryAdvanceDeduction} /><ResultLine label="AIT Deduction" value={result.aitDeduction} />{result.otherApprovedDeductions.map((item, index) => <ResultLine key={`${item.description}-${index}`} label={`${item.description}${item.approvalReference ? ` (${item.approvalReference})` : ""}`} value={item.amount} />)}</div>
        <div className="mt-5 flex items-center justify-between border-t border-border pt-4 font-semibold"><span>Total Deductions</span><span className="tabular-nums">{formatBdt(result.totalDeductions)}</span></div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-primary/30 bg-accent/50"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Net Salary</p><p className="mt-3 text-3xl font-semibold tracking-tight text-heading tabular-nums">{formatBdt(result.netPay)}</p><p className="mt-2 text-sm text-muted-foreground">Total Earnings minus Total Deductions.</p></Card>
        <Card>
          <CardHeader title="Payment Allocation" description="Bank Pay is calculated from Gross Salary. Cash Pay is the remaining Net Pay after Bank Pay." />
          <dl className="mt-5 grid gap-4 sm:grid-cols-2"><AllocationLine label="Selected Bank Percentage" value={formatPercentage(result.selectedBankPercentage)} /><AllocationLine label="Policy Cash Share" value={formatPercentage(result.policyCashShare)} /><AllocationLine label="Maximum Allowed Bank Percentage" value={formatPercentage(result.maximumAllowedBankPercentage, true)} precision /><AllocationLine label="Bank Pay" value={formatBdt(result.bankPay)} /><AllocationLine label="Cash Pay" value={formatBdt(result.cashPay)} /></dl>
          <div className={`mt-5 rounded-md border px-4 py-3 text-sm font-medium ${reconciled ? "border-success-border bg-success-surface text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}`} role="status">Bank Pay + Cash Pay = Net Pay · {reconciled ? "Reconciled" : `Difference ${formatBdt(result.reconciliationDifference)}`}</div>
        </Card>
      </div>
      {result.warnings.length ? <Notice tone="info">{result.warnings.join(" ")}</Notice> : null}
    </section>
  );
}

function ResultLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 rounded-md bg-secondary/50 px-3 py-2"><span>{label}</span><span className="whitespace-nowrap tabular-nums">{formatBdt(value)}</span></div>;
}

function AllocationLine({ label, value, precision = false }: { label: string; value: string; precision?: boolean }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className={`mt-1 text-sm font-semibold text-foreground ${precision ? "break-all font-mono text-xs" : "tabular-nums"}`}>{value}</dd></div>;
}
