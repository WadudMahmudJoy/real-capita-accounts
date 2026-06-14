"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  ApiError,
  createLedgerAccount,
  getAccountGroups,
  getLedgerAccounts,
  toErrorMessage,
  updateLedgerAccount,
  type AccountGroup,
  type LedgerAccount,
  type LedgerAccountInput,
  type NormalBalanceSide,
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
  TextArea,
  TextInput,
} from "../../_components/ui";

type FormState = {
  id: string | null;
  accountGroupId: string;
  code: string;
  name: string;
  normalBalance: NormalBalanceSide;
  requiresProject: boolean;
  requiresCostCenter: boolean;
  isCashBank: boolean;
  description: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  accountGroupId: "",
  code: "",
  description: "",
  id: null,
  isActive: true,
  isCashBank: false,
  name: "",
  normalBalance: "DEBIT",
  requiresCostCenter: false,
  requiresProject: false,
};

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function groupLabel(account: LedgerAccount): string {
  const group = account.accountGroup;

  if (!group) {
    return "Account group not loaded";
  }

  return `${group.code} - ${group.name}`;
}

function flagBadges(account: LedgerAccount) {
  const flags = [
    account.requiresProject ? "Project" : null,
    account.requiresCostCenter ? "Cost center" : null,
    account.isCashBank ? "Cash/Bank" : null,
  ].filter(Boolean);

  if (flags.length === 0) {
    return <span className="text-muted-foreground">None</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((flag) => (
        <StatusBadge key={flag} tone="neutral">
          {flag}
        </StatusBadge>
      ))}
    </div>
  );
}

export default function LedgerAccountsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [ledgerData, groupData] = await Promise.all([
          getLedgerAccounts(controller.signal),
          getAccountGroups(controller.signal),
        ]);

        setLedgerAccounts(ledgerData);
        setAccountGroups(groupData);
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

  async function reloadLedgerAccounts() {
    try {
      setLedgerAccounts(await getLedgerAccounts());
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

  function startEdit(account: LedgerAccount) {
    setForm({
      accountGroupId: account.accountGroupId,
      code: account.code,
      description: account.description ?? "",
      id: account.id,
      isActive: account.isActive,
      isCashBank: account.isCashBank,
      name: account.name,
      normalBalance: account.normalBalance,
      requiresCostCenter: account.requiresCostCenter,
      requiresProject: account.requiresProject,
    });
    setFormError(null);
    setFormSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();
    if (!form.accountGroupId || !code || !name) {
      setFormError("Account group, code, and name are required.");
      return;
    }

    const payload: LedgerAccountInput = {
      accountGroupId: form.accountGroupId,
      code,
      description: optional(form.description),
      isActive: form.isActive,
      isCashBank: form.isCashBank,
      name,
      normalBalance: form.normalBalance,
      requiresCostCenter: form.requiresCostCenter,
      requiresProject: form.requiresProject,
    };

    setIsSaving(true);

    try {
      if (form.id) {
        await updateLedgerAccount(form.id, payload);
        setFormSuccess("Ledger account updated.");
      } else {
        await createLedgerAccount(payload);
        setFormSuccess("Ledger account created.");
      }

      setForm(emptyForm);
      await reloadLedgerAccounts();
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
  const hasAccountGroups = accountGroups.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        description="Create controlled ledger account heads for future vouchers. This page does not show balances or transactions."
        title="Ledger Accounts"
      />

      {status === "loading" ? (
        <LoadingPanel message="Loading ledger accounts..." />
      ) : null}

      {status === "error" ? (
        <Notice tone="error">{loadError}</Notice>
      ) : null}

      {status === "ready" ? (
        <>
          {!hasAccountGroups ? (
            <Notice tone="info">
              Create an account group before adding ledger accounts.
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
                  ? "Update the selected ledger account."
                  : "Add a ledger account head under an account group."
              }
              title={isEditing ? "Edit ledger account" : "New ledger account"}
            />

            <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  className="sm:col-span-2"
                  htmlFor="ledger-group"
                  label="Account group"
                  required
                >
                  <Select
                    disabled={!hasAccountGroups}
                    id="ledger-group"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        accountGroupId: event.target.value,
                      }))
                    }
                    required
                    value={form.accountGroupId}
                  >
                    <option value="">Select account group</option>
                    {accountGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.code} - {group.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  hint="Must be unique across ledger accounts."
                  htmlFor="ledger-code"
                  label="Code"
                  required
                >
                  <TextInput
                    disabled={!hasAccountGroups}
                    id="ledger-code"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        code: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="LA-001"
                    required
                    value={form.code}
                  />
                </Field>

                <Field htmlFor="ledger-name" label="Name" required>
                  <TextInput
                    disabled={!hasAccountGroups}
                    id="ledger-name"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Cash in hand"
                    required
                    value={form.name}
                  />
                </Field>

                <Field
                  className="sm:col-span-2"
                  htmlFor="ledger-normal-balance"
                  label="Normal balance"
                  required
                >
                  <Select
                    disabled={!hasAccountGroups}
                    id="ledger-normal-balance"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        normalBalance: event.target.value as NormalBalanceSide,
                      }))
                    }
                    value={form.normalBalance}
                  >
                    <option value="DEBIT">Debit</option>
                    <option value="CREDIT">Credit</option>
                  </Select>
                </Field>

                <Field
                  className="sm:col-span-2"
                  htmlFor="ledger-description"
                  label="Description"
                >
                  <TextArea
                    disabled={!hasAccountGroups}
                    id="ledger-description"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Optional description"
                    value={form.description}
                  />
                </Field>

                <CheckboxField
                  checked={form.requiresProject}
                  description="Future voucher lines using this account should include a project."
                  disabled={!hasAccountGroups}
                  id="ledger-requires-project"
                  label="Requires project"
                  onChange={(checked) =>
                    setForm((previous) => ({
                      ...previous,
                      requiresProject: checked,
                    }))
                  }
                />

                <CheckboxField
                  checked={form.requiresCostCenter}
                  description="Future voucher lines using this account should include a cost center."
                  disabled={!hasAccountGroups}
                  id="ledger-requires-cost-center"
                  label="Requires cost center"
                  onChange={(checked) =>
                    setForm((previous) => ({
                      ...previous,
                      requiresCostCenter: checked,
                    }))
                  }
                />

                <CheckboxField
                  checked={form.isCashBank}
                  description="Enable this account for Cash & Bank setup."
                  disabled={!hasAccountGroups}
                  id="ledger-cash-bank"
                  label="Cash/Bank account"
                  onChange={(checked) =>
                    setForm((previous) => ({
                      ...previous,
                      isCashBank: checked,
                    }))
                  }
                />

                <CheckboxField
                  checked={form.isActive}
                  description="Inactive ledger accounts will not be selectable in future transaction workflows."
                  disabled={!hasAccountGroups}
                  id="ledger-active"
                  label="Active"
                  onChange={(checked) =>
                    setForm((previous) => ({
                      ...previous,
                      isActive: checked,
                    }))
                  }
                />
              </div>

              {formError ? <Notice tone="error">{formError}</Notice> : null}
              {formSuccess ? (
                <Notice tone="success">{formSuccess}</Notice>
              ) : null}

              <div className="flex items-center gap-3">
                <Button disabled={isSaving || !hasAccountGroups} type="submit">
                  {isSaving
                    ? "Saving..."
                    : isEditing
                      ? "Save changes"
                      : "Create ledger account"}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader
              description="Ledger account heads ordered by code."
              title="Ledger accounts"
            />

            {ledgerAccounts.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  description="Create the first ledger account using the form above."
                  title="No ledger accounts yet"
                />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[880px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2.5">Code</th>
                      <th className="px-3 py-2.5">Name</th>
                      <th className="px-3 py-2.5">Group</th>
                      <th className="px-3 py-2.5">Normal</th>
                      <th className="px-3 py-2.5">Flags</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerAccounts.map((account) => (
                      <tr
                        className="border-b border-border/70 last:border-0"
                        key={account.id}
                      >
                        <td className="px-3 py-3 font-medium text-foreground">
                          {account.code}
                        </td>
                        <td className="px-3 py-3 text-foreground">
                          {account.name}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {groupLabel(account)}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge tone="neutral">
                            {account.normalBalance}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-3">{flagBadges(account)}</td>
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
