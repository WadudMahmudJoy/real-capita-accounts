"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Pencil, Plus, RefreshCw, X } from "lucide-react";
import {
  ApiError,
  approvePaymentProfile,
  createPaymentProfile,
  getPaymentProfiles,
  updatePaymentProfile,
  type EmployeePaymentProfile,
  type PaymentProfileInput,
} from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  LoadingPanel,
  Notice,
  TextArea,
  TextInput,
} from "./ui";
import {
  ConfirmationDialog,
  FieldError,
  dateInputValue,
  fieldErrorProps,
  formatEffectivePeriod,
  formatPercentage,
  formatSalaryDate,
  isPercentage,
  isStandardBankPercentage,
  isZeroDecimal,
  maskAccountNumber,
  nullableText,
  policyCashShare,
  salaryErrorMessage,
  salaryStatusBadge,
} from "./salary-ui";

type PaymentForm = {
  selectedBankPercentage: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchName: string;
  effectiveFrom: string;
  effectiveTo: string;
  changeReason: string;
};

const emptyForm: PaymentForm = {
  selectedBankPercentage: "60",
  bankName: "",
  accountName: "",
  accountNumber: "",
  branchName: "",
  effectiveFrom: "",
  effectiveTo: "",
  changeReason: "",
};

export function PaymentProfilePanel({
  employeeId,
  employeeActive,
}: {
  employeeId: string;
  employeeActive: boolean;
}) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<EmployeePaymentProfile[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeePaymentProfile | null>(null);
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<EmployeePaymentProfile | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setProfiles(await getPaymentProfiles(employeeId, signal));
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
        setProfiles(await getPaymentProfiles(employeeId, controller.signal));
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

  const hasApprovedHistory = profiles.some((profile) => profile.status === "APPROVED");
  const requiresBankDetails =
    isPercentage(form.selectedBankPercentage) && !isZeroDecimal(form.selectedBankPercentage);
  const requiresChangeReason =
    hasApprovedHistory ||
    (isPercentage(form.selectedBankPercentage) &&
      !isStandardBankPercentage(form.selectedBankPercentage));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFieldErrors({});
    setFormError(null);
    setSuccess(null);
    setFormOpen(true);
  }

  function openEdit(profile: EmployeePaymentProfile) {
    setEditing(profile);
    setForm({
      selectedBankPercentage: profile.selectedBankPercentage,
      bankName: profile.bankName ?? "",
      accountName: profile.accountName ?? "",
      accountNumber: profile.accountNumber ?? "",
      branchName: profile.branchName ?? "",
      effectiveFrom: dateInputValue(profile.effectiveFrom),
      effectiveTo: dateInputValue(profile.effectiveTo),
      changeReason: profile.changeReason ?? "",
    });
    setFieldErrors({});
    setFormError(null);
    setSuccess(null);
    setFormOpen(true);
  }

  function changeBankPercentage(value: string) {
    setForm((current) => ({ ...current, selectedBankPercentage: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      for (const key of ["selectedBankPercentage", "bankName", "accountName", "accountNumber", "changeReason"]) {
        delete next[key];
      }
      return next;
    });
  }

  function validate() {
    const errors: Record<string, string> = {};
    if (!isPercentage(form.selectedBankPercentage)) {
      errors.selectedBankPercentage = "Enter a percentage from 0 to 100 with at most six decimal places.";
    }
    if (requiresBankDetails) {
      if (!form.bankName.trim()) errors.bankName = "Bank Name is required above 0%.";
      if (!form.accountName.trim()) errors.accountName = "Account Name is required above 0%.";
      if (!form.accountNumber.trim()) errors.accountNumber = "Account Number is required above 0%.";
    }
    if (!form.effectiveFrom) errors.effectiveFrom = "Effective From is required.";
    if (form.effectiveTo && form.effectiveTo <= form.effectiveFrom) {
      errors.effectiveTo = "Effective To (exclusive) must be later than Effective From.";
    }
    if (requiresChangeReason && !form.changeReason.trim()) {
      errors.changeReason = hasApprovedHistory
        ? "Change Reason is required for a Payment Profile revision."
        : "Change Reason is required when Bank Percentage is not 60%.";
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

    const payload: PaymentProfileInput = {
      selectedBankPercentage: form.selectedBankPercentage.trim(),
      bankName: nullableText(form.bankName),
      accountName: nullableText(form.accountName),
      accountNumber: nullableText(form.accountNumber),
      branchName: nullableText(form.branchName),
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
      changeReason: nullableText(form.changeReason),
    };

    try {
      if (editing) {
        await updatePaymentProfile(editing.id, payload);
        setSuccess("Draft Payment Profile updated.");
      } else {
        await createPaymentProfile(employeeId, payload);
        setSuccess("Draft Payment Profile created.");
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
      await approvePaymentProfile(approvalTarget.id);
      setApprovalTarget(null);
      setSuccess("Payment Profile approved. The effective history was refreshed.");
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
        title="Employee Payment Profile"
        description="Configure the Gross-based Bank allocation and bank destination without creating a payment or payroll transaction."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void load()} variant="ghost"><RefreshCw aria-hidden="true" className="size-4" />Refresh</Button>
            <Button disabled={!employeeActive} onClick={openCreate}><Plus aria-hidden="true" className="size-4" />Create Payment Profile</Button>
          </div>
        }
      />

      <div className="mt-5"><Notice tone="info">Policy Cash Share = 100 - Bank Percentage. Actual Cash Pay is calculated after deductions as Net Pay minus Bank Pay.</Notice></div>
      {status === "loading" ? <div className="mt-5"><LoadingPanel message="Loading Payment Profiles..." /></div> : null}
      {status === "error" ? <div className="mt-5"><Notice tone="error">{loadError}</Notice></div> : null}
      {success ? <div className="mt-5"><Notice tone="success">{success}</Notice></div> : null}
      {formError ? <div className="mt-5"><Notice tone="error">{formError}</Notice></div> : null}

      {formOpen ? (
        <form className="mt-6 rounded-lg border border-border bg-background p-5" onSubmit={submit}>
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="font-semibold text-foreground">{editing ? "Edit Draft Payment Profile" : "New Draft Payment Profile"}</h3><p className="mt-1 text-sm text-muted-foreground">The percentage remains freely editable. Standard company allocation is 60%.</p></div>
            <Button disabled={isSaving} onClick={() => setFormOpen(false)} variant="ghost"><X aria-hidden="true" className="size-4" />Close</Button>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field htmlFor="profile-bank-percentage" label="Selected Bank Percentage" required hint={`Policy Cash Share: ${formatPercentage(policyCashShare(form.selectedBankPercentage))}`}>
              <TextInput {...fieldErrorProps("profile-bank-percentage", fieldErrors.selectedBankPercentage)} id="profile-bank-percentage" inputMode="decimal" onChange={(event) => changeBankPercentage(event.target.value)} value={form.selectedBankPercentage} />
              <FieldError controlId="profile-bank-percentage" message={fieldErrors.selectedBankPercentage} />
              <div className="flex flex-wrap gap-2">
                <Button className="h-8 px-3 text-xs" onClick={() => changeBankPercentage("0")} variant="ghost">All Cash - 0%</Button>
                <Button className="h-8 px-3 text-xs" onClick={() => changeBankPercentage("60")} variant="ghost">Standard - 60%</Button>
              </div>
            </Field>
            <Field htmlFor="profile-bank-name" label="Bank Name" required={requiresBankDetails}>
              <TextInput {...fieldErrorProps("profile-bank-name", fieldErrors.bankName)} id="profile-bank-name" onChange={(event) => setForm({ ...form, bankName: event.target.value })} value={form.bankName} />
              <FieldError controlId="profile-bank-name" message={fieldErrors.bankName} />
            </Field>
            <Field htmlFor="profile-account-name" label="Account Name" required={requiresBankDetails}>
              <TextInput {...fieldErrorProps("profile-account-name", fieldErrors.accountName)} autoComplete="off" id="profile-account-name" onChange={(event) => setForm({ ...form, accountName: event.target.value })} value={form.accountName} />
              <FieldError controlId="profile-account-name" message={fieldErrors.accountName} />
            </Field>
            <Field htmlFor="profile-account-number" label="Account Number" required={requiresBankDetails} hint="Shown masked outside this focused draft editor.">
              <TextInput {...fieldErrorProps("profile-account-number", fieldErrors.accountNumber)} autoComplete="off" id="profile-account-number" onChange={(event) => setForm({ ...form, accountNumber: event.target.value })} value={form.accountNumber} />
              <FieldError controlId="profile-account-number" message={fieldErrors.accountNumber} />
            </Field>
            <Field htmlFor="profile-branch" label="Branch Name">
              <TextInput id="profile-branch" onChange={(event) => setForm({ ...form, branchName: event.target.value })} value={form.branchName} />
            </Field>
            <Field htmlFor="profile-from" label="Effective From" required>
              <TextInput {...fieldErrorProps("profile-from", fieldErrors.effectiveFrom)} id="profile-from" onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} type="date" value={form.effectiveFrom} />
              <FieldError controlId="profile-from" message={fieldErrors.effectiveFrom} />
            </Field>
            <Field htmlFor="profile-to" label="Effective To (exclusive)" hint="The payment profile stops applying on this date.">
              <TextInput {...fieldErrorProps("profile-to", fieldErrors.effectiveTo)} id="profile-to" onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })} type="date" value={form.effectiveTo} />
              <FieldError controlId="profile-to" message={fieldErrors.effectiveTo} />
            </Field>
            <Field className="sm:col-span-2" htmlFor="profile-reason" label="Change Reason" required={requiresChangeReason}>
              <TextArea {...fieldErrorProps("profile-reason", fieldErrors.changeReason)} id="profile-reason" onChange={(event) => setForm({ ...form, changeReason: event.target.value })} placeholder={requiresChangeReason ? "Required for a revision or non-standard percentage" : "Optional for the initial 60% profile"} value={form.changeReason} />
              <FieldError controlId="profile-reason" message={fieldErrors.changeReason} />
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap gap-3"><Button disabled={isSaving} type="submit">{isSaving ? "Saving..." : editing ? "Save Draft" : "Create Draft"}</Button><Button disabled={isSaving} onClick={() => setFormOpen(false)} variant="secondary">Cancel</Button></div>
        </form>
      ) : null}

      {status === "ready" ? (
        <div className="mt-6 overflow-x-auto">
          {profiles.length === 0 ? (
            <EmptyState title="No Payment Profiles" description="Create the first effective-dated Bank allocation profile for this employee." />
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-3 pr-4 font-medium">Bank / Policy Cash</th><th className="py-3 pr-4 font-medium">Bank Details</th><th className="py-3 pr-4 font-medium">Effective Period</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 pr-4 font-medium">Change Reason</th><th className="py-3 pr-4 font-medium">Approved</th><th className="py-3 font-medium">Actions</th>
              </tr></thead>
              <tbody>{profiles.map((profile) => (
                <tr className="border-b border-border/80 align-top" key={profile.id}>
                  <td className="py-3 pr-4 whitespace-nowrap"><div className="font-medium">Bank {formatPercentage(profile.selectedBankPercentage)}</div><div className="text-xs text-muted-foreground">Policy Cash Share {formatPercentage(profile.policyCashShare ?? policyCashShare(profile.selectedBankPercentage))}</div></td>
                  <td className="max-w-64 py-3 pr-4"><div>{profile.bankName ?? "No bank - all cash policy"}</div>{profile.accountName ? <div className="text-xs text-muted-foreground">{profile.accountName} - {maskAccountNumber(profile.accountNumber)}</div> : null}<div className="text-xs text-muted-foreground">{profile.branchName ?? "-"}</div></td>
                  <td className="py-3 pr-4 whitespace-nowrap">{formatEffectivePeriod(profile.effectiveFrom, profile.effectiveTo)}</td>
                  <td className="py-3 pr-4">{salaryStatusBadge(profile.status)}</td>
                  <td className="max-w-64 py-3 pr-4">{profile.changeReason ?? "-"}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{formatSalaryDate(profile.approvedAt)}</td>
                  <td className="py-3"><div className="flex flex-wrap gap-2">{profile.status === "DRAFT" ? <><Button className="h-9 px-3" onClick={() => openEdit(profile)} variant="ghost"><Pencil aria-hidden="true" className="size-4" />Edit Draft</Button><Button className="h-9 px-3" disabled={!employeeActive} onClick={() => setApprovalTarget(profile)} variant="secondary"><Check aria-hidden="true" className="size-4" />Approve</Button></> : <span className="text-xs text-muted-foreground">Historical - read only</span>}</div></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      ) : null}

      <ConfirmationDialog
        confirmLabel="Approve Payment Profile"
        description="You are about to approve this Payment Profile. Approved records become historical and cannot be edited."
        onCancel={() => setApprovalTarget(null)}
        onConfirm={() => void approve()}
        open={Boolean(approvalTarget)}
        pending={isApproving}
        title="Approve Payment Profile?"
      >
        {approvalTarget ? <dl className="grid gap-3 rounded-md bg-secondary/60 p-4 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Bank Percentage</dt><dd className="font-medium">{formatPercentage(approvalTarget.selectedBankPercentage)}</dd></div><div><dt className="text-xs text-muted-foreground">Policy Cash Share</dt><dd className="font-medium">{formatPercentage(approvalTarget.policyCashShare ?? policyCashShare(approvalTarget.selectedBankPercentage))}</dd></div><div><dt className="text-xs text-muted-foreground">Bank Account</dt><dd className="font-medium">{maskAccountNumber(approvalTarget.accountNumber)}</dd></div><div><dt className="text-xs text-muted-foreground">Effective Period</dt><dd className="font-medium">{formatEffectivePeriod(approvalTarget.effectiveFrom, approvalTarget.effectiveTo)}</dd></div></dl> : null}
      </ConfirmationDialog>
    </Card>
  );
}
