"use client";

import { type ReactNode } from "react";
import { Printer } from "lucide-react";
import { companyMediaUrl, type ReportCompanySummary } from "@/lib/api";
import { Button } from "../../_components/ui";

/**
 * Browser-print foundation shared by every approved report page.
 *
 * The on-screen UI stays unchanged; a hidden, print-only layout is rendered
 * alongside each loaded report and revealed by `@media print`. Printing is
 * triggered with `window.print()` only — no PDF generation, no Excel export,
 * and no file uploads. The look matches the voucher print foundation.
 */

export const FALLBACK_REPORT_HEADING = "Real Capita Group";

/**
 * Document-company heading for the owning company of the report's fiscal
 * year: the configured print header name, then the company name, then the
 * legacy Real Capita heading so unconfigured rows keep today's appearance.
 */
export function resolveOwnerHeading(
  company: Pick<ReportCompanySummary, "name" | "printHeaderName"> | null,
): string {
  return (
    company?.printHeaderName ?? company?.name ?? FALLBACK_REPORT_HEADING
  );
}

/**
 * Print-logo URL from the public company media endpoint, cache-busted by the
 * owner company's updatedAt revision. The stored printLogoPath is only a
 * presence signal; a null path keeps the legacy no-logo layout.
 */
export function ownerPrintLogoSrc(
  company: Pick<ReportCompanySummary, "id" | "printLogoPath" | "updatedAt">,
): string | null {
  if (company.printLogoPath == null) {
    return null;
  }
  const revision = Date.parse(company.updatedAt);
  return companyMediaUrl(
    company.id,
    "print-logo",
    Number.isNaN(revision) ? 0 : revision,
  );
}

/** Existing owner contact values only — missing values render nothing. */
export function ownerContactItems(
  company: Pick<ReportCompanySummary, "phone" | "email" | "address">,
): string[] {
  return [company.phone, company.email, company.address].filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
}

/** Configured owner-company footer text, or null for the legacy footer. */
export function resolveOwnerFooterText(
  company: Pick<ReportCompanySummary, "printFooterText">,
): string | null {
  const trimmed = company.printFooterText?.trim();
  return trimmed ? trimmed : null;
}

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
 * A professional, print-only frame for a report. Renders the owning
 * company's document branding (heading, optional print logo, contact line),
 * the report title, the report context (fiscal year, period or date range /
 * as-of date, and filters), the report body, an optional owner-company
 * footer line, the fixed platform footer with the generated timestamp, and
 * prepared/checked/authorised signature placeholders.
 *
 * Branding derives ONLY from `ownerCompany` — the company that owns the
 * report's fiscal year — never from the currently active office.
 */
export function ReportPrintFrame({
  title,
  meta,
  ownerCompany,
  children,
}: {
  title: string;
  meta: PrintMetaItem[];
  ownerCompany: ReportCompanySummary;
  children: ReactNode;
}) {
  // This frame is rendered only after the report data arrives (client-side
  // state), so it never participates in server-side rendering or hydration.
  // Reading the clock directly here is therefore safe and cannot mismatch.
  const generatedAt = new Date().toLocaleString();

  const hasPrintLogo = ownerCompany.printLogoPath != null;
  const logoSrc = hasPrintLogo ? ownerPrintLogoSrc(ownerCompany) : null;
  const heading = resolveOwnerHeading(ownerCompany);
  const contactItems = ownerContactItems(ownerCompany);
  const ownerFooterText = resolveOwnerFooterText(ownerCompany);

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
        <div className="mb-4 border-b-2 border-black pb-3">
          <div className="flex items-center gap-4">
            {hasPrintLogo && logoSrc ? (
              /* Plain <img> for print reliability, matching the voucher
                  print foundation. onError hides the slot so a broken or
                  missing asset never leaves a broken-image icon or a large
                  blank area. */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                alt=""
                className="h-12 w-24 shrink-0 object-contain object-left"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
                src={logoSrc}
              />
            ) : null}
            <div className="min-w-0 flex-1 text-center">
              <h2 className="text-lg font-bold uppercase tracking-wide">
                {heading}
              </h2>
              {contactItems.length > 0 ? (
                <p className="mt-0.5 text-[9px] leading-4 text-gray-700">
                  {contactItems.join(" | ")}
                </p>
              ) : null}
              <p className="mt-1 text-sm font-semibold">{title}</p>
            </div>
          </div>
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

        {/* Footer: optional owner-company line above the fixed platform
            footer, which always remains. */}
        <div className="mt-6 border-t border-black pt-2 text-center text-[10px] text-gray-500">
          {ownerFooterText ? (
            <p className="text-gray-700">{ownerFooterText}</p>
          ) : null}
          <p>
            Real Capita Accounting &amp; Project Finance System | Generated:{" "}
            {generatedAt}
          </p>
        </div>
      </div>
    </div>
  );
}
