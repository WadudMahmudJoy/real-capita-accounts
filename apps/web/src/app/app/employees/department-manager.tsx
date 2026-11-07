"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus, X } from "lucide-react";
import {
  createDepartment,
  updateDepartment,
  type Department,
} from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Notice,
  StatusBadge,
  TextArea,
  TextInput,
} from "../_components/ui";
import { salaryErrorMessage } from "../_components/salary-ui";

type FormState = {
  code: string;
  name: string;
  description: string;
};

const emptyForm: FormState = { code: "", name: "", description: "" };

export function DepartmentManager({
  departments,
  onChanged,
}: {
  departments: Department[];
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setSuccess(null);
  }

  function openEdit(department: Department) {
    setEditing(department);
    setForm({
      code: department.code,
      name: department.name,
      description: department.description ?? "",
    });
    setError(null);
    setSuccess(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    if (!form.code.trim() || !form.name.trim()) {
      setError("Department Code and Name are required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editing) {
        await updateDepartment(editing.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
        });
        setSuccess("Department updated.");
      } else {
        await createDepartment({
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || null,
        });
        setSuccess("Department created.");
      }
      setEditing(null);
      setForm(emptyForm);
      await onChanged();
    } catch (caught) {
      setError(salaryErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleActive(department: Department) {
    const nextActive = !department.isActive;
    if (
      !nextActive &&
      !window.confirm(
        "Deactivate this Department? Existing Employees will keep it for historical display, but it cannot be assigned to new Employees.",
      )
    ) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateDepartment(department.id, { isActive: nextActive });
      setSuccess(nextActive ? "Department activated." : "Department deactivated.");
      await onChanged();
    } catch (caught) {
      setError(salaryErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Department Management"
        description="Create the actual Department master here. Codes are normalized and become read-only after creation; Departments are deactivated instead of deleted."
        actions={
          <Button onClick={openCreate} variant="secondary">
            <Plus aria-hidden="true" className="size-4" />
            New Department
          </Button>
        }
      />

      <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            htmlFor="department-code"
            label="Department Code"
            required
            hint={editing ? "Code is immutable after creation." : undefined}
          >
            <TextInput
              disabled={Boolean(editing)}
              id="department-code"
              maxLength={32}
              onChange={(event) =>
                setForm({ ...form, code: event.target.value.toUpperCase() })
              }
              value={form.code}
            />
          </Field>
          <Field htmlFor="department-name" label="Department Name" required>
            <TextInput
              id="department-name"
              maxLength={150}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              value={form.name}
            />
          </Field>
        </div>
        <Field htmlFor="department-description" label="Description">
          <TextArea
            id="department-description"
            maxLength={500}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
            value={form.description}
          />
        </Field>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {success ? <Notice tone="success">{success}</Notice> : null}
        <div className="flex flex-wrap gap-3">
          <Button disabled={isSaving} type="submit">
            {isSaving ? "Saving..." : editing ? "Save Department" : "Create Department"}
          </Button>
          {editing ? (
            <Button disabled={isSaving} onClick={openCreate} variant="ghost">
              <X aria-hidden="true" className="size-4" />
              Cancel Edit
            </Button>
          ) : null}
        </div>
      </form>

      <div className="mt-8 overflow-x-auto">
        {departments.length === 0 ? (
          <EmptyState
            title="No Departments yet"
            description="Create the first real Department before adding Phase 2 Employees."
          />
        ) : (
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-3 pr-4 font-medium">Code</th>
                <th className="py-3 pr-4 font-medium">Name</th>
                <th className="py-3 pr-4 font-medium">Employees</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((department) => (
                <tr className="border-b border-border/80" key={department.id}>
                  <td className="py-3 pr-4 font-mono text-xs font-semibold">
                    {department.code}
                  </td>
                  <td className="py-3 pr-4">
                    <p className="font-medium">{department.name}</p>
                    {department.description ? (
                      <p className="mt-1 max-w-lg text-xs text-muted-foreground">
                        {department.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">{department._count.employees}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge tone={department.isActive ? "active" : "inactive"}>
                      {department.isActive ? "Active" : "Inactive"}
                    </StatusBadge>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={isSaving}
                        onClick={() => openEdit(department)}
                        variant="ghost"
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                        Edit
                      </Button>
                      <Button
                        disabled={isSaving}
                        onClick={() => void toggleActive(department)}
                        variant={department.isActive ? "danger" : "secondary"}
                      >
                        {department.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
