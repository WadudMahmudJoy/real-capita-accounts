"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { getCompany, type Company, type Voucher } from "@/lib/api";
import {
  cashBankLabel,
  formatDate,
  formatMoney,
  toAmount,
  voucherTypeTitle,
} from "../voucher-ui";
import { amountToWords } from "./amount-to-words";
import { toPrintBrand } from "./print-brand";
import { VoucherPrintHeader } from "./VoucherPrintHeader";

const subscribeToNothing = () => () => {};

/** Client-only gate so the body portal is never touched during SSR. */
function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

/**
 * Print-only premium voucher document.
 *
 * Rendered through a portal attached directly under document.body. During
 * print, every other direct body child is removed from print layout with
 * display:none, so the voucher is the only printable content and starts on
 * page 1. A visibility-only approach keeps the application shell in document
 * flow and produces blank leading pages plus mid-table page splits.
 */
export function VoucherPrintDocument({ voucher }: { voucher: Voucher }) {
  const isClient = useIsClient();
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getCompany(controller.signal)
      .then((existing) => {
        if (!controller.signal.aborted) {
          setCompany(existing);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCompany(null);
        }
      });

    return () => controller.abort();
  }, []);

  if (!isClient) {
    return null;
  }

  const brand = toPrintBrand(company);
  const totalDebit = toAmount(voucher.totalDebit);
  const totalCredit = toAmount(voucher.totalCredit);

  return createPortal(
    <div data-voucher-print-root="">
      <style>{`
        [data-voucher-print-root] { display: none; }

        @media print {
          @page { margin: 10mm 12mm; size: A4 portrait; }
          body > *:not([data-voucher-print-root]) { display: none !important; }
          [data-voucher-print-root] { display: block; }
        }
      `}</style>

      <div className="relative w-full font-sans text-[11px] text-[#1c2733]">
        {/* Plain <img> for print reliability: optimized images can stay
            unloaded inside containers that are display:none on screen.
            position:fixed keeps the watermark behind the content on every
            printed page in Chrome/Edge print pipelines. It is anchored to
            the upper content band so its emphasis stays behind the
            narration, transaction table, and totals rather than the
            signature block and footer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          aria-hidden="true"
          className="pointer-events-none fixed left-0 right-0 top-[30mm] z-0 mx-auto h-[105mm] w-[165mm] object-contain opacity-[0.04] [-webkit-print-color-adjust:exact] [print-color-adjust:exact]"
          src="/brand/voucher-watermark.svg"
        />

        <div className="relative z-10">
          <VoucherPrintHeader brand={brand} />

          <h1 className="mt-3 bg-[#16324f] px-4 py-1.5 text-center text-lg font-bold uppercase tracking-[0.22em] text-white [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
            {voucherTypeTitle(voucher.voucherType)}
          </h1>

          <div className="mt-3 grid grid-cols-2 gap-x-12">
            <div className="flex flex-col gap-1">
              <p>
                <span className="font-semibold">Voucher No.:</span>{" "}
                {voucher.systemVoucherNo}
              </p>
              <p>
                <span className="font-semibold">Fiscal Year:</span>{" "}
                {voucher.fiscalYear?.name ?? "-"}
              </p>
              <p>
                <span className="font-semibold">Accounting Period:</span>{" "}
                {voucher.accountingPeriod?.name ?? "-"}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p>
                <span className="font-semibold">Date:</span>{" "}
                {formatDate(voucher.voucherDate)}
              </p>
              {voucher.physicalSiNo ? (
                <p>
                  <span className="font-semibold">Ref. No. (Physical SI):</span>{" "}
                  {voucher.physicalSiNo}
                </p>
              ) : null}
              <p>
                <span className="font-semibold">Status:</span> {voucher.status}
              </p>
              {voucher.postedBy ? (
                <p>
                  <span className="font-semibold">Posted by:</span>{" "}
                  {voucher.postedBy.fullName}
                </p>
              ) : null}
            </div>
          </div>

          {voucher.narration ? (
            <div className="mt-3 border-l-4 border-[#16324f] bg-[#f5f8fa] px-3 py-2 [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#16324f]">
                Narration
              </p>
              <p className="mt-1 leading-relaxed">{voucher.narration}</p>
            </div>
          ) : null}

          <table className="mt-3 w-full table-fixed border-collapse text-[11px]">
            <thead className="table-header-group">
              <tr className="bg-[#16324f] text-white [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
                <th className="w-[12mm] border border-[#16324f] px-2 py-1.5 text-center font-semibold">
                  SL
                </th>
                <th className="border border-[#16324f] px-2 py-1.5 text-left font-semibold">
                  Particulars
                </th>
                <th className="w-[27mm] border border-[#16324f] px-2 py-1.5 text-right font-semibold">
                  Debit
                </th>
                <th className="w-[27mm] border border-[#16324f] px-2 py-1.5 text-right font-semibold">
                  Credit
                </th>
              </tr>
            </thead>
            <tbody>
              {(voucher.lines ?? []).map((line) => (
                <tr key={line.id} className="align-top break-inside-avoid">
                  <td className="border border-[#b9c6d2] px-2 py-1.5 text-center tabular-nums">
                    {line.lineNo}
                  </td>
                  <td className="border border-[#b9c6d2] px-2 py-1.5">
                    <p className="font-medium text-[#1c2733]">
                      {line.ledgerAccount
                        ? `${line.ledgerAccount.code} — ${line.ledgerAccount.name}`
                        : "-"}
                    </p>
                    {line.description ? (
                      <p className="mt-0.5 text-[10px] leading-4 text-[#4c5b68]">
                        {line.description}
                      </p>
                    ) : null}
                    {line.project ? (
                      <p className="text-[10px] leading-4 text-[#4c5b68]">
                        Project: {line.project.code} — {line.project.name}
                      </p>
                    ) : null}
                    {line.costCenter ? (
                      <p className="text-[10px] leading-4 text-[#4c5b68]">
                        Cost Center: {line.costCenter.code} —{" "}
                        {line.costCenter.name}
                      </p>
                    ) : null}
                    {line.cashBankAccount ? (
                      <p className="text-[10px] leading-4 text-[#4c5b68]">
                        Cash/Bank/MFS: {cashBankLabel(line.cashBankAccount)}
                      </p>
                    ) : null}
                  </td>
                  <td className="border border-[#b9c6d2] px-2 py-1.5 text-right tabular-nums">
                    {line.side === "DEBIT" ? formatMoney(line.amount) : ""}
                  </td>
                  <td className="border border-[#b9c6d2] px-2 py-1.5 text-right tabular-nums">
                    {line.side === "CREDIT" ? formatMoney(line.amount) : ""}
                  </td>
                </tr>
              ))}
              <tr className="break-inside-avoid font-semibold">
                <td
                  className="border border-[#16324f] bg-[#e9eff4] px-2 py-1.5 text-right [-webkit-print-color-adjust:exact] [print-color-adjust:exact]"
                  colSpan={2}
                >
                  Total
                </td>
                <td className="border border-[#16324f] bg-[#e9eff4] px-2 py-1.5 text-right tabular-nums [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
                  {formatMoney(totalDebit)}
                </td>
                <td className="border border-[#16324f] bg-[#e9eff4] px-2 py-1.5 text-right tabular-nums [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
                  {formatMoney(totalCredit)}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="mt-3 break-inside-avoid">
            <span className="font-semibold">Total Tk. (In Words):</span>{" "}
            <span className="italic">{amountToWords(totalDebit)} only.</span>
          </p>

          <div className="mt-14 grid grid-cols-4 gap-10 break-inside-avoid">
            <div className="text-center">
              <div className="border-t border-[#33404d] pt-1 text-[10px] font-medium">
                Received By
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-[#33404d] pt-1 text-[10px] font-medium">
                Prepared By
              </div>
              <p className="mt-0.5 text-[9px] text-[#4c5b68]">
                {voucher.createdBy?.fullName ?? ""}
              </p>
            </div>
            <div className="text-center">
              <div className="border-t border-[#33404d] pt-1 text-[10px] font-medium">
                Checked By
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-[#33404d] pt-1 text-[10px] font-medium">
                Approved By
              </div>
            </div>
          </div>

          <p className="mt-5 break-inside-avoid border-t border-[#b9c6d2] pt-2 text-center text-[8px] text-[#8a97a3]">
            Generated by Real Capita Accounting &amp; Project Finance System
            {voucher.postingDate
              ? ` | Posted: ${formatDate(voucher.postingDate)}`
              : ""}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
