"use client";
import { useParams } from "next/navigation";
import { PayrollDocumentWorkspace } from "../../../_components/payroll-document-workspace";
export default function PayrollPayslipPage() {
  const params = useParams<{ id: string; employeeId: string }>();
  return <PayrollDocumentWorkspace runId={params.id} employeeId={params.employeeId} />;
}
