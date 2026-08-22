"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Calculator, ChevronRight } from "lucide-react";
import { ApiError, getEmployee, type Employee } from "@/lib/api";
import { PaymentProfilePanel } from "../../_components/payment-profile-panel";
import { SalaryAssignmentPanel } from "../../_components/salary-assignment-panel";
import {
  Detail,
  formatSalaryDate,
  salaryErrorMessage,
} from "../../_components/salary-ui";
import {
  buttonClassName,
  Card,
  CardHeader,
  LoadingPanel,
  Notice,
  PageIntro,
  StatusBadge,
} from "../../_components/ui";

export default function EmployeeSalaryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setEmployee(await getEmployee(params.id, controller.signal));
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
    void load();
    return () => controller.abort();
  }, [params.id, router]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageIntro
          title="Employee Salary Configuration"
          description="Manage effective-dated Salary Assignment and Payment Profile records for one employee. This workspace does not run or pay payroll."
        />
        <div className="flex flex-wrap gap-2">
          <Link className={buttonClassName({ variant: "ghost" })} href="/app/employees"><ArrowLeft aria-hidden="true" className="size-4" />Back to Employees</Link>
          <Link className={buttonClassName({ variant: "secondary" })} href="/app/salary-preview"><Calculator aria-hidden="true" className="size-4" />Salary Preview</Link>
        </div>
      </div>

      <nav aria-label="Salary configuration workflow" className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs font-medium text-muted-foreground">
        <span className="text-foreground">Employee</span><ChevronRight aria-hidden="true" className="size-3" /><span>Salary Structure</span><ChevronRight aria-hidden="true" className="size-3" /><span>Salary Assignment</span><ChevronRight aria-hidden="true" className="size-3" /><span>Payment Profile</span><ChevronRight aria-hidden="true" className="size-3" /><span>Salary Preview</span>
      </nav>

      {status === "loading" ? <LoadingPanel message="Loading Employee Salary configuration..." /> : null}
      {status === "error" ? <Notice tone="error">{error}</Notice> : null}

      {status === "ready" && employee ? (
        <>
          <Card>
            <CardHeader
              title={`${employee.employeeCode} - ${employee.fullName}`}
              description="Employee identity used by Salary Foundation. Edit master details from the Employees page."
              actions={<StatusBadge tone={employee.isActive ? "active" : "inactive"}>{employee.isActive ? "Active" : "Inactive"}</StatusBadge>}
            />
            <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="Employee Code">{employee.employeeCode}</Detail>
              <Detail label="Employee Name">{employee.fullName}</Detail>
              <Detail label="Designation">{employee.designation}</Detail>
              <Detail label="Joining Date">{formatSalaryDate(employee.joiningDate)}</Detail>
            </dl>
          </Card>

          <SalaryAssignmentPanel employeeActive={employee.isActive} employeeId={employee.id} />
          <PaymentProfilePanel employeeActive={employee.isActive} employeeId={employee.id} />
        </>
      ) : null}
    </div>
  );
}
