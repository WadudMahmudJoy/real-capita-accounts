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
  getVoucher,
  toErrorMessage,
  type Voucher,
} from "@/lib/api";
import type { VoucherFormReferenceData } from "./VoucherForm";

type ReferenceState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      reference: VoucherFormReferenceData;
      voucher: Voucher | null;
    };

/**
 * Loads the dropdown reference data (and, when a voucher id is provided, the
 * voucher itself). Unauthorized responses redirect to the login screen, matching
 * the other Phase 2A pages.
 */
export function useVoucherReference(voucherId?: string): ReferenceState {
  const router = useRouter();
  const [state, setState] = useState<ReferenceState>({ status: "loading" });

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
          voucher,
        ] = await Promise.all([
          getFiscalYears(controller.signal),
          getAccountingPeriods(controller.signal),
          getLedgerAccounts(controller.signal),
          getProjects(controller.signal),
          getCostCenters(controller.signal),
          getCashBankAccounts(controller.signal),
          voucherId ? getVoucher(voucherId, controller.signal) : Promise.resolve(null),
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
          voucher,
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
  }, [router, voucherId]);

  return state;
}
