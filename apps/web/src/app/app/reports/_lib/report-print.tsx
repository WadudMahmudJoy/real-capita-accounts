"use client";

import { type ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button } from "../../_components/ui";

/**
 * Browser-print foundation shared by every approved report page.
 *
 * The on-screen UI stays unchanged; a hidden, print-only layout is rendered
 * alongside each loaded report and revealed by `@media print`. Printing is
 * triggered with `window.print()` only — no PDF generation, no Excel export,
 * and no file uploads. The look matches the voucher print foundation.
 */

/** A "Print report" button. Only meaningful after a report has loaded. */
export function PrintReportButton({
  label = "Print report",
}: {
  label?: string;
}) {
  return (
    <Button
      className="print:hidden"
      onClick={() => window.print()}
      type="button"
      variant="secondary"
    >
      <Printer aria-hidden="true" className="size-4" />
      {label}
    </Button>
  );
}

export type PrintMetaItem = { label: string; value: ReactNode };

/** Shared print table cell classes so every report prints consistently. */
export const printCell = "border border-black px-2 py-1 align-top";
export const printHeadCell =
  "border border-black px-2 py-1.5 text-left font-semibold";
export const printNumberCell =
  "border border-black px-2 py-1 text-right tabular-nums";
export const printNumberHeadCell =
  "border border-black px-2 py-1.5 text-right font-semibold";

/**
 * A professional, print-only frame for a report. Renders the Real Capita Group
 * heading, the report title, the report context (fiscal year, period or date
 * range / as-of date, and filters), the report body, the generated timestamp,
 * and prepared/checked/authorised signature placeholders.
 */
export function ReportPrintFrame({
  title,
  meta,
  children,
}: {
  title: string;
  meta: PrintMetaItem[];
  children: ReactNode;
}) {
  // This frame is rendered only after the report data arrives (client-side
  // state), so it never participates in server-side rendering or hydration.
  // Reading the clock directly here is therefore safe and cannot mismatch.
  const generatedAt = new Date().toLocaleString();

  return (
    <div className="hidden print:block print:m-0 print:p-0">
      <style>{`
        @media print {
          @page { margin: 14mm 12mm 16mm 12mm; size: A4; }
          body { visibility: hidden; }
          .print\\:block { visibility: visible; }
          .print\\:block * { visibility: visible; }
        }
      `}</style>

      <div className="mx-auto max-w-[190mm] font-sans text-xs text-black">
        {/* Header */}
        <div className="mb-4 border-b-2 border-black pb-3 text-center">
          <h2 className="text-lg font-bold uppercase tracking-wide">
            Real Capita Group
          </h2>
          <p className="mt-1 text-sm font-semibold">{title}</p>
        </div>

        {/* Report context */}
        <div className="mb-4 grid grid-cols-2 gap-x-8 gap-y-1.5">
          {meta.map((item) => (
            <div key={item.label}>
              <span className="font-semibold">{item.label}: </span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Report body */}
        <div className="mb-6">{children}</div>

        {/* Signatures */}
        <div className="mt-12 grid grid-cols-3 gap-x-8">
          <div className="border-t border-black pt-1 text-center text-xs">
            Prepared by
          </div>
          <div className="border-t border-black pt-1 text-center text-xs">
            Checked by
          </div>
          <div className="border-t border-black pt-1 text-center text-xs">
            Authorised by
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 border-t border-black pt-2 text-center text-[10px] text-gray-500">
          Real Capita Accounting &amp; Project Finance System | Generated:{" "}
          {generatedAt}
        </div>
      </div>
    </div>
  );
}
