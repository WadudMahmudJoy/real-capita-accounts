import { apiFetch } from "./api";

export type PayrollRunList = { items: { id: string; year: number; month: number; status: "DRAFT" | "APPROVED"; lineCount: number }[]; page: number; pageSize: number; total: number };
export const getPayrollRuns = (page: number, signal?: AbortSignal, status?: "APPROVED" | "DRAFT", period?: {year?:number;month?:number}) => apiFetch<PayrollRunList>(`/payroll-runs?page=${page}&pageSize=20${status ? `&status=${status}` : ""}${period?.year ? `&year=${period.year}` : ""}${period?.month ? `&month=${period.month}` : ""}`, { signal });

export type PayrollDocumentAmounts = Record<"grossSalary" | "totalEarnings" | "attendanceDeduction" | "providentFundDeduction" | "loanOrSalaryAdvanceDeduction" |
  "aitDeduction" | "otherDeductionsTotal" | "totalDeductions" | "netPay" | "bankPay" | "cashPay", string>;
export type PayrollDocumentEmployee = { employeeId: string; employeeCode: string; fullName: string; designation: string; departmentName: string | null };
export type PayrollDocumentContext = { runId: string; year: number; month: number; company: { name: string; legalName: string | null; currency: string };
  approvalStatus: "APPROVED"; approvedAt: string; approvalVersion: number; paymentNotice: string };
export type PayrollPayslip = PayrollDocumentContext & { employee: PayrollDocumentEmployee; earnings: { code: string; name: string; percentage: string; displayOrder: number; amount: string }[];
  amounts: PayrollDocumentAmounts; plannedAllocation: { kind: "PLANNED"; bank: string; cash: string } };
export type PayrollSalarySheet = PayrollDocumentContext & { employeeCount: number; rows: { employee: PayrollDocumentEmployee; amounts: PayrollDocumentAmounts;
  plannedAllocation: { kind: "PLANNED"; bank: string; cash: string } }[]; totals: PayrollDocumentAmounts };

export const getPayrollPayslip = (id: string, employeeId: string, signal?: AbortSignal) =>
  apiFetch<PayrollPayslip>(`/payroll-runs/${encodeURIComponent(id)}/payslips/${encodeURIComponent(employeeId)}`, { signal });
export const getPayrollSalarySheet = (id: string, signal?: AbortSignal) =>
  apiFetch<PayrollSalarySheet>(`/payroll-runs/${encodeURIComponent(id)}/salary-sheet`, { signal });
