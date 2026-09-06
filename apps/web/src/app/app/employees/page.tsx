"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, CalendarClock, ClipboardCheck, Eye, Plus, RefreshCw, Search, X } from "lucide-react";
import {
  ApiError,
  createEmployee,
  getDepartments,
  getEmployees,
  type Department,
  type EmployeeInput,
  type EmployeeListItem,
} from "@/lib/api";
import {
  Button,
  buttonClassName,
  Card,
  CardHeader,
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
  fieldErrorProps,
  formatSalaryDate,
  salaryErrorMessage,
} from "../_components/salary-ui";
import { DepartmentManager } from "./department-manager";

type EmployeeForm = {
  employeeCode: string;
  fullName: string;
  designation: string;
  departmentId: string;
  joiningDate: string;
  mobileNumber: string;
};

const emptyForm: EmployeeForm = {
  employeeCode: "",
  fullName: "",
  designation: "",
  departmentId: "",
  joiningDate: "",
  mobileNumber: "",
};

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "INACTIVE" | "ALL">(
    "ACTIVE",
  );
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [departmentsOpen, setDepartmentsOpen] = useState(false);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadDepartments = useCallback(async (signal?: AbortSignal) => {
    const data = await getDepartments(signal);
    setDepartments(data);
  }, []);

  const loadEmployees = useCallback(
    async (signal?: AbortSignal) => {
      const data = await getEmployees(
        {
          status: statusFilter,
          search: search || undefined,
          departmentId: departmentFilter || undefined,
        },
        signal,
      );
      setEmployees(data);
    },
    [departmentFilter, search, statusFilter],
  );

  const loadAll = useCallback(
    async (signal?: AbortSignal) => {
      try {
        await Promise.all([loadEmployees(signal), loadDepartments(signal)]);
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
    [loadDepartments, loadEmployees, router],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function initialLoad() {
      try {
        const [employeeRows, departmentRows] = await Promise.all([
          getEmployees(
            {
              status: statusFilter,
              search: search || undefined,
              departmentId: departmentFilter || undefined,
            },
            controller.signal,
          ),
          getDepartments(controller.signal),
        ]);
        setEmployees(employeeRows);
        setDepartments(departmentRows);
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
  }, [departmentFilter, router, search, statusFilter]);

  function openCreate() {
    setForm(emptyForm);
    setFieldErrors({});
    setFormError(null);
    setSuccess(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (isSaving) return;
    setFormOpen(false);
    setFieldErrors({});
    setFormError(null);
  }

  function validate() {
    const errors: Record<string, string> = {};
    if (!form.employeeCode.trim()) errors.employeeCode = "Employee Code is required.";
    if (!form.fullName.trim()) errors.fullName = "Full Name is required.";
    if (!form.designation.trim()) errors.designation = "Designation is required.";
    if (!form.departmentId) errors.departmentId = "Department is required.";
    if (!form.joiningDate) errors.joiningDate = "Joining Date is required.";
    if (!form.mobileNumber.trim()) errors.mobileNumber = "Mobile Number is required.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || !validate()) return;
    setIsSaving(true);
    setFormError(null);
    setSuccess(null);

    const input: EmployeeInput = {
      employeeCode: form.employeeCode.trim(),
      fullName: form.fullName.trim(),
      designation: form.designation.trim(),
      departmentId: form.departmentId,
      joiningDate: form.joiningDate,
      mobileNumber: form.mobileNumber.trim(),
    };

    try {
      await createEmployee(input);
      setSuccess("Employee created.");
      setFormOpen(false);
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

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  const activeDepartments = departments.filter((department) => department.isActive);

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="Employees"
        description="Maintain Employee identity, contact, employment, emergency contact, and existing Salary configuration without duplicating Salary or bank data."
      />

      {success ? <Notice tone="success">{success}</Notice> : null}

      {status === "loading" ? <LoadingPanel message="Loading Employees..." /> : null}
      {status === "error" ? (
        <Card>
          <Notice tone="error">{loadError}</Notice>
          <Button className="mt-4" onClick={() => void loadAll()} variant="secondary">
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
              description="Search and filters are applied by the server. Deleted records remain outside the normal UI."
              actions={
                <div className="flex flex-wrap gap-2">
                  <Link className={buttonClassName({ variant: "secondary" })} href="/app/employees/work-schedules">
                    <CalendarClock aria-hidden="true" className="size-4" />
                    Work Schedule Settings
                  </Link>
                  <Link className={buttonClassName({ variant: "secondary" })} href="/app/employees/attendance">
                    <ClipboardCheck aria-hidden="true" className="size-4" />
                    Attendance
                  </Link>
                  <Button
                    onClick={() => setDepartmentsOpen((current) => !current)}
                    variant="secondary"
                  >
                    <Building2 aria-hidden="true" className="size-4" />
                    Manage Departments
                  </Button>
                  <Button disabled={activeDepartments.length === 0} onClick={openCreate}>
                    <Plus aria-hidden="true" className="size-4" />
                    Add Employee
                  </Button>
                </div>
              }
            />
            {activeDepartments.length === 0 ? (
              <Notice tone="info">
                Create an active Department before adding a Phase 2 Employee.
              </Notice>
            ) : null}
            <form
              className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_200px_220px_auto]"
              onSubmit={applySearch}
            >
              <Field htmlFor="employee-search" label="Search">
                <TextInput
                  id="employee-search"
                  maxLength={100}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Code, name, designation, or Department"
                  value={searchInput}
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
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="ALL">All</option>
                </Select>
              </Field>
              <Field htmlFor="employee-department-filter" label="Department">
                <Select
                  id="employee-department-filter"
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                  value={departmentFilter}
                >
                  <option value="">All Departments</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.code} - {department.name}
                      {department.isActive ? "" : " (Inactive)"}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end gap-2">
                <Button type="submit">
                  <Search aria-hidden="true" className="size-4" />
                  Search
                </Button>
                <Button onClick={() => void loadAll()} variant="ghost">
                  <RefreshCw aria-hidden="true" className="size-4" />
                  <span className="sr-only">Refresh</span>
                </Button>
              </div>
            </form>
          </Card>

          {departmentsOpen ? (
            <DepartmentManager
              departments={departments}
              onChanged={async () => {
                await loadDepartments();
                await loadEmployees();
              }}
            />
          ) : null}

          {formOpen ? (
            <Card>
              <CardHeader
                title="Add Employee"
                description="Create the compact Employee record first, then complete optional profile information from Employee detail."
                actions={
                  <Button disabled={isSaving} onClick={closeForm} variant="ghost">
                    <X aria-hidden="true" className="size-4" />
                    Close
                  </Button>
                }
              />
              <form className="mt-6 flex flex-col gap-5" onSubmit={submit}>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <Field htmlFor="employee-code" label="Employee Code" required>
                    <TextInput
                      {...fieldErrorProps("employee-code", fieldErrors.employeeCode)}
                      autoComplete="off"
                      id="employee-code"
                      maxLength={32}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          employeeCode: event.target.value.toUpperCase(),
                        })
                      }
                      value={form.employeeCode}
                    />
                    <FieldError controlId="employee-code" message={fieldErrors.employeeCode} />
                  </Field>
                  <Field htmlFor="employee-full-name" label="Full Name" required>
                    <TextInput
                      {...fieldErrorProps("employee-full-name", fieldErrors.fullName)}
                      autoComplete="name"
                      id="employee-full-name"
                      maxLength={200}
                      onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                      value={form.fullName}
                    />
                    <FieldError controlId="employee-full-name" message={fieldErrors.fullName} />
                  </Field>
                  <Field htmlFor="employee-mobile" label="Mobile Number" required>
                    <TextInput
                      {...fieldErrorProps("employee-mobile", fieldErrors.mobileNumber)}
                      autoComplete="tel"
                      id="employee-mobile"
                      inputMode="tel"
                      onChange={(event) =>
                        setForm({ ...form, mobileNumber: event.target.value })
                      }
                      placeholder="01XXXXXXXXX"
                      value={form.mobileNumber}
                    />
                    <FieldError controlId="employee-mobile" message={fieldErrors.mobileNumber} />
                  </Field>
                  <Field htmlFor="employee-designation" label="Designation" required>
                    <TextInput
                      {...fieldErrorProps("employee-designation", fieldErrors.designation)}
                      id="employee-designation"
                      maxLength={150}
                      onChange={(event) =>
                        setForm({ ...form, designation: event.target.value })
                      }
                      value={form.designation}
                    />
                    <FieldError controlId="employee-designation" message={fieldErrors.designation} />
                  </Field>
                  <Field htmlFor="employee-department" label="Department" required>
                    <Select
                      {...fieldErrorProps("employee-department", fieldErrors.departmentId)}
                      id="employee-department"
                      onChange={(event) =>
                        setForm({ ...form, departmentId: event.target.value })
                      }
                      value={form.departmentId}
                    >
                      <option value="">Select Department</option>
                      {activeDepartments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.code} - {department.name}
                        </option>
                      ))}
                    </Select>
                    <FieldError controlId="employee-department" message={fieldErrors.departmentId} />
                  </Field>
                  <Field htmlFor="employee-joining-date" label="Joining Date" required>
                    <TextInput
                      {...fieldErrorProps("employee-joining-date", fieldErrors.joiningDate)}
                      id="employee-joining-date"
                      onChange={(event) =>
                        setForm({ ...form, joiningDate: event.target.value })
                      }
                      type="date"
                      value={form.joiningDate}
                    />
                    <FieldError controlId="employee-joining-date" message={fieldErrors.joiningDate} />
                  </Field>
                </div>
                {formError ? <Notice tone="error">{formError}</Notice> : null}
                <div className="flex flex-wrap gap-3">
                  <Button disabled={isSaving} type="submit">
                    {isSaving ? "Saving..." : "Create Employee"}
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
              description="Only operational list fields are returned; mobile is masked and sensitive profile details are excluded."
            />
            <div className="mt-6 overflow-x-auto">
              {employees.length === 0 ? (
                <EmptyState
                  title="No Employees found"
                  description="Change the server filters or add the first Employee after creating a Department."
                />
              ) : (
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Employee Code</th>
                      <th className="py-3 pr-4 font-medium">Name</th>
                      <th className="py-3 pr-4 font-medium">Department</th>
                      <th className="py-3 pr-4 font-medium">Designation</th>
                      <th className="py-3 pr-4 font-medium">Mobile</th>
                      <th className="py-3 pr-4 font-medium">Joining Date</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                      <th className="py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee) => (
                      <tr className="border-b border-border/80 align-top" key={employee.id}>
                        <td className="py-3 pr-4 font-mono text-xs font-semibold">
                          {employee.employeeCode}
                        </td>
                        <td className="py-3 pr-4 font-medium">{employee.fullName}</td>
                        <td className="py-3 pr-4">
                          {employee.department
                            ? `${employee.department.code} - ${employee.department.name}`
                            : "Legacy record - not assigned"}
                        </td>
                        <td className="py-3 pr-4">{employee.designation}</td>
                        <td className="py-3 pr-4 font-mono text-xs">
                          {employee.mobileNumberMasked ?? "Not completed"}
                        </td>
                        <td className="py-3 pr-4">{formatSalaryDate(employee.joiningDate)}</td>
                        <td className="py-3 pr-4">
                          <StatusBadge tone={employee.isActive ? "active" : "inactive"}>
                            {employee.isActive ? "Active" : "Inactive"}
                          </StatusBadge>
                        </td>
                        <td className="py-3">
                          <Link
                            className={buttonClassName({ variant: "ghost" })}
                            href={`/app/employees/${employee.id}`}
                          >
                            <Eye aria-hidden="true" className="size-4" />
                            View / Edit
                          </Link>
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
