"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  ApiError,
  createAccountGroup,
  getAccountClasses,
  getAccountGroups,
  toErrorMessage,
  updateAccountGroup,
  type AccountClass,
  type AccountGroup,
  type AccountGroupInput,
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
  accountClassId: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  accountClassId: "",
  code: "",
  description: "",
  id: null,
  isActive: true,
  name: "",
};

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function accountClassLabel(group: AccountGroup): string {
  const accountClass = group.accountClass;

  if (!accountClass) {
    return "Account class not loaded";
  }

  return `${accountClass.code} - ${accountClass.name}`;
}

export default function AccountGroupsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [accountClasses, setAccountClasses] = useState<AccountClass[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [groupData, classData] = await Promise.all([
          getAccountGroups(controller.signal),
          getAccountClasses(controller.signal),
        ]);

        setAccountGroups(groupData);
        setAccountClasses(classData);
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

  async function reloadAccountGroups() {
    try {
      setAccountGroups(await getAccountGroups());
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

  function startEdit(group: AccountGroup) {
    setForm({
      accountClassId: group.accountClassId,
      code: group.code,
      description: group.description ?? "",
      id: group.id,
      isActive: group.isActive,
      name: group.name,
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
    if (!form.accountClassId || !code || !name) {
      setFormError("Account class, code, and name are required.");
      return;
    }

    const payload: AccountGroupInput = {
      accountClassId: form.accountClassId,
      code,
      description: optional(form.description),
      isActive: form.isActive,
      name,
    };

    setIsSaving(true);

    try {
      if (form.id) {
        await updateAccountGroup(form.id, payload);
        setFormSuccess("Account group updated.");
      } else {
        await createAccountGroup(payload);
        setFormSuccess("Account group created.");
      }

      setForm(emptyForm);
      await reloadAccountGroups();
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
  const hasAccountClasses = accountClasses.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        description="Organize account heads under the five fixed account classes. Account groups keep account creation controlled."
        title="Account Groups"
      />

      {status === "loading" ? (
        <LoadingPanel message="Loading account groups..." />
      ) : null}

      {status === "error" ? (
        <Notice tone="error">{loadError}</Notice>
      ) : null}

      {status === "ready" ? (
        <>
          {!hasAccountClasses ? (
            <Notice tone="info">
              Account classes are required before creating account groups.
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
                  ? "Update the selected account group."
                  : "Add a controlled account group under a fixed class."
              }
              title={isEditing ? "Edit account group" : "New account group"}
            />

            <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  className="sm:col-span-2"
                  htmlFor="account-group-class"
                  label="Account class"
                  required
                >
                  <Select
                    disabled={!hasAccountClasses}
                    id="account-group-class"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        accountClassId: event.target.value,
                      }))
                    }
                    required
                    value={form.accountClassId}
                  >
                    <option value="">Select account class</option>
                    {accountClasses.map((accountClass) => (
                      <option key={accountClass.id} value={accountClass.id}>
                        {accountClass.code} - {accountClass.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  hint="Must be unique across account groups."
                  htmlFor="account-group-code"
                  label="Code"
                  required
                >
                  <TextInput
                    disabled={!hasAccountClasses}
                    id="account-group-code"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        code: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="AG-001"
                    required
                    value={form.code}
                  />
                </Field>

                <Field htmlFor="account-group-name" label="Name" required>
                  <TextInput
                    disabled={!hasAccountClasses}
                    id="account-group-name"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Current Assets"
                    required
                    value={form.name}
                  />
                </Field>

                <Field
                  className="sm:col-span-2"
                  htmlFor="account-group-description"
                  label="Description"
                >
                  <TextArea
                    disabled={!hasAccountClasses}
                    id="account-group-description"
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

                <div className="sm:col-span-2">
                  <CheckboxField
                    checked={form.isActive}
                    description="Inactive account groups will not be selectable when creating future account heads."
                    disabled={!hasAccountClasses}
                    id="account-group-active"
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
                <Button disabled={isSaving || !hasAccountClasses} type="submit">
                  {isSaving
                    ? "Saving..."
                    : isEditing
                      ? "Save changes"
                      : "Create account group"}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader
              description="Groups ordered by code."
              title="Account groups"
            />

            {accountGroups.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  description="Create the first account group using the form above."
                  title="No account groups yet"
                />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2.5">Code</th>
                      <th className="px-3 py-2.5">Name</th>
                      <th className="px-3 py-2.5">Class</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountGroups.map((group) => (
                      <tr
                        className="border-b border-border/70 last:border-0"
                        key={group.id}
                      >
                        <td className="px-3 py-3 font-medium text-foreground">
                          {group.code}
                        </td>
                        <td className="px-3 py-3 text-foreground">
                          {group.name}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {accountClassLabel(group)}
                        </td>
                        <td className="px-3 py-3">
                          {group.isActive ? (
                            <StatusBadge tone="active">Active</StatusBadge>
                          ) : (
                            <StatusBadge tone="inactive">Inactive</StatusBadge>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end">
                            <Button
                              onClick={() => startEdit(group)}
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
