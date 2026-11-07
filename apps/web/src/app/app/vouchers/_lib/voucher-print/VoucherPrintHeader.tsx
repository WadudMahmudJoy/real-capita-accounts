import type { VoucherCompanySummary } from "@/lib/api";
import { FALLBACK_LOGO_SRC } from "./print-brand";
import type { PrintBrand } from "./print-brand";

type VoucherPrintHeaderProps = {
  brand: PrintBrand;
  company: VoucherCompanySummary | null;
};

/**
 * Premium voucher print header. The left branding slot resolves from the
 * VOUCHER-OWNING company: an uploaded print logo (public media endpoint,
 * with a graceful fallback to the application wordmark if it fails to load),
 * otherwise the configured print header name, otherwise the legacy Real
 * Capita premium wordmark. The center skyline/slogan and the right contact
 * column remain the approved design.
 */
export function VoucherPrintHeader({ brand, company }: VoucherPrintHeaderProps) {
  const hasPrintLogo = company != null && company.printLogoPath != null;
  const headerName = company?.printHeaderName ?? null;

  return (
    <header className="grid grid-cols-[3fr_4fr_3fr] items-center gap-4 border-b-2 border-[#16324f] pb-3 break-inside-avoid">
      <div className="h-[76px] w-full">
        {hasPrintLogo ? (
          /* Plain <img> for print reliability: optimized images can stay
              unloaded inside containers that are display:none on screen. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            alt=""
            className="h-[76px] w-full object-contain object-left"
            onError={(event) => {
              // A broken/missing uploaded logo must never break the print:
              // swap to the legacy premium wordmark instead.
              const image = event.currentTarget;
              if (image.src !== FALLBACK_LOGO_SRC) {
                image.src = FALLBACK_LOGO_SRC;
              }
            }}
            src={brand.logoSrc}
          />
        ) : headerName ? (
          <div className="flex h-[76px] w-full flex-col justify-center">
            <p className="text-left text-xl font-bold uppercase leading-tight tracking-wide break-words text-[#16324f]">
              {headerName}
            </p>
          </div>
        ) : (
          /* Plain <img> for print reliability: optimized images can stay
              unloaded inside containers that are display:none on screen. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            alt=""
            className="h-[76px] w-full object-contain object-left"
            src={FALLBACK_LOGO_SRC}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-col items-center justify-center text-center">
        <svg
          aria-hidden="true"
          className="h-9 w-[220px] text-[#16324f]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 220 36"
        >
          <path d="M4 32h212" />
          <path d="M18 32V12h22v20" />
          <path d="M18 19h22M18 26h22" />
          <path d="M29 12v20" />
          <path d="M52 32V6h24v26" />
          <path d="M52 13h24M52 20h24M52 27h24" />
          <path d="M64 6V1" />
          <path d="M88 32V16h22v16" />
          <path d="M88 23h22" />
          <path d="M99 16v16" />
          <path d="M122 32V4h26v28" />
          <path d="M122 11h26M122 18h26M122 25h26" />
          <path d="M135 4v28" />
          <path d="M160 32V14h22v18" />
          <path d="M160 21h22M160 28h22" />
          <path d="M171 14v18" />
          <path d="M194 32V20h22v12" />
        </svg>
        <p className="mt-1.5 text-[13px] font-semibold tracking-[0.16em] text-[#16324f]">
          Build Your Dream Here
        </p>
        <p className="mt-1 text-[7px] font-medium tracking-[0.3em] text-[#5b6e80]">
          REAL ESTATE | DEVELOPMENT | INVESTMENT
        </p>
      </div>

      {/* The right column is always rendered so the three-column header
          stays balanced even when no contact data has been entered yet. */}
      <div className="flex h-[76px] w-full flex-col items-end justify-center gap-1 text-right text-[9px] leading-4 text-[#333f4b]">
        {brand.email ? (
          <p>
            <span className="font-semibold">Email: </span>
            {brand.email}
          </p>
        ) : null}
        {brand.phone ? (
          <p>
            <span className="font-semibold">Phone: </span>
            {brand.phone}
          </p>
        ) : null}
        {brand.address ? (
          <p>
            <span className="font-semibold">Address: </span>
            {brand.address}
          </p>
        ) : null}
      </div>
    </header>
  );
}
