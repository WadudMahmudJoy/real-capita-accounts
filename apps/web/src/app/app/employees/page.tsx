"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Eye, Pencil, Plus, RefreshCw, X } from "lucide-react";
import {
  ApiError,
  createEmployee,
  getEmployees,
  updateEmployee,
  type Employee,
  type EmployeeInput,
  type EmployeeUpdateInput,
} from "@/lib/api";
import {
  Button,
  buttonClassName,
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
import {
  FieldError,
  dateInputValue,
  fieldErrorProps,
  formatSalaryDate,
  salaryErrorMessage,
} from "../_components/salary-ui";

type EmployeeForm = {
  employeeCode: string;
  fullName: string;
  designation: string;
  joiningDate: string;
  isActive: boolean;
};

const emptyForm: EmployeeForm = {
  employeeCode: "",
  fullName: "",
  designation: "",
  joiningDate: "",
  isActive: true,
};

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadEmployees = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await getEmployees({ includeInactive: true }, signal);
        setLoadError(null);
        setEmployees(data);
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
        const data = await getEmployees(
          { includeInactive: true },
          controller.signal,
        );
        setEmployees(data);
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

  const visibleEmployees = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return employees.filter((employee) => {
      if (statusFilter === "ACTIVE" && !employee.isActive) return false;
      if (statusFilter === "INACTIVE" && employee.isActive) return false;
      if (!query) return true;
      return [employee.employeeCode, employee.fullName, employee.designation].some(
        (value) => value.toLocaleLowerCase().includes(query),
      );
    });
  }, [employees, search, statusFilter]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFieldErrors({});
    setFormError(null);
    setSuccess(null);
    setFormOpen(true);
  }

  function openEdit(employee: Employee) {
    setEditing(employee);
    setForm({
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      designation: employee.designation,
      joiningDate: dateInputValue(employee.joiningDate),
      isActive: employee.isActive,
    });
    setFieldErrors({});
    setFormError(null);
    setSuccess(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (isSaving) return;
    setFormOpen(false);
    setEditing(null);
    setFieldErrors({});
    setFormError(null);
  }

  function validate() {
    const errors: Record<string, string> = {};
    if (!form.employeeCode.trim()) errors.employeeCode = "Employee Code is required.";
    if (!form.fullName.trim()) errors.fullName = "Full Name is required.";
    if (!form.designation.trim()) errors.designation = "Designation is required.";
    if (!form.joiningDate) errors.joiningDate = "Joining Date is required.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || !validate()) return;
    setIsSaving(true);
    setFormError(null);
    setSuccess(null);

    const base: EmployeeInput = {
      employeeCode: form.employeeCode.trim(),
      fullName: form.fullName.trim(),
      designation: form.designation.trim(),
      joiningDate: form.joiningDate,
    };

    try {
      if (editing) {
        const payload: EmployeeUpdateInput = { ...base, isActive: form.isActive };
        await updateEmployee(editing.id, payload);
        setSuccess("Employee details updated.");
      } else {
        await createEmployee(base);
        setSuccess("Employee created and activated.");
      }
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await loadEmployees();
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

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="HR & Salary - Employees"
        description="Maintain the small employee master used by Salary Foundation. Salary assignments and payment profiles are configured from each employee record."
      />

      {success ? <Notice tone="success">{success}</Notice> : null}

      {status === "loading" ? <LoadingPanel message="Loading employees..." /> : null}
      {status === "error" ? (
        <Card>
          <Notice tone="error">{loadError}</Notice>
          <Button className="mt-4" onClick={() => void loadEmployees()} variant="secondary">
            <RefreshCw aria-hidden="true" className="size-4" />
            Retry
          </Button>
        </Card>
      ) : null}

      {status === "ready" ? (
        <>
          <Card>
            <CardHeader
              title="Employee controls"
              description="Search the currently available employee records or include inactive employees for salary-history review."
              actions={
                <Button onClick={openCreate}>
                  <Plus aria-hidden="true" className="size-4" />
                  Add Employee
                </Button>
              }
            />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
              <Field htmlFor="employee-search" label="Search">
                <TextInput
                  id="employee-search"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Code, name, or designation"
                  value={search}
                />
              </Field>
              <Field htmlFor="employee-status-filter" label="Status">
                <Select
                  id="employee-status-filter"
                  onChange={(event) =>
                    setStatusFilter(event.target.value as typeof statusFilter)
                  }
                  value={statusFilter}
                >
                  <option value="ALL">All active and inactive</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </Field>
              <div className="flex items-end">
                <Button
                  className="w-full lg:w-auto"
                  onClick={() => void loadEmployees()}
                  variant="secondary"
                >
                  <RefreshCw aria-hidden="true" className="size-4" />
                  Refresh
                </Button>
              </div>
            </div>
          </Card>

          {formOpen ? (
            <Card>
              <CardHeader
                title={editing ? "Edit Employee" : "Add Employee"}
                description={
                  editing
                    ? "Only backend-supported employee master fields are editable."
                    : "New employees are created active by the verified backend."
                }
                actions={
                  <Button disabled={isSaving} onClick={closeForm} variant="ghost">
                    <X aria-hidden="true" className="size-4" />
                    Close
                  </Button>
                }
              />
              <form className="mt-6 flex flex-col gap-5" onSubmit={submit}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field htmlFor="employee-code" label="Employee Code" required>
                    <TextInput
                      {...fieldErrorProps("employee-code", fieldErrors.employeeCode)}
                      autoComplete="off"
                      id="employee-code"
                      onChange={(event) => setForm({ ...form, employeeCode: event.target.value })}
                      value={form.employeeCode}
                    />
                    <FieldError controlId="employee-code" message={fieldErrors.employeeCode} />
                  </Field>
                  <Field htmlFor="employee-full-name" label="Full Name" required>
                    <TextInput
                      {...fieldErrorProps("employee-full-name", fieldErrors.fullName)}
                      autoComplete="name"
                      id="employee-full-name"
                      onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                      value={form.fullName}
                    />
                    <FieldError controlId="employee-full-name" message={fieldErrors.fullName} />
                  </Field>
                  <Field htmlFor="employee-designation" label="Designation" required>
                    <TextInput
                      {...fieldErrorProps("employee-designation", fieldErrors.designation)}
                      id="employee-designation"
                      onChange={(event) => setForm({ ...form, designation: event.target.value })}
                      value={form.designation}
                    />
                    <FieldError controlId="employee-designation" message={fieldErrors.designation} />
                  </Field>
                  <Field htmlFor="employee-joining-date" label="Joining Date" required>
                    <TextInput
                      {...fieldErrorProps("employee-joining-date", fieldErrors.joiningDate)}
                      id="employee-joining-date"
                      onChange={(event) => setForm({ ...form, joiningDate: event.target.value })}
                      type="date"
                      value={form.joiningDate}
                    />
                    <FieldError controlId="employee-joining-date" message={fieldErrors.joiningDate} />
                  </Field>
                </div>
                {editing ? (
                  <CheckboxField
                    checked={form.isActive}
                    description="Inactive employees retain their Salary history but cannot approve new configurations."
                    id="employee-active"
                    label="Active Employee"
                    onChange={(isActive) => setForm({ ...form, isActive })}
                  />
                ) : null}
                {formError ? <Notice tone="error">{formError}</Notice> : null}
                <div className="flex flex-wrap gap-3">
                  <Button disabled={isSaving} type="submit">
                    {isSaving ? "Saving..." : editing ? "Save Employee" : "Create Employee"}
                  </Button>
                  <Button disabled={isSaving} onClick={closeForm} variant="secondary">
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Employee List"
              description="Deleted records are excluded. Database IDs are never used as the visible employee identity."
            />
            <div className="mt-6 overflow-x-auto">
              {visibleEmployees.length === 0 ? (
                <EmptyState
                  title="No employees found"
                  description="Change the current filters or add the first Salary Foundation employee."
                />
              ) : (
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Employee Code</th>
                      <th className="py-3 pr-4 font-medium">Employee Name</th>
                      <th className="py-3 pr-4 font-medium">Designation</th>
                      <th className="py-3 pr-4 font-medium">Joining Date</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                      <th className="py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEmployees.map((employee) => (
                      <tr className="border-b border-border/80 align-top" key={employee.id}>
                        <td className="py-3 pr-4 font-medium text-foreground">
                          {employee.employeeCode}
                        </td>
                        <td className="py-3 pr-4">{employee.fullName}</td>
                        <td className="py-3 pr-4">{employee.designation}</td>
                        <td className="py-3 pr-4">{formatSalaryDate(employee.joiningDate)}</td>
                        <td className="py-3 pr-4">
                          <StatusBadge tone={employee.isActive ? "active" : "inactive"}>
                            {employee.isActive ? "Active" : "Inactive"}
                          </StatusBadge>
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              className={buttonClassName({ className: "h-9 px-3", variant: "ghost" })}
                              href={`/app/employees/${employee.id}`}
                            >
                              <Eye aria-hidden="true" className="size-4" />
                              View / Configure Salary
                            </Link>
                            <Button
                              className="h-9 px-3"
                              onClick={() => openEdit(employee)}
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
              )}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
