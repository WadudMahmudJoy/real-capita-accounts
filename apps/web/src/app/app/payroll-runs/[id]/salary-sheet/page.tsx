"use client";
import { useParams } from "next/navigation";
import { PayrollDocumentWorkspace } from "../../_components/payroll-document-workspace";
export default function PayrollSalarySheetPage() {
  const params = useParams<{ id: string }>(); return <PayrollDocumentWorkspace runId={params.id} />;
}
