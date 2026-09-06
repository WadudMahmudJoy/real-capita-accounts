import type { Company } from "@/lib/api";

export const FALLBACK_LOGO_SRC = "/brand/real-capita-group-wordmark.png";

export type PrintBrand = {
  companyName: string | null;
  legalName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  logoSrc: string;
};

export function toPrintBrand(company: Company | null): PrintBrand {
  return {
    companyName: company?.name ?? null,
    legalName: company?.legalName ?? null,
    address: company?.address ?? null,
    phone: company?.phone ?? null,
    email: company?.email ?? null,
    currency: company?.currency ?? "BDT",
    logoSrc: FALLBACK_LOGO_SRC,
  };
}
