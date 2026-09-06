import type { PrintBrand } from "./print-brand";

export function VoucherPrintHeader({ brand }: { brand: PrintBrand }) {
  return (
    <header className="grid grid-cols-[3fr_4fr_3fr] items-center gap-4 border-b-2 border-[#16324f] pb-3 break-inside-avoid">
      <div className="h-[76px] w-full">
        {/* Plain <img> for print reliability: optimized images can stay
            unloaded inside containers that are display:none on screen. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="h-[76px] w-full object-contain object-left"
          src={brand.logoSrc}
        />
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
