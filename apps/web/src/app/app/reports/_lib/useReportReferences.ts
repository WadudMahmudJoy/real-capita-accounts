"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getAccountingPeriods,
  getCashBankAccounts,
  getCostCenters,
  getFiscalYears,
  getLedgerAccounts,
  getProjects,
  toErrorMessage,
  type AccountingPeriod,
  type CashBankAccount,
  type CostCenter,
  type FiscalYear,
  type LedgerAccount,
  type Project,
} from "@/lib/api";

/**
 * Foundation reference data used to populate report filter dropdowns. The
 * report pages never create or mutate these resources; they only read the
 * existing fiscal years, periods, ledger accounts, projects, cost centers, and
 * cash/bank accounts so the accountant can scope a report.
 */
export type ReportReferenceData = {
  fiscalYears: FiscalYear[];
  periods: AccountingPeriod[];
  ledgerAccounts: LedgerAccount[];
  projects: Project[];
  costCenters: CostCenter[];
  cashBankAccounts: CashBankAccount[];
};

export type ReportReferenceState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; reference: ReportReferenceData };

/**
 * Loads the dropdown reference data for the report pages. Unauthorized
 * responses redirect to the login screen, matching the other app pages.
 */
export function useReportReferences(): ReportReferenceState {
  const router = useRouter();
  const [state, setState] = useState<ReportReferenceState>({
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [
          fiscalYears,
          periods,
          ledgerAccounts,
          projects,
          costCenters,
          cashBankAccounts,
        ] = await Promise.all([
          getFiscalYears(controller.signal),
          getAccountingPeriods(controller.signal),
          getLedgerAccounts(controller.signal),
          getProjects(controller.signal),
          getCostCenters(controller.signal),
          getCashBankAccounts(controller.signal),
        ]);

        setState({
          reference: {
            cashBankAccounts,
            costCenters,
            fiscalYears,
            ledgerAccounts,
            periods,
            projects,
          },
          status: "ready",
        });
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }

        setState({ message: toErrorMessage(caught), status: "error" });
      }
    }

    void load();

    return () => controller.abort();
  }, [router]);

  return state;
}
