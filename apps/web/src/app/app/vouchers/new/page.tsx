"use client";

import Link from "next/link";
import { LoadingPanel, Notice } from "../../_components/ui";
import { VoucherForm } from "../_lib/VoucherForm";
import { useVoucherReference } from "../_lib/useVoucherReference";

export default function NewVoucherPage() {
  const state = useVoucherReference();

  if (state.status === "loading") {
    return <LoadingPanel message="Loading voucher form..." />;
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="error">{state.message}</Notice>
        <Link className="text-sm font-medium underline" href="/app/vouchers">
          Back to vouchers
        </Link>
      </div>
    );
  }

  const hasFoundation =
    state.reference.fiscalYears.length > 0 &&
    state.reference.periods.length > 0 &&
    state.reference.ledgerAccounts.length > 0;

  if (!hasFoundation) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="info">
          Create at least one fiscal year, one accounting period, and one ledger
          account before recording a voucher.
        </Notice>
        <Link className="text-sm font-medium underline" href="/app/vouchers">
          Back to vouchers
        </Link>
      </div>
    );
  }

  return <VoucherForm mode="create" reference={state.reference} />;
}
