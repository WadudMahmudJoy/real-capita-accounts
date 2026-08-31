"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { ArrowLeft, Calculator, Pencil, Save, X } from "lucide-react";
import {
  ApiError,
  getDepartments,
  getEmployee,
  updateEmployee,
  type BloodGroup,
  type Department,
  type Employee,
  type EmployeeUpdateInput,
} from "@/lib/api";
import { PaymentProfilePanel } from "../../_components/payment-profile-panel";
import { SalaryAssignmentPanel } from "../../_components/salary-assignment-panel";
import {
  Detail,
  dateInputValue,
  formatSalaryDate,
  salaryErrorMessage,
} from "../../_components/salary-ui";
import {
  Button,
  buttonClassName,
  Card,
  CardHeader,
  CheckboxField,
  Field,
  LoadingPanel,
  Notice,
  PageIntro,
  Select,
  StatusBadge,
  TextArea,
  TextInput,
} from "../../_components/ui";

type EditableSection = "personal" | "contact" | "employment" | "emergency";

type EmployeeDraft = {
  fullName: string;
  bengaliName: string;
  dateOfBirth: string;
  nationalId: string;
  clearNationalId: boolean;
  bloodGroup: "" | BloodGroup;
  mobileNumber: string;
  alternateMobileNumber: string;
  personalEmail: string;
  officialEmail: string;
  presentAddress: string;
  permanentAddress: string;
  designation: string;
  departmentId: string;
  joiningDate: string;
  confirmationDate: string;
  separationDate: string;
  separationReason: string;
  isActive: boolean;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactMobile: string;
  emergencyContactAddress: string;
};

const bloodGroups: Array<{ value: BloodGroup; label: string }> = [
  { value: "A_POSITIVE", label: "A+" },
  { value: "A_NEGATIVE", label: "A-" },
  { value: "B_POSITIVE", label: "B+" },
  { value: "B_NEGATIVE", label: "B-" },
  { value: "AB_POSITIVE", label: "AB+" },
  { value: "AB_NEGATIVE", label: "AB-" },
  { value: "O_POSITIVE", label: "O+" },
  { value: "O_NEGATIVE", label: "O-" },
];

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditableSection | null>(null);
  const [draft, setDraft] = useState<EmployeeDraft | null>(null);
  const [initialDraft, setInitialDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const dirty = useMemo(
    () => Boolean(draft && JSON.stringify(draft) !== initialDraft),
    [draft, initialDraft],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const [employeeData, departmentData] = await Promise.all([
          getEmployee(params.id, signal),
          getDepartments(signal),
        ]);
        setEmployee(employeeData);
        setDepartments(departmentData);
        setError(null);
        setStatus("ready");
      } catch (caught) {
        if (signal?.aborted) return;
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }
        setError(salaryErrorMessage(caught));
        setStatus("error");
      }
    },
    [params.id, router],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function initialLoad() {
      try {
        const [employeeData, departmentData] = await Promise.all([
          getEmployee(params.id, controller.signal),
          getDepartments(controller.signal),
        ]);
        setEmployee(employeeData);
        setDepartments(departmentData);
        setError(null);
        setStatus("ready");
      } catch (caught) {
        if (controller.signal.aborted) return;
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }
        setError(salaryErrorMessage(caught));
        setStatus("error");
      }
    }
    void initialLoad();
    return () => controller.abort();
  }, [params.id, router]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  function startEdit(section: EditableSection) {
    if (!employee) return;
    if (dirty && !window.confirm("Discard unsaved changes in the current section?")) {
      return;
    }
    const nextDraft = employeeDraft(employee);
    setDraft(nextDraft);
    setInitialDraft(JSON.stringify(nextDraft));
    setEditing(section);
    setError(null);
    setSuccess(null);
  }

  function cancelEdit() {
    if (dirty && !window.confirm("Discard unsaved changes in this section?")) return;
    setEditing(null);
    setDraft(null);
    setInitialDraft("");
    setError(null);
  }

  function setDraftValue<K extends keyof EmployeeDraft>(
    key: K,
    value: EmployeeDraft[K],
  ) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function saveSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employee || !draft || !editing || isSaving) return;
    const payload = sectionPayload(editing, draft);
    if (payload instanceof Error) {
      setError(payload.message);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateEmployee(employee.id, payload);
      setEmployee(updated);
      setEditing(null);
      setDraft(null);
      setInitialDraft("");
      setSuccess("Employee section updated.");
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }
      setError(salaryErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  function guardNavigation(event: MouseEvent<HTMLAnchorElement>) {
    if (dirty && !window.confirm("Discard unsaved Employee changes and leave?")) {
      event.preventDefault();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageIntro
          title="Employee Detail"
          description="Maintain the complete Employee record in focused sections while preserving Salary Assignment and Payment Profile history."
        />
        <div className="flex flex-wrap gap-2">
          <Link
            className={buttonClassName({ variant: "ghost" })}
            href="/app/employees"
            onClick={guardNavigation}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to Employees
          </Link>
          <Link
            className={buttonClassName({ variant: "secondary" })}
            href="/app/salary-preview"
            onClick={guardNavigation}
          >
            <Calculator aria-hidden="true" className="size-4" />
            Salary Preview
          </Link>
        </div>
      </div>

      {success ? <Notice tone="success">{success}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {status === "loading" ? <LoadingPanel message="Loading Employee detail..." /> : null}
      {status === "error" ? (
        <Button className="self-start" onClick={() => void load()} variant="secondary">
          Retry
        </Button>
      ) : null}

      {status === "ready" && employee ? (
        <>
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Employee Overview</h2>
            <Card>
              <CardHeader
                title={`${employee.employeeCode} - ${employee.fullName}`}
                description="Employee Code is the immutable business identifier. System and deletion fields are not client-writable."
                actions={
                  <StatusBadge tone={employee.isActive ? "active" : "inactive"}>
                    {employee.isActive ? "Active" : "Inactive"}
                  </StatusBadge>
                }
              />
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  htmlFor="employee-code-readonly"
                  label="Employee Code (read-only)"
                >
                  <TextInput
                    aria-readonly="true"
                    id="employee-code-readonly"
                    readOnly
                    value={employee.employeeCode}
                  />
                </Field>
                <Detail label="Department">
                  {employee.department
                    ? `${employee.department.code} - ${employee.department.name}${employee.department.isActive ? "" : " (Inactive)"}`
                    : "Legacy record - not assigned"}
                </Detail>
                <Detail label="Designation">{employee.designation}</Detail>
                <Detail label="Joining Date">{formatSalaryDate(employee.joiningDate)}</Detail>
                <Detail label="Salary Assignments">{employee._count.salaryAssignments}</Detail>
                <Detail label="Payment Profiles">{employee._count.paymentProfiles}</Detail>
              </div>
            </Card>
          </div>

          <SectionCard
            description="Identity and personal facts. National ID stays masked; enter a replacement only when correction is necessary."
            editing={editing === "personal"}
            onCancel={cancelEdit}
            onEdit={() => startEdit("personal")}
            title="Personal Information"
          >
            {editing === "personal" && draft ? (
              <form className="flex flex-col gap-5" onSubmit={saveSection}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field htmlFor="personal-full-name" label="Full Name" required>
                    <TextInput
                      id="personal-full-name"
                      maxLength={200}
                      onChange={(event) => setDraftValue("fullName", event.target.value)}
                      value={draft.fullName}
                    />
                  </Field>
                  <Field htmlFor="personal-bengali-name" label="Bengali Name">
                    <TextInput
                      id="personal-bengali-name"
                      lang="bn"
                      maxLength={200}
                      onChange={(event) => setDraftValue("bengaliName", event.target.value)}
                      value={draft.bengaliName}
                    />
                  </Field>
                  <Field htmlFor="personal-dob" label="Date of Birth">
                    <TextInput
                      id="personal-dob"
                      onChange={(event) => setDraftValue("dateOfBirth", event.target.value)}
                      type="date"
                      value={draft.dateOfBirth}
                    />
                  </Field>
                  <Field htmlFor="personal-blood-group" label="Blood Group">
                    <Select
                      id="personal-blood-group"
                      onChange={(event) =>
                        setDraftValue(
                          "bloodGroup",
                          event.target.value as EmployeeDraft["bloodGroup"],
                        )
                      }
                      value={draft.bloodGroup}
                    >
                      <option value="">Not recorded</option>
                      {bloodGroups.map((group) => (
                        <option key={group.value} value={group.value}>
                          {group.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    className="sm:col-span-2"
                    htmlFor="personal-nid"
                    label="Replace National ID"
                    hint={
                      employee.hasNationalId
                        ? `Current value: ${employee.nationalIdMasked}. Leave blank to keep it.`
                        : "The full National ID is never loaded into this form."
                    }
                  >
                    <TextInput
                      autoComplete="off"
                      disabled={draft.clearNationalId}
                      id="personal-nid"
                      inputMode="numeric"
                      maxLength={25}
                      onChange={(event) => setDraftValue("nationalId", event.target.value)}
                      placeholder="10 to 17 digits; spaces and hyphens are normalized"
                      value={draft.nationalId}
                    />
                  </Field>
                </div>
                {employee.hasNationalId ? (
                  <CheckboxField
                    checked={draft.clearNationalId}
                    description="Use only to correct an Employee record that should not retain a National ID."
                    id="personal-clear-nid"
                    label="Clear the stored National ID"
                    onChange={(checked) => {
                      setDraftValue("clearNationalId", checked);
                      if (checked) setDraftValue("nationalId", "");
                    }}
                  />
                ) : null}
                <SectionActions disabled={isSaving} onCancel={cancelEdit} />
              </form>
            ) : (
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Full Name">{employee.fullName}</Detail>
                <Detail label="Bengali Name">{employee.bengaliName ?? "-"}</Detail>
                <Detail label="Date of Birth">{formatSalaryDate(employee.dateOfBirth)}</Detail>
                <Detail label="Blood Group">{bloodGroupLabel(employee.bloodGroup)}</Detail>
                <Detail label="National ID">
                  {employee.nationalIdMasked ?? "Not recorded"}
                </Detail>
              </dl>
            )}
          </SectionCard>

          <SectionCard
            description="Authorized contact details. The Employee list receives only a masked mobile projection."
            editing={editing === "contact"}
            onCancel={cancelEdit}
            onEdit={() => startEdit("contact")}
            title="Contact Information"
          >
            {editing === "contact" && draft ? (
              <form className="flex flex-col gap-5" onSubmit={saveSection}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field htmlFor="contact-mobile" label="Mobile Number" required>
                    <TextInput
                      autoComplete="tel"
                      id="contact-mobile"
                      inputMode="tel"
                      onChange={(event) => setDraftValue("mobileNumber", event.target.value)}
                      value={draft.mobileNumber}
                    />
                  </Field>
                  <Field htmlFor="contact-alt-mobile" label="Alternate Mobile">
                    <TextInput
                      autoComplete="tel"
                      id="contact-alt-mobile"
                      inputMode="tel"
                      onChange={(event) =>
                        setDraftValue("alternateMobileNumber", event.target.value)
                      }
                      value={draft.alternateMobileNumber}
                    />
                  </Field>
                  <Field htmlFor="contact-personal-email" label="Personal Email">
                    <TextInput
                      autoComplete="email"
                      id="contact-personal-email"
                      maxLength={320}
                      onChange={(event) => setDraftValue("personalEmail", event.target.value)}
                      type="email"
                      value={draft.personalEmail}
                    />
                  </Field>
                  <Field htmlFor="contact-official-email" label="Official Email">
                    <TextInput
                      autoComplete="off"
                      id="contact-official-email"
                      maxLength={320}
                      onChange={(event) => setDraftValue("officialEmail", event.target.value)}
                      type="email"
                      value={draft.officialEmail}
                    />
                  </Field>
                  <Field htmlFor="contact-present-address" label="Present Address">
                    <TextArea
                      id="contact-present-address"
                      maxLength={1000}
                      onChange={(event) => setDraftValue("presentAddress", event.target.value)}
                      value={draft.presentAddress}
                    />
                  </Field>
                  <Field htmlFor="contact-permanent-address" label="Permanent Address">
                    <TextArea
                      id="contact-permanent-address"
                      maxLength={1000}
                      onChange={(event) =>
                        setDraftValue("permanentAddress", event.target.value)
                      }
                      value={draft.permanentAddress}
                    />
                  </Field>
                </div>
                <SectionActions disabled={isSaving} onCancel={cancelEdit} />
              </form>
            ) : (
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Mobile Number">{employee.mobileNumber ?? "Not completed"}</Detail>
                <Detail label="Alternate Mobile">{employee.alternateMobileNumber ?? "-"}</Detail>
                <Detail label="Personal Email">{employee.personalEmail ?? "-"}</Detail>
                <Detail label="Official Email">{employee.officialEmail ?? "-"}</Detail>
                <Detail label="Present Address">{employee.presentAddress ?? "-"}</Detail>
                <Detail label="Permanent Address">{employee.permanentAddress ?? "-"}</Detail>
              </dl>
            )}
          </SectionCard>

          <SectionCard
            description="Department, designation, employment dates, separation correction, and operational eligibility."
            editing={editing === "employment"}
            onCancel={cancelEdit}
            onEdit={() => startEdit("employment")}
            title="Employment Information"
          >
            {editing === "employment" && draft ? (
              <form className="flex flex-col gap-5" onSubmit={saveSection}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field htmlFor="employment-designation" label="Designation" required>
                    <TextInput
                      id="employment-designation"
                      maxLength={150}
                      onChange={(event) => setDraftValue("designation", event.target.value)}
                      value={draft.designation}
                    />
                  </Field>
                  <Field htmlFor="employment-department" label="Department" required>
                    <Select
                      id="employment-department"
                      onChange={(event) => setDraftValue("departmentId", event.target.value)}
                      value={draft.departmentId}
                    >
                      <option value="">Select Department</option>
                      {departments.map((department) => (
                        <option
                          disabled={!department.isActive && department.id !== employee.departmentId}
                          key={department.id}
                          value={department.id}
                        >
                          {department.code} - {department.name}
                          {department.isActive ? "" : " (Inactive - historical)"}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field htmlFor="employment-joining" label="Joining Date" required>
                    <TextInput
                      id="employment-joining"
                      onChange={(event) => setDraftValue("joiningDate", event.target.value)}
                      type="date"
                      value={draft.joiningDate}
                    />
                  </Field>
                  <Field htmlFor="employment-confirmation" label="Confirmation Date">
                    <TextInput
                      id="employment-confirmation"
                      onChange={(event) =>
                        setDraftValue("confirmationDate", event.target.value)
                      }
                      type="date"
                      value={draft.confirmationDate}
                    />
                  </Field>
                  <Field htmlFor="employment-separation" label="Separation Date">
                    <TextInput
                      id="employment-separation"
                      onChange={(event) => {
                        setDraftValue("separationDate", event.target.value);
                        if (event.target.value) setDraftValue("isActive", false);
                      }}
                      type="date"
                      value={draft.separationDate}
                    />
                  </Field>
                  <Field htmlFor="employment-separation-reason" label="Separation Reason">
                    <TextArea
                      id="employment-separation-reason"
                      maxLength={500}
                      onChange={(event) =>
                        setDraftValue("separationReason", event.target.value)
                      }
                      value={draft.separationReason}
                    />
                  </Field>
                </div>
                <CheckboxField
                  checked={draft.isActive}
                  description={
                    draft.separationDate
                      ? "A formally separated Employee cannot be active. Clear an erroneous separation first to reactivate."
                      : "Inactive Employees retain history but cannot approve new Salary configurations."
                  }
                  disabled={Boolean(draft.separationDate)}
                  id="employment-active"
                  label="Active Employee"
                  onChange={(checked) => setDraftValue("isActive", checked)}
                />
                <SectionActions disabled={isSaving} onCancel={cancelEdit} />
              </form>
            ) : (
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Designation">{employee.designation}</Detail>
                <Detail label="Department">
                  {employee.department
                    ? `${employee.department.code} - ${employee.department.name}`
                    : "Not completed"}
                </Detail>
                <Detail label="Joining Date">{formatSalaryDate(employee.joiningDate)}</Detail>
                <Detail label="Confirmation Date">
                  {formatSalaryDate(employee.confirmationDate)}
                </Detail>
                <Detail label="Separation Date">
                  {formatSalaryDate(employee.separationDate)}
                </Detail>
                <Detail label="Separation Reason">{employee.separationReason ?? "-"}</Detail>
                <Detail label="Operational Status">
                  {employee.isActive ? "Active" : "Inactive"}
                </Detail>
              </dl>
            )}
          </SectionCard>

          <SectionCard
            description="One embedded emergency contact. Name, relationship, and mobile are completed together."
            editing={editing === "emergency"}
            onCancel={cancelEdit}
            onEdit={() => startEdit("emergency")}
            title="Emergency Contact"
          >
            {editing === "emergency" && draft ? (
              <form className="flex flex-col gap-5" onSubmit={saveSection}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field htmlFor="emergency-name" label="Name">
                    <TextInput
                      id="emergency-name"
                      maxLength={200}
                      onChange={(event) =>
                        setDraftValue("emergencyContactName", event.target.value)
                      }
                      value={draft.emergencyContactName}
                    />
                  </Field>
                  <Field htmlFor="emergency-relationship" label="Relationship">
                    <TextInput
                      id="emergency-relationship"
                      maxLength={100}
                      onChange={(event) =>
                        setDraftValue("emergencyContactRelationship", event.target.value)
                      }
                      value={draft.emergencyContactRelationship}
                    />
                  </Field>
                  <Field htmlFor="emergency-mobile" label="Mobile">
                    <TextInput
                      id="emergency-mobile"
                      inputMode="tel"
                      onChange={(event) =>
                        setDraftValue("emergencyContactMobile", event.target.value)
                      }
                      value={draft.emergencyContactMobile}
                    />
                  </Field>
                  <Field htmlFor="emergency-address" label="Address">
                    <TextArea
                      id="emergency-address"
                      maxLength={1000}
                      onChange={(event) =>
                        setDraftValue("emergencyContactAddress", event.target.value)
                      }
                      value={draft.emergencyContactAddress}
                    />
                  </Field>
                </div>
                <SectionActions disabled={isSaving} onCancel={cancelEdit} />
              </form>
            ) : (
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Name">{employee.emergencyContactName ?? "-"}</Detail>
                <Detail label="Relationship">
                  {employee.emergencyContactRelationship ?? "-"}
                </Detail>
                <Detail label="Mobile">{employee.emergencyContactMobile ?? "-"}</Detail>
                <Detail label="Address">{employee.emergencyContactAddress ?? "-"}</Detail>
              </dl>
            )}
          </SectionCard>

          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-semibold">Salary Configuration</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Existing effective-dated Salary Assignment and Payment Profile sources remain unchanged.
              </p>
            </div>
            <SalaryAssignmentPanel
              employeeActive={employee.isActive}
              employeeId={employee.id}
            />
            <PaymentProfilePanel
              employeeActive={employee.isActive}
              employeeId={employee.id}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function SectionCard({
  title,
  description,
  editing,
  onEdit,
  children,
}: {
  title: string;
  description: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        actions={
          editing ? null : (
            <Button onClick={onEdit} variant="secondary">
              <Pencil aria-hidden="true" className="size-4" />
              Edit Section
            </Button>
          )
        }
      />
      <div className="mt-6">{children}</div>
    </Card>
  );
}

function SectionActions({
  disabled,
  onCancel,
}: {
  disabled: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button disabled={disabled} type="submit">
        <Save aria-hidden="true" className="size-4" />
        {disabled ? "Saving..." : "Save Section"}
      </Button>
      <Button disabled={disabled} onClick={onCancel} variant="secondary">
        <X aria-hidden="true" className="size-4" />
        Cancel
      </Button>
    </div>
  );
}

function employeeDraft(employee: Employee): EmployeeDraft {
  return {
    fullName: employee.fullName,
    bengaliName: employee.bengaliName ?? "",
    dateOfBirth: dateInputValue(employee.dateOfBirth),
    nationalId: "",
    clearNationalId: false,
    bloodGroup: employee.bloodGroup ?? "",
    mobileNumber: employee.mobileNumber ?? "",
    alternateMobileNumber: employee.alternateMobileNumber ?? "",
    personalEmail: employee.personalEmail ?? "",
    officialEmail: employee.officialEmail ?? "",
    presentAddress: employee.presentAddress ?? "",
    permanentAddress: employee.permanentAddress ?? "",
    designation: employee.designation,
    departmentId: employee.departmentId ?? "",
    joiningDate: dateInputValue(employee.joiningDate),
    confirmationDate: dateInputValue(employee.confirmationDate),
    separationDate: dateInputValue(employee.separationDate),
    separationReason: employee.separationReason ?? "",
    isActive: employee.isActive,
    emergencyContactName: employee.emergencyContactName ?? "",
    emergencyContactRelationship: employee.emergencyContactRelationship ?? "",
    emergencyContactMobile: employee.emergencyContactMobile ?? "",
    emergencyContactAddress: employee.emergencyContactAddress ?? "",
  };
}

function sectionPayload(
  section: EditableSection,
  draft: EmployeeDraft,
): EmployeeUpdateInput | Error {
  if (section === "personal") {
    if (!draft.fullName.trim()) return new Error("Full Name is required.");
    const payload: EmployeeUpdateInput = {
      fullName: draft.fullName.trim(),
      bengaliName: draft.bengaliName.trim() || null,
      dateOfBirth: draft.dateOfBirth || null,
      bloodGroup: draft.bloodGroup || null,
    };
    if (draft.clearNationalId) payload.nationalId = null;
    else if (draft.nationalId.trim()) payload.nationalId = draft.nationalId.trim();
    return payload;
  }

  if (section === "contact") {
    if (!draft.mobileNumber.trim()) return new Error("Mobile Number is required.");
    return {
      mobileNumber: draft.mobileNumber.trim(),
      alternateMobileNumber: draft.alternateMobileNumber.trim() || null,
      personalEmail: draft.personalEmail.trim() || null,
      officialEmail: draft.officialEmail.trim() || null,
      presentAddress: draft.presentAddress.trim() || null,
      permanentAddress: draft.permanentAddress.trim() || null,
    };
  }

  if (section === "employment") {
    if (!draft.designation.trim()) return new Error("Designation is required.");
    if (!draft.departmentId) return new Error("Department is required.");
    if (!draft.joiningDate) return new Error("Joining Date is required.");
    if (draft.separationDate && !draft.separationReason.trim()) {
      return new Error("Separation Reason is required with Separation Date.");
    }
    if (!draft.separationDate && draft.separationReason.trim()) {
      return new Error("Separation Date is required with Separation Reason.");
    }
    if (draft.separationDate && draft.isActive) {
      return new Error("A formally separated Employee must be inactive.");
    }
    return {
      designation: draft.designation.trim(),
      departmentId: draft.departmentId,
      joiningDate: draft.joiningDate,
      confirmationDate: draft.confirmationDate || null,
      separationDate: draft.separationDate || null,
      separationReason: draft.separationReason.trim() || null,
      isActive: draft.isActive,
    };
  }

  const required = [
    draft.emergencyContactName.trim(),
    draft.emergencyContactRelationship.trim(),
    draft.emergencyContactMobile.trim(),
  ];
  if (required.some(Boolean) && required.some((value) => !value)) {
    return new Error(
      "Emergency Contact Name, Relationship, and Mobile are required together.",
    );
  }
  return {
    emergencyContactName: required[0] || null,
    emergencyContactRelationship: required[1] || null,
    emergencyContactMobile: required[2] || null,
    emergencyContactAddress: draft.emergencyContactAddress.trim() || null,
  };
}

function bloodGroupLabel(value: BloodGroup | null): string {
  return bloodGroups.find((group) => group.value === value)?.label ?? "-";
}
