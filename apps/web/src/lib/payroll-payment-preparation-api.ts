import { apiFetch } from "./api";
export type PaymentChannel = "BANK" | "CASH";
export type PaymentPreparation = {
  runId: string; year: number; month: number; company: { name: string; legalName: string | null; currency: string };
  channel: PaymentChannel; status: "PREPARATION_NOT_DISBURSED"; canDisburse: false; employeeCount: number;
  sourceAuthorizationVerified?: boolean;
  rows: { employeeId: string; employeeCode: string; fullName: string; plannedAmount: string; selectable: boolean }[];
  totalPlanned: string; bankTotal: string; cashTotal: string; payrollNetTotal: string;
  sourceAccounts: { id: string; displayName: string; ledgerCode: string; registryScope: "GLOBAL_UNVERIFIED" }[];
  blockers: { code: string; message: string }[]; notice: string;
};
export function getPayrollPaymentPreparation(id: string, channel: PaymentChannel, sourceAccountId: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ channel }); if (sourceAccountId) query.set("sourceAccountId", sourceAccountId);
  return apiFetch<PaymentPreparation>(`/payroll-runs/${encodeURIComponent(id)}/payment-preparation?${query}`, { signal });
}
