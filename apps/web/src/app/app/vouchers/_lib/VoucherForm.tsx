"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  ApiError,
  createVoucher,
  deleteVoucher,
  toErrorMessage,
  updateVoucher,
  type AccountingPeriod,
  type CashBankAccount,
  type CostCenter,
  type CreateVoucherInput,
  type CreateVoucherLineInput,
  type FiscalYear,
  type LedgerAccount,
  type Project,
  type UpdateVoucherInput,
  type Voucher,
  type VoucherLineSide,
  type VoucherType,
} from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Notice,
  PageIntro,
  Select,
  StatusBadge,
  TextArea,
  TextInput,
} from "../../_components/ui";
import { cn } from "@/lib/utils";
import {
  VOUCHER_TYPE_OPTIONS,
  cashBankLabel,
  costCenterLabel,
  fiscalYearLabel,
  formatDate,
  formatMoney,
  ledgerAccountLabel,
  projectLabel,
  roundMoney,
  toAmount,
  voucherStatusBadge,
} from "./voucher-ui";

// Each editor line carries amount as a free-text string so the input can be
// edited naturally; it is parsed to a number only when building the payload.
type LineState = {
  key: string;
  side: VoucherLineSide;
  ledgerAccountId: string;
  projectId: string;
  costCenterId: string;
  cashBankAccountId: string;
  description: string;
  amount: string;
};

export type VoucherFormReferenceData = {
  fiscalYears: FiscalYear[];
  periods: AccountingPeriod[];
  ledgerAccounts: LedgerAccount[];
  projects: Project[];
  costCenters: CostCenter[];
  cashBankAccounts: CashBankAccount[];
};

type VoucherFormProps = {
  mode: "create" | "edit";
  reference: VoucherFormReferenceData;
  voucher?: Voucher;
};

let lineCounter = 0;

function nextLineKey(): string {
  lineCounter += 1;
  return `line-${lineCounter}`;
}

function emptyLine(side: VoucherLineSide): LineState {
  return {
    amount: "",
    cashBankAccountId: "",
    costCenterId: "",
    description: "",
    key: nextLineKey(),
    ledgerAccountId: "",
    projectId: "",
    side,
  };
}

function lineFromVoucher(line: NonNullable<Voucher["lines"]>[number]): LineState {
  return {
    amount: toAmount(line.amount).toString(),
    cashBankAccountId: line.cashBankAccountId ?? "",
    costCenterId: line.costCenterId ?? "",
    description: line.description ?? "",
    key: nextLineKey(),
    ledgerAccountId: line.ledgerAccountId,
    projectId: line.projectId ?? "",
    side: line.side,
  };
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function VoucherForm({ mode, reference, voucher }: VoucherFormProps) {
  const router = useRouter();
  const isReadOnly = voucher?.status === "POSTED";

  const [voucherType, setVoucherType] = useState<VoucherType>(
    voucher?.voucherType ?? "PAYMENT",
  );
  const [fiscalYearId, setFiscalYearId] = useState(voucher?.fiscalYearId ?? "");
  const [accountingPeriodId, setAccountingPeriodId] = useState(
    voucher?.accountingPeriodId ?? "",
  );
  const [voucherDate, setVoucherDate] = useState(
    formatDate(voucher?.voucherDate) === "-"
      ? ""
      : formatDate(voucher?.voucherDate),
  );
  const [physicalSiNo, setPhysicalSiNo] = useState(voucher?.physicalSiNo ?? "");
  const [narration, setNarration] = useState(voucher?.narration ?? "");
  const [lines, setLines] = useState<LineState[]>(() => {
    if (voucher?.lines && voucher.lines.length > 0) {
      return voucher.lines.map(lineFromVoucher);
    }

    return [emptyLine("DEBIT"), emptyLine("CREDIT")];
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Periods are constrained to the selected fiscal year so an invalid pairing
  // is never submitted; the backend rejects mismatches too.
  const periodsForYear = useMemo(() => {
    if (!fiscalYearId) {
      return reference.periods;
    }

    return reference.periods.filter(
      (period) => period.fiscalYearId === fiscalYearId,
    );
  }, [reference.periods, fiscalYearId]);

  // Only active references are selectable for new entries. When editing, a
  // previously chosen reference that is now inactive is still shown so the
  // existing line value is not silently dropped.
  const activeLedgerAccounts = useMemo(
    () => reference.ledgerAccounts.filter((account) => account.isActive),
    [reference.ledgerAccounts],
  );
  const activeProjects = useMemo(
    () => reference.projects.filter((project) => project.isActive),
    [reference.projects],
  );
  const activeCostCenters = useMemo(
    () => reference.costCenters.filter((center) => center.isActive),
    [reference.costCenters],
  );
  const activeCashBankAccounts = useMemo(
    () => reference.cashBankAccounts.filter((account) => account.isActive),
    [reference.cashBankAccounts],
  );

  const ledgerById = useMemo(
    () => new Map(reference.ledgerAccounts.map((account) => [account.id, account])),
    [reference.ledgerAccounts],
  );

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;

    for (const line of lines) {
      const amount = toAmount(line.amount);

      if (amount <= 0) {
        continue;
      }

      if (line.side === "DEBIT") {
        debit += amount;
      } else {
        credit += amount;
      }
    }

    debit = roundMoney(debit);
    credit = roundMoney(credit);

    return { credit, debit, difference: roundMoney(debit - credit) };
  }, [lines]);

  const isBalanced = totals.difference === 0 && totals.debit > 0;

  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((previous) =>
      previous.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((previous) => [...previous, emptyLine("DEBIT")]);
  }

  function removeLine(key: string) {
    setLines((previous) =>
      previous.length <= 2
        ? previous
        : previous.filter((line) => line.key !== key),
    );
  }

  function buildLines(): CreateVoucherLineInput[] | { error: string } {
    const built: CreateVoucherLineInput[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const label = `Line ${index + 1}`;

      if (!line.ledgerAccountId) {
        return { error: `${label}: select a ledger account.` };
      }

      const amount = toAmount(line.amount);

      if (!(amount > 0)) {
        return { error: `${label}: amount must be greater than zero.` };
      }

      // Guard against more than two decimal places before the backend does.
      if (Math.round(amount * 100) !== amount * 100) {
        return { error: `${label}: amount may have at most two decimals.` };
      }

      built.push({
        amount,
        side: line.side,
        ledgerAccountId: line.ledgerAccountId,
        ...(optional(line.projectId) ? { projectId: line.projectId } : {}),
        ...(optional(line.costCenterId)
          ? { costCenterId: line.costCenterId }
          : {}),
        ...(optional(line.cashBankAccountId)
          ? { cashBankAccountId: line.cashBankAccountId }
          : {}),
        ...(optional(line.description)
          ? { description: line.description.trim() }
          : {}),
      });
    }

    return built;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isReadOnly) {
      return;
    }

    setFormError(null);
    setFormSuccess(null);

    if (!fiscalYearId) {
      setFormError("Select a fiscal year.");
      return;
    }

    if (!accountingPeriodId) {
      setFormError("Select an accounting period.");
      return;
    }

    if (!voucherDate) {
      setFormError("Select a voucher date.");
      return;
    }

    if (narration.trim().length === 0) {
      setFormError("Narration is required.");
      return;
    }

    if (lines.length < 2) {
      setFormError("A voucher must have at least two lines.");
      return;
    }

    const builtLines = buildLines();

    if ("error" in builtLines) {
      setFormError(builtLines.error);
      return;
    }

    setIsSaving(true);

    try {
      if (mode === "edit" && voucher) {
        const payload: UpdateVoucherInput = {
          accountingPeriodId,
          fiscalYearId,
          lines: builtLines,
          narration: narration.trim(),
          physicalSiNo: optional(physicalSiNo),
          voucherDate,
          voucherType,
        };

        await updateVoucher(voucher.id, payload);
        setFormSuccess("Draft voucher saved.");
        router.refresh();
      } else {
        const payload: CreateVoucherInput = {
          accountingPeriodId,
          fiscalYearId,
          lines: builtLines,
          narration: narration.trim(),
          physicalSiNo: optional(physicalSiNo),
          voucherDate,
          voucherType,
        };

        const created = await createVoucher(payload);
        router.push(`/app/vouchers/${created.id}`);
        router.refresh();
        return;
      }
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

  async function handleDelete() {
    if (!voucher || isReadOnly) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this draft voucher? The voucher number stays reserved and is not reused.",
    );

    if (!confirmed) {
      return;
    }

    setFormError(null);
    setFormSuccess(null);
    setIsDeleting(true);

    try {
      await deleteVoucher(voucher.id);
      router.push("/app/vouchers");
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }

      setFormError(toErrorMessage(caught));
      setIsDeleting(false);
    }
  }

  const pageTitle =
    mode === "create"
      ? "New voucher"
      : isReadOnly
        ? `Voucher ${voucher?.systemVoucherNo ?? ""}`
        : `Edit voucher ${voucher?.systemVoucherNo ?? ""}`;

  const pageDescription = isReadOnly
    ? "This voucher is posted and shown read-only. Posted vouchers cannot be edited."
    : "Enter the voucher header, then add balanced debit and credit lines. Drafts may be saved unbalanced.";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          href="/app/vouchers"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to vouchers
        </Link>
        <PageIntro description={pageDescription} title={pageTitle} />
      </div>

      {isReadOnly ? (
        <Notice tone="info">
          This voucher has status POSTED. Posting, editing, and printing are not
          part of this screen.
        </Notice>
      ) : null}

      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <Card>
          <CardHeader
            actions={
              voucher ? voucherStatusBadge(voucher.status) : undefined
            }
            description="Header details apply to the whole voucher."
            title="Voucher header"
          />

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {voucher ? (
              <Field htmlFor="voucher-number" label="System voucher no.">
                <TextInput
                  disabled
                  id="voucher-number"
                  readOnly
                  value={voucher.systemVoucherNo}
                />
              </Field>
            ) : (
              <div className="flex flex-col justify-end">
                <p className="text-xs leading-5 text-muted-foreground">
                  A system voucher number is generated automatically when the
                  draft is created.
                </p>
              </div>
            )}

            <Field htmlFor="voucher-type" label="Voucher type" required>
              <Select
                disabled={isReadOnly}
                id="voucher-type"
                onChange={(event) =>
                  setVoucherType(event.target.value as VoucherType)
                }
                value={voucherType}
              >
                {VOUCHER_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field htmlFor="voucher-fiscal-year" label="Fiscal year" required>
              <Select
                disabled={isReadOnly}
                id="voucher-fiscal-year"
                onChange={(event) => {
                  setFiscalYearId(event.target.value);
                  // Reset the period when the year changes to avoid an invalid
                  // year/period pairing.
                  setAccountingPeriodId("");
                }}
                value={fiscalYearId}
              >
                <option value="">Select fiscal year</option>
                {reference.fiscalYears.map((fiscalYear) => (
                  <option key={fiscalYear.id} value={fiscalYear.id}>
                    {fiscalYearLabel(fiscalYear)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              htmlFor="voucher-period"
              label="Accounting period"
              required
            >
              <Select
                disabled={isReadOnly || !fiscalYearId}
                id="voucher-period"
                onChange={(event) =>
                  setAccountingPeriodId(event.target.value)
                }
                value={accountingPeriodId}
              >
                <option value="">
                  {fiscalYearId
                    ? "Select accounting period"
                    : "Select a fiscal year first"}
                </option>
                {periodsForYear.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name} ({formatDate(period.startDate)} to{" "}
                    {formatDate(period.endDate)}) - {period.status}
                  </option>
                ))}
              </Select>
            </Field>

            <Field htmlFor="voucher-date" label="Voucher date" required>
              <TextInput
                disabled={isReadOnly}
                id="voucher-date"
                onChange={(event) => setVoucherDate(event.target.value)}
                type="date"
                value={voucherDate}
              />
            </Field>

            <Field
              hint="Optional physical / SI reference number."
              htmlFor="voucher-physical-si"
              label="Physical SI no."
            >
              <TextInput
                disabled={isReadOnly}
                id="voucher-physical-si"
                onChange={(event) => setPhysicalSiNo(event.target.value)}
                placeholder="Optional"
                value={physicalSiNo}
              />
            </Field>

            <Field
              className="sm:col-span-2"
              htmlFor="voucher-narration"
              label="Narration"
              required
            >
              <TextArea
                disabled={isReadOnly}
                id="voucher-narration"
                onChange={(event) => setNarration(event.target.value)}
                placeholder="Describe the purpose of this voucher"
                value={narration}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            actions={
              isReadOnly ? undefined : (
                <Button onClick={addLine} variant="secondary">
                  <Plus aria-hidden="true" className="size-4" />
                  Add line
                </Button>
              )
            }
            description="Each line is either a debit or a credit against a ledger account."
            title="Voucher lines"
          />

          <div className="mt-4 flex flex-col gap-4">
            {lines.map((line, index) => {
              const ledger = line.ledgerAccountId
                ? ledgerById.get(line.ledgerAccountId)
                : undefined;
              const showCashBank = ledger?.isCashBank ?? false;

              return (
                <div
                  className="rounded-md border border-border bg-secondary/30 p-4"
                  key={line.key}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusBadge tone="neutral">
                        Line {index + 1}
                      </StatusBadge>
                      {ledger?.requiresProject ? (
                        <span className="text-xs text-muted-foreground">
                          Project recommended
                        </span>
                      ) : null}
                      {ledger?.requiresCostCenter ? (
                        <span className="text-xs text-muted-foreground">
                          Cost center recommended
                        </span>
                      ) : null}
                    </div>
                    {!isReadOnly && lines.length > 2 ? (
                      <Button
                        onClick={() => removeLine(line.key)}
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                        Remove
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field htmlFor={`${line.key}-side`} label="Side" required>
                      <Select
                        disabled={isReadOnly}
                        id={`${line.key}-side`}
                        onChange={(event) =>
                          updateLine(line.key, {
                            side: event.target.value as VoucherLineSide,
                          })
                        }
                        value={line.side}
                      >
                        <option value="DEBIT">Debit</option>
                        <option value="CREDIT">Credit</option>
                      </Select>
                    </Field>

                    <Field
                      htmlFor={`${line.key}-amount`}
                      label="Amount"
                      required
                    >
                      <TextInput
                        disabled={isReadOnly}
                        id={`${line.key}-amount`}
                        inputMode="decimal"
                        min="0"
                        onChange={(event) =>
                          updateLine(line.key, { amount: event.target.value })
                        }
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                        value={line.amount}
                      />
                    </Field>

                    <Field
                      className="lg:col-span-2"
                      htmlFor={`${line.key}-ledger`}
                      label="Ledger account"
                      required
                    >
                      <Select
                        disabled={isReadOnly}
                        id={`${line.key}-ledger`}
                        onChange={(event) =>
                          updateLine(line.key, {
                            ledgerAccountId: event.target.value,
                            // Cash/bank selection only applies to cash/bank
                            // ledgers; clear it when the ledger changes.
                            cashBankAccountId: "",
                          })
                        }
                        value={line.ledgerAccountId}
                      >
                        <option value="">Select ledger account</option>
                        {activeLedgerAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {ledgerAccountLabel(account)}
                          </option>
                        ))}
                        {ledger && !ledger.isActive ? (
                          <option value={ledger.id}>
                            {ledgerAccountLabel(ledger)} (inactive)
                          </option>
                        ) : null}
                      </Select>
                    </Field>

                    <Field htmlFor={`${line.key}-project`} label="Project">
                      <Select
                        disabled={isReadOnly}
                        id={`${line.key}-project`}
                        onChange={(event) =>
                          updateLine(line.key, {
                            projectId: event.target.value,
                          })
                        }
                        value={line.projectId}
                      >
                        <option value="">None</option>
                        {activeProjects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {projectLabel(project)}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field
                      htmlFor={`${line.key}-cost-center`}
                      label="Cost center"
                    >
                      <Select
                        disabled={isReadOnly}
                        id={`${line.key}-cost-center`}
                        onChange={(event) =>
                          updateLine(line.key, {
                            costCenterId: event.target.value,
                          })
                        }
                        value={line.costCenterId}
                      >
                        <option value="">None</option>
                        {activeCostCenters.map((center) => (
                          <option key={center.id} value={center.id}>
                            {costCenterLabel(center)}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    {showCashBank ? (
                      <Field
                        htmlFor={`${line.key}-cash-bank`}
                        label="Cash/bank account"
                      >
                        <Select
                          disabled={isReadOnly}
                          id={`${line.key}-cash-bank`}
                          onChange={(event) =>
                            updateLine(line.key, {
                              cashBankAccountId: event.target.value,
                            })
                          }
                          value={line.cashBankAccountId}
                        >
                          <option value="">None</option>
                          {activeCashBankAccounts
                            .filter(
                              (account) =>
                                account.ledgerAccountId === line.ledgerAccountId,
                            )
                            .map((account) => (
                              <option key={account.id} value={account.id}>
                                {cashBankLabel(account)}
                              </option>
                            ))}
                        </Select>
                      </Field>
                    ) : null}

                    <Field
                      className={cn(showCashBank ? "" : "lg:col-span-2")}
                      htmlFor={`${line.key}-description`}
                      label="Description"
                    >
                      <TextInput
                        disabled={isReadOnly}
                        id={`${line.key}-description`}
                        onChange={(event) =>
                          updateLine(line.key, {
                            description: event.target.value,
                          })
                        }
                        placeholder="Optional line note"
                        value={line.description}
                      />
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-border bg-background px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total debit
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                {formatMoney(totals.debit)}
              </p>
            </div>
            <div className="rounded-md border border-border bg-background px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total credit
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                {formatMoney(totals.credit)}
              </p>
            </div>
            <div
              className={cn(
                "rounded-md border px-4 py-3",
                isBalanced
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50",
              )}
            >
              <p
                className={cn(
                  "text-xs font-medium uppercase tracking-wide",
                  isBalanced ? "text-emerald-700" : "text-amber-700",
                )}
              >
                Difference
              </p>
              <p
                className={cn(
                  "mt-1 text-lg font-semibold tabular-nums",
                  isBalanced ? "text-emerald-700" : "text-amber-700",
                )}
              >
                {formatMoney(totals.difference)}
              </p>
            </div>
          </div>

          {!isBalanced ? (
            <div className="mt-4">
              <Notice tone="info">
                Debit and credit totals do not match. You can still save this as
                a draft. Posting will require the debit and credit totals to be
                equal.
              </Notice>
            </div>
          ) : null}
        </Card>

        {formError ? <Notice tone="error">{formError}</Notice> : null}
        {formSuccess ? <Notice tone="success">{formSuccess}</Notice> : null}

        {!isReadOnly ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={isSaving} type="submit">
              {isSaving
                ? "Saving..."
                : mode === "create"
                  ? "Create draft voucher"
                  : "Save draft voucher"}
            </Button>
            {mode === "edit" && voucher ? (
              <Button
                disabled={isDeleting}
                onClick={handleDelete}
                variant="danger"
              >
                {isDeleting ? "Deleting..." : "Delete draft"}
              </Button>
            ) : null}
            <Link href="/app/vouchers">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
          </div>
        ) : (
          <div>
            <Link href="/app/vouchers">
              <Button type="button" variant="secondary">
                Back to vouchers
              </Button>
            </Link>
          </div>
        )}
      </form>
    </div>
  );
}
