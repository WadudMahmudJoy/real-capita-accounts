import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Company, VoucherType } from "../apps/web/src/lib/api";

const scriptDir =
  typeof __dirname === "string"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const voucherUiFile = path.join(
  repoRoot,
  "apps/web/src/app/app/vouchers/_lib/voucher-ui.tsx",
);
const voucherFormFile = path.join(
  repoRoot,
  "apps/web/src/app/app/vouchers/_lib/VoucherForm.tsx",
);
const amountToWordsFile = path.join(
  repoRoot,
  "apps/web/src/app/app/vouchers/_lib/voucher-print/amount-to-words.ts",
);
const printBrandFile = path.join(
  repoRoot,
  "apps/web/src/app/app/vouchers/_lib/voucher-print/print-brand.ts",
);
const printHeaderFile = path.join(
  repoRoot,
  "apps/web/src/app/app/vouchers/_lib/voucher-print/VoucherPrintHeader.tsx",
);
const printDocumentFile = path.join(
  repoRoot,
  "apps/web/src/app/app/vouchers/_lib/voucher-print/VoucherPrintDocument.tsx",
);
const watermarkFile = path.join(
  repoRoot,
  "apps/web/public/brand/voucher-watermark.svg",
);

const voucherTypes: VoucherType[] = [
  "DEBIT",
  "CREDIT",
  "JOURNAL",
  "CONTRA",
  "PAYMENT",
  "RECEIPT",
];

const expectedTitles: Record<VoucherType, string> = {
  CONTRA: "Contra Voucher",
  CREDIT: "Credit Voucher",
  DEBIT: "Debit Voucher",
  JOURNAL: "Journal Voucher",
  PAYMENT: "Payment Voucher",
  RECEIPT: "Receipt Voucher",
};

const fallbackLogo = "/brand/real-capita-group-wordmark.png";

const forbiddenTokens = [
  "activeCompanyId",
  "officeId",
  "Afseen",
  "multi-office",
];

const expectedWords: [number, string][] = [
  [0, "Zero"],
  [5000, "Five Thousand Taka"],
  [150000, "One Lac Fifty Thousand Taka"],
  [1234.56, "One Thousand Two Hundred Thirty Four Taka and Fifty Six Paisa"],
  [10000000, "One Crore Taka"],
];

const companyFixture: Company = {
  id: "company-1",
  singletonKey: "PRIMARY",
  name: "Real Capita Group",
  legalName: "Real Capita Group Ltd",
  address: "House 1, Road 2, Dhaka",
  phone: "+8801700000000",
  email: "accounts@realcapita.example",
  currency: "BDT",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

let passed = 0;
let failed = 0;

function check(name: string, verification: () => unknown): void {
  try {
    verification();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(
      `FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function loadModule(
  file: string,
): Promise<Record<string, unknown> | null> {
  if (!existsSync(file)) {
    return null;
  }

  try {
    return (await import(pathToFileURL(file).href)) as Record<
      string,
      unknown
    >;
  } catch (error) {
    console.error(
      `MODULE LOAD FAILURE ${path.basename(file)}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function readSourceIfPresent(file: string): string | null {
  return existsSync(file) ? readFileSync(file, "utf8") : null;
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

function watermarkImgTag(source: string | null): string | null {
  if (!source) {
    return null;
  }

  const match = source.match(/<img[^>]*voucher-watermark\.svg[^>]*>/);
  return match ? match[0] : null;
}

async function main(): Promise<void> {
  const voucherUi = await loadModule(voucherUiFile);
  const amountToWordsModule = await loadModule(amountToWordsFile);
  const printBrandModule = await loadModule(printBrandFile);

  const voucherTypeLabel = voucherUi?.["voucherTypeLabel"] as
    | ((type: VoucherType) => string)
    | undefined;
  const voucherTypeTitle = voucherUi?.["voucherTypeTitle"] as
    | ((type: VoucherType) => string)
    | undefined;
  const amountToWords = amountToWordsModule?.["amountToWords"] as
    | ((amount: number) => string)
    | undefined;
  const toPrintBrand = printBrandModule?.["toPrintBrand"] as
    | ((company: Company | null) => Record<string, unknown>)
    | undefined;

  check(
    "voucherTypeTitle returns the exact title for all six actual voucher types",
    () => {
      assert.equal(
        typeof voucherTypeTitle,
        "function",
        "voucherTypeTitle is not exported from voucher-ui.tsx",
      );
      for (const type of voucherTypes) {
        assert.equal(
          voucherTypeTitle?.(type),
          expectedTitles[type],
          `title for ${type}`,
        );
      }
    },
  );

  check("no Purchase Voucher mapping exists", () => {
    const source = readFileSync(voucherUiFile, "utf8");
    assert.ok(
      !/purchase/i.test(source),
      "voucher-ui.tsx contains a Purchase mapping",
    );
    for (const type of voucherTypes) {
      assert.ok(
        !/purchase/i.test(expectedTitles[type]),
        `title for ${type} mentions Purchase`,
      );
    }
  });

  check(
    "voucherTypeTitle is composed from the existing voucherTypeLabel mapping",
    () => {
      assert.equal(
        typeof voucherTypeLabel,
        "function",
        "voucherTypeLabel is not exported from voucher-ui.tsx",
      );
      assert.equal(
        typeof voucherTypeTitle,
        "function",
        "voucherTypeTitle is not exported from voucher-ui.tsx",
      );
      for (const type of voucherTypes) {
        assert.equal(
          voucherTypeTitle?.(type),
          `${voucherTypeLabel?.(type)} Voucher`,
          `title for ${type}`,
        );
      }
    },
  );

  check(
    "amountToWords is available from the extracted voucher-print module",
    () => {
      assert.ok(
        amountToWordsModule,
        "voucher-print/amount-to-words.ts does not exist yet",
      );
      assert.equal(
        typeof amountToWords,
        "function",
        "amountToWords is not exported from voucher-print/amount-to-words.ts",
      );
    },
  );

  check(
    "amountToWords keeps the existing Bangladeshi output behavior",
    () => {
      assert.ok(
        amountToWords,
        "voucher-print/amount-to-words.ts does not exist yet",
      );
      for (const [amount, words] of expectedWords) {
        assert.equal(amountToWords?.(amount), words, `words for ${amount}`);
      }
    },
  );

  check("PrintBrand contract maps only existing Company fields", () => {
    assert.ok(printBrandModule, "voucher-print/print-brand.ts does not exist yet");
    assert.equal(
      typeof toPrintBrand,
      "function",
      "toPrintBrand is not exported from voucher-print/print-brand.ts",
    );
    const brand = toPrintBrand?.(companyFixture) ?? {};
    assert.deepEqual(Object.keys(brand).sort(), [
      "address",
      "companyName",
      "currency",
      "email",
      "legalName",
      "logoSrc",
      "phone",
    ]);
    assert.equal(brand["companyName"], "Real Capita Group");
    assert.equal(brand["legalName"], "Real Capita Group Ltd");
    assert.equal(brand["address"], "House 1, Road 2, Dhaka");
    assert.equal(brand["phone"], "+8801700000000");
    assert.equal(brand["email"], "accounts@realcapita.example");
    assert.equal(brand["currency"], "BDT");

    const partial = toPrintBrand?.({
      ...companyFixture,
      legalName: null,
      address: null,
      phone: null,
      email: null,
    }) ?? {};
    assert.equal(partial["legalName"], null);
    assert.equal(partial["address"], null);
    assert.equal(partial["phone"], null);
    assert.equal(partial["email"], null);

    const missing = toPrintBrand?.(null) ?? {};
    assert.equal(missing["companyName"], null);
    assert.equal(missing["legalName"], null);
    assert.equal(missing["address"], null);
    assert.equal(missing["phone"], null);
    assert.equal(missing["email"], null);
    assert.equal(missing["currency"], "BDT");
  });

  check("PrintBrand fallback logo is the current static wordmark", () => {
    assert.ok(printBrandModule, "voucher-print/print-brand.ts does not exist yet");
    assert.equal(
      typeof toPrintBrand,
      "function",
      "toPrintBrand is not exported from voucher-print/print-brand.ts",
    );
    assert.equal(toPrintBrand?.(companyFixture)["logoSrc"], fallbackLogo);
    assert.equal(toPrintBrand?.(null)["logoSrc"], fallbackLogo);
  });

  check(
    "V2 production files contain no multi-office or forbidden branding tokens",
    () => {
      for (const file of [
        voucherUiFile,
        voucherFormFile,
        amountToWordsFile,
        printBrandFile,
      ]) {
        assert.ok(
          existsSync(file),
          `${path.basename(file)} does not exist yet`,
        );
        const source = readFileSync(file, "utf8");
        for (const token of forbiddenTokens) {
          assert.ok(
            !source.includes(token),
            `${path.basename(file)} contains "${token}"`,
          );
        }
      }
    },
  );

  check(
    "VoucherForm no longer carries its own amountToWords implementation",
    () => {
      const source = readFileSync(voucherFormFile, "utf8");
      assert.ok(
        !source.includes("function amountToWords"),
        "VoucherForm.tsx still defines amountToWords inline",
      );
      const documentSource = readSourceIfPresent(printDocumentFile);
      const formImportsExtracted = source.includes(
        "./voucher-print/amount-to-words",
      );
      const documentImportsExtracted =
        documentSource?.includes("amount-to-words") ?? false;
      assert.ok(
        formImportsExtracted || documentImportsExtracted,
        "the extracted amount-to-words module is not consumed by the voucher print pipeline",
      );
    },
  );

  check("V3: VoucherPrintDocument exists", () => {
    assert.ok(
      existsSync(printDocumentFile),
      "VoucherPrintDocument.tsx does not exist yet",
    );
  });

  check("V3: VoucherPrintHeader exists", () => {
    assert.ok(
      existsSync(printHeaderFile),
      "VoucherPrintHeader.tsx does not exist yet",
    );
  });

  check("V3: voucher watermark asset exists", () => {
    assert.ok(
      existsSync(watermarkFile),
      "voucher-watermark.svg does not exist yet",
    );
  });

  check("V3: print header shows the approved slogan exactly", () => {
    const source = readSourceIfPresent(printHeaderFile);
    assert.ok(source, "VoucherPrintHeader.tsx does not exist yet");
    assert.ok(
      source?.includes("Build Your Dream Here"),
      "the approved slogan is missing from the print header",
    );
  });

  check("V3: print header center does not repeat the company name", () => {
    const source = readSourceIfPresent(printHeaderFile);
    assert.ok(source, "VoucherPrintHeader.tsx does not exist yet");
    assert.ok(
      !source?.includes("companyName"),
      "the print header renders the company name as text",
    );
  });

  check("V3: print header contact lines come from PrintBrand", () => {
    const source = readSourceIfPresent(printHeaderFile);
    assert.ok(source, "VoucherPrintHeader.tsx does not exist yet");
    for (const field of ["brand.email", "brand.phone", "brand.address"]) {
      assert.ok(
        source?.includes(field),
        `the print header does not consume ${field}`,
      );
    }
  });

  check("V3: no website contact is invented", () => {
    for (const file of [printHeaderFile, printDocumentFile, printBrandFile]) {
      const source = readSourceIfPresent(file);
      assert.ok(source, `${path.basename(file)} does not exist yet`);
      assert.ok(
        !/website/i.test(source ?? ""),
        `${path.basename(file)} mentions a website`,
      );
    }
  });

  check("V3: voucher table uses the approved four columns", () => {
    const source = readSourceIfPresent(printDocumentFile);
    assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
    for (const label of ["SL", "Particulars", "Debit", "Credit"]) {
      assert.ok(source?.includes(label), `table column ${label} is missing`);
    }
  });

  check("V3: voucher table stays a clean four-column layout", () => {
    const source = readSourceIfPresent(printDocumentFile);
    assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
    const columnCount = (source?.match(/<th[\s>]/g) ?? []).length;
    assert.equal(
      columnCount,
      4,
      `expected exactly 4 table columns, found ${columnCount}`,
    );
  });

  check("V3: print title is generated from voucherTypeTitle()", () => {
    const source = readSourceIfPresent(printDocumentFile);
    assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
    assert.ok(
      source?.includes("voucherTypeTitle("),
      "the print document does not use voucherTypeTitle()",
    );
  });

  check("V3: signatures are exactly the four approved roles", () => {
    const source = readSourceIfPresent(printDocumentFile);
    assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
    for (const label of [
      "Received By",
      "Prepared By",
      "Checked By",
      "Approved By",
    ]) {
      assert.ok(
        source?.includes(label),
        `signature label ${label} is missing`,
      );
    }
    assert.ok(
      !source?.includes("Authorised by"),
      "the old Authorised by label is still present",
    );
  });

  check("V3: postedBy is not mapped to Approved By", () => {
    const source = readSourceIfPresent(printDocumentFile);
    assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
    for (const line of source?.split("\n") ?? []) {
      assert.ok(
        !(line.includes("postedBy") && line.includes("Approved")),
        `postedBy shares a line with the Approved By signature: ${line.trim()}`,
      );
    }
  });

  check("V3: watermark prints at no more than six percent opacity", () => {
    const source = readSourceIfPresent(printDocumentFile);
    assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
    const tag = watermarkImgTag(source);
    assert.ok(tag, "the watermark img element is missing");
    assert.ok(
      tag?.includes("opacity-[0.04]"),
      "the watermark opacity is not the agreed subtle level",
    );
  });

  check("V3: logo keeps contain-fit inside its fixed slot", () => {
    const source = readSourceIfPresent(printHeaderFile);
    assert.ok(source, "VoucherPrintHeader.tsx does not exist yet");
    assert.ok(source?.includes("object-contain"), "object-contain is missing");
    assert.ok(source?.includes("object-left"), "object-left is missing");
  });

  check(
    "V3: VoucherForm renders VoucherPrintDocument instead of the old layout",
    () => {
      const source = readFileSync(voucherFormFile, "utf8");
      assert.ok(
        !source.includes("VoucherPrintLayout"),
        "the old VoucherPrintLayout is still referenced",
      );
      assert.ok(
        source.includes("VoucherPrintDocument"),
        "VoucherPrintDocument is not rendered by VoucherForm",
      );
    },
  );

  check(
    "V3: print document sources brand from the voucher's owning company",
    () => {
      // D11A note: the original boundary asserted the print document fetched
      // the company profile through GET /company (the session's active
      // company). D11A is the authorized document-branding phase: branding
      // authority is now the VOUCHER-OWNING company carried on the voucher
      // detail payload, so an owned voucher prints its owner's branding
      // regardless of the office the session is operating.
      const source = readSourceIfPresent(printDocumentFile);
      assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
      assert.ok(
        source?.includes("voucher.company"),
        "the print document does not use the voucher's owning company",
      );
      assert.ok(
        source?.includes("toPrintBrand("),
        "the print document does not build its PrintBrand",
      );
      assert.ok(
        !source?.includes("getCompany("),
        "the print document still fetches the session company for branding",
      );
    },
  );

  check(
    "V3: no Company Setup or multi-office implementation was introduced",
    () => {
      for (const file of [printHeaderFile, printDocumentFile, watermarkFile]) {
        assert.ok(
          existsSync(file),
          `${path.basename(file)} does not exist yet`,
        );
        const source = readFileSync(file, "utf8");
        for (const token of forbiddenTokens) {
          assert.ok(
            !source.includes(token),
            `${path.basename(file)} contains "${token}"`,
          );
        }
      }
    },
  );

  check("V4: print isolation is display-based instead of visibility flow", () => {
    const source = readSourceIfPresent(printDocumentFile);
    assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
    assert.ok(
      source?.includes("display: none"),
      "print CSS does not remove non-print layout with display:none",
    );
    assert.ok(
      !source?.includes("visibility: hidden"),
      "print CSS still relies on visibility-only flow isolation",
    );
  });

  check("V4: dedicated print root portal isolates the voucher", () => {
    const source = readSourceIfPresent(printDocumentFile);
    assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
    assert.ok(
      source?.includes("createPortal"),
      "the print document is not rendered through a portal",
    );
    assert.ok(
      source?.includes("data-voucher-print-root"),
      "the dedicated print root marker is missing",
    );
  });

  check("V4: print logo uses a plain img with contain fit", () => {
    const source = readSourceIfPresent(printHeaderFile);
    assert.ok(source, "VoucherPrintHeader.tsx does not exist yet");
    assert.ok(source?.includes("<img"), "the print logo is not a plain img");
    assert.ok(source?.includes("object-contain"), "object-contain is missing");
    assert.ok(source?.includes("object-left"), "object-left is missing");
    assert.ok(
      !source?.includes('from "next/image"'),
      "the print header still uses next/image",
    );
  });

  check("V4: watermark uses a print-reliable fixed plain img", () => {
    const source = readSourceIfPresent(printDocumentFile);
    assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
    const tag = watermarkImgTag(source);
    assert.ok(tag, "the watermark is not rendered as a plain img");
    assert.ok(
      tag?.includes("fixed"),
      "the watermark does not use the print-reliable fixed strategy",
    );
    assert.ok(
      !source?.includes('from "next/image"'),
      "the print document still uses next/image",
    );
  });

  check("V4: totals are not rendered inside a repeating tfoot", () => {
    const source = readSourceIfPresent(printDocumentFile);
    assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
    assert.ok(
      !source?.includes("<tfoot"),
      "totals are still rendered in a repeating tfoot",
    );
  });

  check("V4: totals block appears exactly once", () => {
    const source = readSourceIfPresent(printDocumentFile);
    assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
    assert.equal(
      countOccurrences(source ?? "", "formatMoney(totalDebit)"),
      1,
      "total debit is rendered more than once",
    );
    assert.equal(
      countOccurrences(source ?? "", "formatMoney(totalCredit)"),
      1,
      "total credit is rendered more than once",
    );
  });

  check("V4: table header remains repeatable", () => {
    const source = readSourceIfPresent(printDocumentFile);
    assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
    assert.ok(
      source?.includes("table-header-group"),
      "thead is not marked as a repeating header group",
    );
  });

  check("V4: transaction rows avoid internal page splits", () => {
    const source = readSourceIfPresent(printDocumentFile);
    assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
    assert.ok(
      /<tr[^>]*break-inside-avoid/.test(source ?? ""),
      "transaction rows are not protected from internal splits",
    );
  });

  check("V4: totals, words, and signatures avoid internal splits", () => {
    const source = readSourceIfPresent(printDocumentFile);
    assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
    assert.ok(
      countOccurrences(source ?? "", "break-inside-avoid") >= 4,
      "not enough break-inside:avoid protection on print blocks",
    );
  });

  check("V4: A4 portrait with compact consistent page margins", () => {
    const source = readSourceIfPresent(printDocumentFile);
    assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
    assert.ok(
      source?.includes("size: A4 portrait"),
      "page size is not A4 portrait",
    );
    assert.ok(
      source?.includes("margin: 10mm 12mm"),
      "page margins are not the agreed compact A4 margins",
    );
  });

  check("V4: one consistent A4 width model", () => {
    const source = readSourceIfPresent(printDocumentFile);
    assert.ok(source, "VoucherPrintDocument.tsx does not exist yet");
    assert.ok(
      !source?.includes("190mm"),
      "the conflicting 190mm width is still present",
    );
  });

  check("V5: header keeps a balanced three-column structure", () => {
    const source = readSourceIfPresent(printHeaderFile);
    assert.ok(source, "VoucherPrintHeader.tsx does not exist yet");
    assert.ok(
      source?.includes("grid-cols-[3fr_4fr_3fr]"),
      "the header does not use the balanced 30/40/30 column grid",
    );
    assert.ok(
      source?.includes("items-center"),
      "the header columns are not vertically centered",
    );
  });

  console.log(
    `Voucher print foundation verification: ${passed} PASS, ${failed} FAIL`,
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
