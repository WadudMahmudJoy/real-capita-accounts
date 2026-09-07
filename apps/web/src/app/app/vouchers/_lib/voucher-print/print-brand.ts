import { companyMediaUrl, type Company } from "@/lib/api";

export const FALLBACK_LOGO_SRC = "/brand/real-capita-group-wordmark.png";

/** Structural company shape consumed by the print brand (owner company). */
type PrintBrandCompany = Pick<
  Company,
  | "id"
  | "name"
  | "legalName"
  | "address"
  | "phone"
  | "email"
  | "currency"
  | "printLogoPath"
  | "printHeaderName"
  | "updatedAt"
>;

export type PrintBrand = {
  companyName: string | null;
  legalName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  logoSrc: string;
};

/**
 * Builds the print brand from the VOUCHER-OWNING company (never the current
 * session company). `printHeaderName` is preferred for the document header
 * name with the company name as fallback; the print logo is served from the
 * public company media endpoint (cache-busted by the owner company's
 * updatedAt revision) whenever `printLogoPath` signals one exists — the
 * stored path itself is never rendered. A missing logo keeps the existing
 * Real Capita premium fallback wordmark.
 */
export function toPrintBrand(
  company: PrintBrandCompany | null,
): PrintBrand {
  const hasPrintLogo = company != null && company.printLogoPath != null;
  const logoRevision = company ? Date.parse(company.updatedAt) : 0;

  return {
    companyName: company?.printHeaderName ?? company?.name ?? null,
    legalName: company?.legalName ?? null,
    address: company?.address ?? null,
    phone: company?.phone ?? null,
    email: company?.email ?? null,
    currency: company?.currency ?? "BDT",
    logoSrc:
      hasPrintLogo && company
        ? companyMediaUrl(
            company.id,
            "print-logo",
            Number.isNaN(logoRevision) ? 0 : logoRevision,
          )
        : FALLBACK_LOGO_SRC,
  };
}
