"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { LoadingPanel, Notice } from "../../_components/ui";
import { VoucherForm } from "../_lib/VoucherForm";
import { useVoucherReference } from "../_lib/useVoucherReference";

export default function VoucherDetailPage() {
  const params = useParams<{ id: string }>();
  const voucherId = typeof params.id === "string" ? params.id : "";
  const state = useVoucherReference(voucherId);

  if (state.status === "loading") {
    return <LoadingPanel message="Loading voucher..." />;
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

  if (!state.voucher) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="error">Voucher was not found.</Notice>
        <Link className="text-sm font-medium underline" href="/app/vouchers">
          Back to vouchers
        </Link>
      </div>
    );
  }

  return (
    <VoucherForm
      mode="edit"
      reference={state.reference}
      voucher={state.voucher}
    />
  );
}
