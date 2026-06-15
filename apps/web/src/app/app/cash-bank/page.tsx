"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  ApiError,
  createCashBankAccount,
  getCashBankAccounts,
  getLedgerAccounts,
  toErrorMessage,
  updateCashBankAccount,
  type CashBankAccount,
  type CashBankAccountInput,
  type CashBankAccountType,
  type LedgerAccount,
  type MfsProvider,
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
  Select,
  StatusBadge,
  TextInput,
} from "../_components/ui";

type FormState = {
  id: string | null;
  ledgerAccountId: string;
  displayName: string;
  accountType: CashBankAccountType;
  bankName: string;
  branch: string;
  accountNumber: string;
  provider: MfsProvider | "";
  providerOtherName: string;
  walletNumber: string;
  accountHolderName: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  accountHolderName: "",
  accountNumber: "",
  accountType: "CASH",
  bankName: "",
  branch: "",
  displayName: "",
  id: null,
  isActive: true,
  ledgerAccountId: "",
  provider: "",
  providerOtherName: "",
  walletNumber: "",
};

const accountTypeLabels: Record<CashBankAccountType, string> = {
  BANK: "Bank",
  CASH: "Cash",
  MFS: "MFS / Mobile Wallet",
};

const mfsProviderOptions: { value: MfsProvider; label: string }[] = [
  { label: "bKash", value: "BKASH" },
  { label: "Nagad", value: "NAGAD" },
  { label: "Rocket", value: "ROCKET" },
  { label: "Upay", value: "UPAY" },
  { label: "Other", value: "OTHER" },
];

const mfsProviderLabels: Record<MfsProvider, string> = {
  BKASH: "bKash",
  NAGAD: "Nagad",
  OTHER: "Other",
  ROCKET: "Rocket",
  UPAY: "Upay",
};

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function ledgerLabel(account: LedgerAccount): string {
  return `${account.code} - ${account.name}`;
}

function linkedLedgerLabel(cashBankAccount: CashBankAccount): string {
  const ledgerAccount = cashBankAccount.ledgerAccount;

  if (!ledgerAccount) {
    return "Ledger account not loaded";
  }

  return ledgerLabel(ledgerAccount);
}

/** Human-readable provider name, using the custom name for the OTHER provider. */
function providerLabel(account: CashBankAccount): string {
  if (!account.provider) {
    return "-";
  }

  if (account.provider === "OTHER") {
    return account.providerOtherName?.trim()
      ? account.providerOtherName
      : "Other";
  }

  return mfsProviderLabels[account.provider];
}

export default function CashBankPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cashBankAccounts, setCashBankAccounts] = useState<CashBankAccount[]>(
    [],
  );
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [cashBankData, ledgerData] = await Promise.all([
          getCashBankAccounts(controller.signal),
          getLedgerAccounts(controller.signal),
        ]);

        setCashBankAccounts(cashBankData);
        setLedgerAccounts(ledgerData);
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

  const cashBankLedgerAccounts = useMemo(
    () => ledgerAccounts.filter((account) => account.isCashBank),
    [ledgerAccounts],
  );

  async function reloadCashBankAccounts() {
    try {
      setCashBankAccounts(await getCashBankAccounts());
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

  function startEdit(account: CashBankAccount) {
    setForm({
      accountHolderName: account.accountHolderName ?? "",
      accountNumber: account.accountNumber ?? "",
      accountType: account.accountType,
      bankName: account.bankName ?? "",
      branch: account.branch ?? "",
      displayName: account.displayName,
      id: account.id,
      isActive: account.isActive,
      ledgerAccountId: account.ledgerAccountId,
      provider: account.provider ?? "",
      providerOtherName: account.providerOtherName ?? "",
      walletNumber: account.walletNumber ?? "",
    });
    setFormError(null);
    setFormSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const displayName = form.displayName.trim();
    if (!form.ledgerAccountId || !displayName) {
      setFormError("Ledger account and display name are required.");
      return;
    }

    if (
      !cashBankLedgerAccounts.some(
        (account) => account.id === form.ledgerAccountId,
      )
    ) {
      setFormError("Select a ledger account marked as Cash/Bank.");
      return;
    }

    const isMfs = form.accountType === "MFS";
    let payload: CashBankAccountInput;

    if (isMfs) {
      if (!form.provider) {
        setFormError("Select an MFS provider.");
        return;
      }

      const walletNumber = optional(form.walletNumber);
      if (!walletNumber) {
        setFormError("Wallet number / account ID is required for MFS accounts.");
        return;
      }

      const providerOtherName = optional(form.providerOtherName);
      if (form.provider === "OTHER" && !providerOtherName) {
        setFormError(
          "Enter the provider name when the MFS provider is set to Other.",
        );
        return;
      }

      payload = {
        accountHolderName: optional(form.accountHolderName) ?? null,
        accountType: "MFS",
        displayName,
        isActive: form.isActive,
        ledgerAccountId: form.ledgerAccountId,
        provider: form.provider,
        providerOtherName:
          form.provider === "OTHER" ? providerOtherName : null,
        walletNumber,
      };
    } else {
      payload = {
        accountNumber: optional(form.accountNumber),
        accountType: form.accountType,
        bankName: optional(form.bankName),
        branch: optional(form.branch),
        displayName,
        isActive: form.isActive,
        ledgerAccountId: form.ledgerAccountId,
      };
    }

    setIsSaving(true);

    try {
      if (form.id) {
        await updateCashBankAccount(form.id, payload);
        setFormSuccess("Cash/bank/MFS account updated.");
      } else {
        await createCashBankAccount(payload);
        setFormSuccess("Cash/bank/MFS account created.");
      }

      setForm(emptyForm);
      await reloadCashBankAccounts();
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
  const hasCashBankLedgerAccounts = cashBankLedgerAccounts.length > 0;
  const isMfs = form.accountType === "MFS";

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        description="Define cash, bank, and MFS / mobile wallet accounts by linking them to ledger accounts marked as Cash/Bank. No cash book or reconciliation is included yet."
        title="Cash, Bank & MFS"
      />

      {status === "loading" ? (
        <LoadingPanel message="Loading cash, bank and MFS accounts..." />
      ) : null}

      {status === "error" ? (
        <Notice tone="error">{loadError}</Notice>
      ) : null}

      {status === "ready" ? (
        <>
          {!hasCashBankLedgerAccounts ? (
            <Notice tone="info">
              Create a{" "}
              <Link className="font-medium underline" href="/app/accounts/ledger">
                Ledger Account
              </Link>{" "}
              with Cash/Bank enabled before adding cash, bank, or MFS account
              details.
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
                  ? "Update the selected cash, bank, or MFS account."
                  : "Add cash, bank, or MFS account details for an eligible ledger account."
              }
              title={
                isEditing
                  ? "Edit cash/bank/MFS account"
                  : "New cash/bank/MFS account"
              }
            />

            <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  className="sm:col-span-2"
                  htmlFor="cash-bank-ledger"
                  label="Linked ledger account"
                  required
                >
                  <Select
                    disabled={!hasCashBankLedgerAccounts}
                    id="cash-bank-ledger"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        ledgerAccountId: event.target.value,
                      }))
                    }
                    required
                    value={form.ledgerAccountId}
                  >
                    <option value="">Select cash/bank ledger account</option>
                    {cashBankLedgerAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {ledgerLabel(account)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field htmlFor="cash-bank-name" label="Display name" required>
                  <TextInput
                    disabled={!hasCashBankLedgerAccounts}
                    id="cash-bank-name"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        displayName: event.target.value,
                      }))
                    }
                    placeholder="Main cash"
                    required
                    value={form.displayName}
                  />
                </Field>

                <Field htmlFor="cash-bank-type" label="Account type" required>
                  <Select
                    disabled={!hasCashBankLedgerAccounts}
                    id="cash-bank-type"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        accountType: event.target.value as CashBankAccountType,
                      }))
                    }
                    value={form.accountType}
                  >
                    <option value="CASH">{accountTypeLabels.CASH}</option>
                    <option value="BANK">{accountTypeLabels.BANK}</option>
                    <option value="MFS">{accountTypeLabels.MFS}</option>
                  </Select>
                </Field>

                {isMfs ? (
                  <>
                    <Field
                      htmlFor="cash-bank-provider"
                      label="Provider"
                      required
                    >
                      <Select
                        disabled={!hasCashBankLedgerAccounts}
                        id="cash-bank-provider"
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            provider: event.target.value as MfsProvider | "",
                          }))
                        }
                        value={form.provider}
                      >
                        <option value="">Select MFS provider</option>
                        {mfsProviderOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    {form.provider === "OTHER" ? (
                      <Field
                        htmlFor="cash-bank-provider-other"
                        label="Provider name"
                        required
                      >
                        <TextInput
                          disabled={!hasCashBankLedgerAccounts}
                          id="cash-bank-provider-other"
                          onChange={(event) =>
                            setForm((previous) => ({
                              ...previous,
                              providerOtherName: event.target.value,
                            }))
                          }
                          placeholder="Enter the MFS provider name"
                          value={form.providerOtherName}
                        />
                      </Field>
                    ) : null}

                    <Field
                      htmlFor="cash-bank-wallet"
                      hint="Mobile number or account ID that identifies this wallet."
                      label="Wallet number / account ID"
                      required
                    >
                      <TextInput
                        disabled={!hasCashBankLedgerAccounts}
                        id="cash-bank-wallet"
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            walletNumber: event.target.value,
                          }))
                        }
                        placeholder="e.g. 01XXXXXXXXX"
                        value={form.walletNumber}
                      />
                    </Field>

                    <Field
                      htmlFor="cash-bank-holder"
                      hint="Optional. Use when the wallet is registered under a different name."
                      label="Account holder name"
                    >
                      <TextInput
                        disabled={!hasCashBankLedgerAccounts}
                        id="cash-bank-holder"
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            accountHolderName: event.target.value,
                          }))
                        }
                        placeholder="Optional account holder name"
                        value={form.accountHolderName}
                      />
                    </Field>

                    <div className="sm:col-span-2">
                      <Notice tone="info">
                        MFS accounts can be set up here now. Posting vouchers
                        against MFS accounts is not enabled yet and will arrive
                        in a later step.
                      </Notice>
                    </div>
                  </>
                ) : (
                  <>
                    <Field htmlFor="cash-bank-bank-name" label="Bank name">
                      <TextInput
                        disabled={!hasCashBankLedgerAccounts}
                        id="cash-bank-bank-name"
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            bankName: event.target.value,
                          }))
                        }
                        placeholder="Optional bank name"
                        value={form.bankName}
                      />
                    </Field>

                    <Field htmlFor="cash-bank-branch" label="Branch">
                      <TextInput
                        disabled={!hasCashBankLedgerAccounts}
                        id="cash-bank-branch"
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            branch: event.target.value,
                          }))
                        }
                        placeholder="Optional branch"
                        value={form.branch}
                      />
                    </Field>

                    <Field
                      className="sm:col-span-2"
                      htmlFor="cash-bank-account-number"
                      label="Account number"
                    >
                      <TextInput
                        disabled={!hasCashBankLedgerAccounts}
                        id="cash-bank-account-number"
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            accountNumber: event.target.value,
                          }))
                        }
                        placeholder="Optional account number"
                        value={form.accountNumber}
                      />
                    </Field>
                  </>
                )}

                <div className="sm:col-span-2">
                  <CheckboxField
                    checked={form.isActive}
                    description="Inactive accounts will not be selectable in future workflows."
                    disabled={!hasCashBankLedgerAccounts}
                    id="cash-bank-active"
                    label="Active"
                    onChange={(checked) =>
                      setForm((previous) => ({
                        ...previous,
                        isActive: checked,
                      }))
                    }
                  />
                </div>
              </div>

              {formError ? <Notice tone="error">{formError}</Notice> : null}
              {formSuccess ? (
                <Notice tone="success">{formSuccess}</Notice>
              ) : null}

              <div className="flex items-center gap-3">
                <Button
                  disabled={isSaving || !hasCashBankLedgerAccounts}
                  type="submit"
                >
                  {isSaving
                    ? "Saving..."
                    : isEditing
                      ? "Save changes"
                      : "Create account"}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader
              description="Cash, bank, and MFS setup records linked to eligible ledger accounts."
              title="Cash, bank and MFS accounts"
            />

            {cashBankAccounts.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  description="Create the first cash, bank, or MFS account using the form above."
                  title="No cash, bank or MFS accounts yet"
                />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2.5">Display name</th>
                      <th className="px-3 py-2.5">Type</th>
                      <th className="px-3 py-2.5">Ledger account</th>
                      <th className="px-3 py-2.5">Details</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashBankAccounts.map((account) => (
                      <tr
                        className="border-b border-border/70 last:border-0"
                        key={account.id}
                      >
                        <td className="px-3 py-3 font-medium text-foreground">
                          {account.displayName}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge tone="neutral">
                            {accountTypeLabels[account.accountType]}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {linkedLedgerLabel(account)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {account.accountType === "MFS" ? (
                            <span className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {providerLabel(account)}
                              </span>
                              <span className="text-xs">
                                {account.walletNumber ?? "-"}
                              </span>
                            </span>
                          ) : (
                            (account.bankName ?? "-")
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {account.isActive ? (
                            <StatusBadge tone="active">Active</StatusBadge>
                          ) : (
                            <StatusBadge tone="inactive">Inactive</StatusBadge>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end">
                            <Button
                              onClick={() => startEdit(account)}
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
