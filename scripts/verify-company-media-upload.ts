import "reflect-metadata";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { CreateCompanyDto } from "../apps/api/src/company/dto/create-company.dto";
import { UpdateCompanyDto } from "../apps/api/src/company/dto/update-company.dto";
import type { PrismaService } from "../apps/api/src/prisma/prisma.service";

/**
 * DB-free D7B verifier: secure company media upload foundation.
 *
 * Behavioral verification of the real CompanyMediaService with a mock Prisma
 * client, synthetic image buffers, and a temporary OS directory (never the
 * repository). Source-contract checks cover routes, guards, and DTO
 * protection. Exits with code 1 on any failure.
 */

type CheckOutcome = {
  id: string;
  label: string;
  passed: boolean;
  detail: string | null;
};

const ROOT = process.cwd();
const outcomes: CheckOutcome[] = [];

function record(
  id: string,
  label: string,
  passed: boolean,
  detail?: string,
): void {
  outcomes.push({ id, label, passed, detail: detail ?? null });
}

async function safeCall<T>(
  fn: () => Promise<T> | T,
): Promise<{ value: T | null; error: unknown }> {
  try {
    return { value: await fn(), error: null };
  } catch (error) {
    return { value: null, error };
  }
}

function stripLineComments(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

async function readSource(relativePath: string): Promise<string> {
  try {
    const text = await readFile(path.join(ROOT, relativePath), "utf8");
    return stripLineComments(text);
  } catch {
    return "";
  }
}

/** Mirrors the global ValidationPipe (whitelist + forbidNonWhitelisted). */
function validateBody(
  dtoClass: new () => object,
  plain: Record<string, unknown>,
): { errors: string[] } {
  const instance = plainToInstance(dtoClass, plain);
  const errors = validateSync(instance, {
    forbidNonWhitelisted: true,
    whitelist: true,
  });
  const messages = errors.flatMap((error) => {
    const constraints = (error as { constraints?: Record<string, string> })
      .constraints;
    return constraints ? Object.values(constraints) : [];
  });
  return { errors: messages };
}

// ---------------------------------------------------------------------------
// Synthetic image buffers
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function pngBuffer(size = 64): Buffer {
  return Buffer.concat([PNG_SIGNATURE, Buffer.alloc(size)]);
}

function jpegBuffer(size = 64): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff]),
    Buffer.alloc(size),
  ]);
}

function webpBuffer(size = 64): Buffer {
  return Buffer.concat([
    Buffer.from("RIFF", "latin1"),
    Buffer.alloc(4),
    Buffer.from("WEBP", "latin1"),
    Buffer.alloc(size),
  ]);
}

const TWO_MIB = 2 * 1024 * 1024;
const FIVE_MIB = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

type MockCompanyRow = Record<string, string | null | boolean>;

type MediaCall = { method: string; args: Record<string, unknown> };

function buildMediaMockPrisma(companies: Map<string, MockCompanyRow>) {
  const calls: MediaCall[] = [];
  let failNextUpdate = false;

  const prisma = {
    company: {
      async findUnique(args: Record<string, unknown> = {}) {
        calls.push({ method: "company.findUnique", args });
        const where = args.where as { id?: string };
        const row = companies.get(where.id ?? "");
        if (!row) return null;
        const select = (args.select ?? {}) as Record<string, unknown>;
        const projected: Record<string, unknown> = {};
        for (const key of Object.keys(select)) {
          projected[key] = row[key] ?? null;
        }
        return projected;
      },
      async update(args: Record<string, unknown> = {}) {
        calls.push({ method: "company.update", args });
        if (failNextUpdate) {
          failNextUpdate = false;
          throw new Error("simulated DB failure");
        }
        const where = args.where as { id?: string };
        const data = args.data as Record<string, unknown>;
        const row = companies.get(where.id ?? "");
        if (!row) throw new Error("company missing");
        Object.assign(row, data);
        return { ...row };
      },
    },
  };

  return {
    calls,
    prisma: prisma as unknown as PrismaService,
    setFailNextUpdate: () => {
      failNextUpdate = true;
    },
    lastUpdateCall: () =>
      [...calls].reverse().find((call) => call.method === "company.update"),
  };
}

type UploadedFileInput = {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
};

async function listFilesRecursive(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function main(): Promise<number> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "d7b-media-"));

  try {
    // Dynamically import production modules so a missing implementation is a
    // behavioral FAIL rather than a module-resolution crash.
    const mediaModule = await import(
      "../apps/api/src/company/company-media.service"
    ).catch(() => null);
    const mediaReadModule = await import(
      "../apps/api/src/company/company-media.controller"
    ).catch(() => null);

    const companyControllerSource = await readSource(
      "apps/api/src/company/company.controller.ts",
    );
    const companyModuleSource = await readSource(
      "apps/api/src/company/company.module.ts",
    );
    const mediaServiceSource = await readSource(
      "apps/api/src/company/company-media.service.ts",
    );
    const mediaControllerSource = await readSource(
      "apps/api/src/company/company-media.controller.ts",
    );

    const CompanyMediaService = mediaModule?.CompanyMediaService as
      | (new (prisma: PrismaService, storageRoot: string) => {
          upload: (
            companyId: string,
            kind: string,
            file: UploadedFileInput,
          ) => Promise<unknown>;
          remove: (companyId: string, kind: string) => Promise<unknown>;
          readMedia: (
            companyId: string,
            kind: string,
          ) => Promise<{ stream: NodeJS.ReadableStream; contentType: string } | null>;
        })
      | undefined;

    // --- A/B: media-kind contract -------------------------------------------

    const MEDIA_KINDS = mediaModule?.MEDIA_KINDS as
      | Record<string, { field: string }>
      | undefined;

    record(
      "A",
      "exactly three media kinds exist",
      MEDIA_KINDS !== undefined &&
        Object.keys(MEDIA_KINDS).length === 3 &&
        ["office-logo", "custom-background", "print-logo"].every((kind) =>
          Object.prototype.hasOwnProperty.call(MEDIA_KINDS, kind),
      ),
      MEDIA_KINDS === undefined ? "media kinds export missing" : undefined,
    );

    record(
      "B",
      "kind to Company-field mapping is closed and exact",
      MEDIA_KINDS !== undefined &&
        MEDIA_KINDS["office-logo"]?.field === "officeLogoPath" &&
        MEDIA_KINDS["custom-background"]?.field === "customBackgroundPath" &&
        MEDIA_KINDS["print-logo"]?.field === "printLogoPath",
    );

    // Service behavioral checks (C–U) -----------------------------------------

    if (CompanyMediaService !== undefined) {
      const companies = new Map<string, MockCompanyRow>([
        ["c1", { id: "c1", name: "Office One", backgroundMode: "DEFAULT_PREMIUM", isActive: true, singletonKey: null }],
        ["c2", { id: "c2", name: "Office Two", backgroundMode: "DEFAULT_PREMIUM", isActive: true, singletonKey: null }],
      ]);
      const mock = buildMediaMockPrisma(companies);
      const service = new CompanyMediaService(mock.prisma, tempRoot);

      // C: PNG accepted
      const pngUpload = await safeCall(() =>
        service.upload("c1", "office-logo", {
          buffer: pngBuffer(),
          size: pngBuffer().length,
          mimetype: "image/png",
          originalname: "brand-logo-final.png",
        }),
      );
      // Captured immediately: the update call produced by THIS upload, so
      // later uploads on other kinds cannot mask the field-write audit.
      const updateAfterCUpload = mock.lastUpdateCall();
      const pngStoredKey = (companies.get("c1")?.officeLogoPath ??
        null) as string | null;
      record(
        "C",
        "PNG magic bytes accepted",
        pngUpload.error === null && typeof pngStoredKey === "string",
        pngUpload.error === null ? undefined : String(pngUpload.error),
      );

      // D: JPEG accepted
      const jpegUpload = await safeCall(() =>
        service.upload("c1", "print-logo", {
          buffer: jpegBuffer(),
          size: jpegBuffer().length,
          mimetype: "image/jpeg",
          originalname: "photo.jpg",
        }),
      );
      record(
        "D",
        "JPEG magic bytes accepted",
        jpegUpload.error === null &&
          typeof companies.get("c1")?.printLogoPath === "string",
        jpegUpload.error === null ? undefined : String(jpegUpload.error),
      );

      // E: WebP accepted
      const webpUpload = await safeCall(() =>
        service.upload("c2", "custom-background", {
          buffer: webpBuffer(),
          size: webpBuffer().length,
          mimetype: "image/webp",
          originalname: "bg.webp",
        }),
      );
      record(
        "E",
        "WebP magic bytes accepted",
        webpUpload.error === null &&
          typeof companies.get("c2")?.customBackgroundPath === "string",
        webpUpload.error === null ? undefined : String(webpUpload.error),
      );

      // F: fake .png rejected
      const fakeBytes = Buffer.from("this is definitely not an image file");
      const fakeUpload = await safeCall(() =>
        service.upload("c2", "office-logo", {
          buffer: fakeBytes,
          size: fakeBytes.length,
          mimetype: "image/png",
          originalname: "fake.png",
        }),
      );
      record(
        "F",
        "fake .png / non-image bytes rejected (extension never trusted)",
        fakeUpload.error !== null,
        fakeUpload.error === null ? "accepted" : "rejected",
      );

      // G: declared MIME mismatch rejected
      const mismatchUpload = await safeCall(() =>
        service.upload("c2", "office-logo", {
          buffer: pngBuffer(),
          size: pngBuffer().length,
          mimetype: "image/jpeg",
          originalname: "confused.png",
        }),
      );
      record(
        "G",
        "declared MIME mismatch rejected (bytes win over declaration)",
        mismatchUpload.error !== null,
        mismatchUpload.error === null ? "accepted" : "rejected",
      );

      // H: SVG rejected
      const svgBytes = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      );
      const svgUpload = await safeCall(() =>
        service.upload("c2", "office-logo", {
          buffer: svgBytes,
          size: svgBytes.length,
          mimetype: "image/svg+xml",
          originalname: "evil.svg",
        }),
      );
      record(
        "H",
        "SVG rejected",
        svgUpload.error !== null,
        svgUpload.error === null ? "accepted" : "rejected",
      );

      // I/J/K: size limits
      const oversizedLogo = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(TWO_MIB)]);
      const logoOver = await safeCall(() =>
        service.upload("c2", "office-logo", {
          buffer: oversizedLogo,
          size: oversizedLogo.length,
          mimetype: "image/png",
          originalname: "big.png",
        }),
      );
      record(
        "I",
        "office-logo above 2 MiB rejected",
        logoOver.error !== null,
        logoOver.error === null ? "accepted" : "rejected",
      );

      const printOver = await safeCall(() =>
        service.upload("c2", "print-logo", {
          buffer: oversizedLogo,
          size: oversizedLogo.length,
          mimetype: "image/png",
          originalname: "big.png",
        }),
      );
      record(
        "J",
        "print-logo above 2 MiB rejected",
        printOver.error !== null,
        printOver.error === null ? "accepted" : "rejected",
      );

      const oversizedBackground = Buffer.concat([
        PNG_SIGNATURE,
        Buffer.alloc(FIVE_MIB),
      ]);
      const backgroundOver = await safeCall(() =>
        service.upload("c2", "custom-background", {
          buffer: oversizedBackground,
          size: oversizedBackground.length,
          mimetype: "image/png",
          originalname: "big-bg.png",
        }),
      );
      record(
        "K",
        "custom-background above 5 MiB rejected",
        backgroundOver.error !== null,
        backgroundOver.error === null ? "accepted" : "rejected",
      );

      // L/M/N: storage-key safety
      const uploadResult = pngUpload.value as
        | { company?: Record<string, unknown> }
        | null;
      const storedBasename = pngStoredKey
        ? path.posix.basename(pngStoredKey)
        : null;
      const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/i;
      record(
        "L",
        "original filename is never used for the stored filename",
        storedBasename !== null &&
          !storedBasename.includes("brand") &&
          uuidLike.test(storedBasename),
        `storedBasename=${storedBasename}`,
      );

      record(
        "M",
        "stored extension comes from detected bytes (not the original name)",
        storedBasename !== null && storedBasename.endsWith(".png"),
        `storedBasename=${storedBasename}`,
      );

      record(
        "N",
        "generated storage key is namespaced by Company id + media kind",
        typeof pngStoredKey === "string" &&
          pngStoredKey.startsWith("c1/office-logo/"),
        `key=${pngStoredKey}`,
      );

      // The stored file exists on disk under the temp root.
      const storedAbsolute = pngStoredKey
        ? path.join(tempRoot, ...pngStoredKey.split("/"))
        : null;
      const storedExists =
        storedAbsolute !== null
          ? await stat(storedAbsolute).then(
              (info) => info.isFile(),
              () => false,
            )
          : false;
      record(
        "N2",
        "uploaded bytes are persisted at the generated key",
        storedExists,
      );

      // Response exposes no absolute path / storage root.
      const responseText = JSON.stringify(uploadResult ?? {});
      record(
        "RESP",
        "upload response exposes no absolute filesystem path or storage root",
        !responseText.includes(tempRoot) &&
          !responseText.replace(/\\\\/g, "\\").includes(
            path.resolve(tempRoot).slice(0, -1),
          ) &&
          !/(^|[^A-Za-z])[A-Za-z]:\\\\/.test(responseText),
        responseText.slice(0, 160),
      );

      // O: path traversal cannot escape the storage root
      companies.get("c2")!.officeLogoPath = "../../escape.png";
      const traversalRead = await safeCall(() =>
        service.readMedia("c2", "office-logo"),
      );
      record(
        "O",
        "path traversal cannot escape storage root (traversal stored key treated as unavailable)",
        traversalRead.value === null && traversalRead.error === null,
        traversalRead.error === null ? undefined : String(traversalRead.error),
      );

      // P/Q: upload writes only the mapped field
      const updateCall = updateAfterCUpload;
      const updateDataKeys = updateCall
        ? Object.keys(updateCall.args.data as Record<string, unknown>)
        : [];
      record(
        "P",
        "upload writes only the mapped Company field",
        updateDataKeys.length === 1 && updateDataKeys[0] === "officeLogoPath",
        `keys=${updateDataKeys.join(",")}`,
      );

      record(
        "Q",
        "upload never writes singletonKey/isActive/backgroundMode",
        !updateDataKeys.includes("singletonKey") &&
          !updateDataKeys.includes("isActive") &&
          !updateDataKeys.includes("backgroundMode"),
        `keys=${updateDataKeys.join(",")}`,
      );

      // R: replacement removes the old safe file
      const oldKey = "c1/office-logo/00000000-0000-0000-0000-000000000000.png";
      const oldAbsolute = path.join(
        tempRoot,
        "c1",
        "office-logo",
        "00000000-0000-0000-0000-000000000000.png",
      );
      await writeFile(oldAbsolute, pngBuffer(16));
      companies.get("c1")!.officeLogoPath = oldKey;
      const replaceUpload = await safeCall(() =>
        service.upload("c1", "office-logo", {
          buffer: pngBuffer(24),
          size: pngBuffer(24).length,
          mimetype: "image/png",
          originalname: "replacement.png",
        }),
      );
      const oldStillExists = await stat(oldAbsolute).then(
        () => true,
        () => false,
      );
      const newKey = companies.get("c1")?.officeLogoPath ?? null;
      record(
        "R",
        "replacement removes (or cleans up) the old safely-contained file after the DB update",
        replaceUpload.error === null &&
          !oldStillExists &&
          newKey !== null &&
          newKey !== oldKey,
        `oldStillExists=${oldStillExists} newKey=${newKey}`,
      );

      // S: DB failure cleans the newly-written file
      const beforeFailureFiles = await listFilesRecursive(
        path.join(tempRoot, "c1", "print-logo"),
      );
      mock.setFailNextUpdate();
      const failedUpload = await safeCall(() =>
        service.upload("c1", "print-logo", {
          buffer: pngBuffer(48),
          size: pngBuffer(48).length,
          mimetype: "image/png",
          originalname: "doomed.png",
        }),
      );
      const afterFailureFiles = await listFilesRecursive(
        path.join(tempRoot, "c1", "print-logo"),
      );
      record(
        "S",
        "DB failure after the write removes the newly-written file (no orphans)",
        failedUpload.error !== null &&
          afterFailureFiles.length === beforeFailureFiles.length &&
          afterFailureFiles.every((file) =>
            beforeFailureFiles.includes(file),
          ),
        `error=${failedUpload.error?.constructor.name ?? "none"} filesBefore=${beforeFailureFiles.length} filesAfter=${afterFailureFiles.length}`,
      );

      // V–Y: public read behavior (runs before the removal checks — removal
      // legitimately deletes the referenced file from disk per §15).
      const readCompanies = new Map<string, MockCompanyRow>([
        ["c1", { ...companies.get("c1")! }],
        ["c-null", { id: "c-null", officeLogoPath: null }],
      ]);
      const readMock = buildMediaMockPrisma(readCompanies);
      const readService = new CompanyMediaService(readMock.prisma, tempRoot);

      const unknownKindRead = await safeCall(() =>
        readService.readMedia("c1", "favicon"),
      );
      record(
        "V",
        "public read supports only the three closed kinds",
        unknownKindRead.value === null && unknownKindRead.error === null,
      );

      const missingCompanyRead = await safeCall(() =>
        readService.readMedia("missing-company", "office-logo"),
      );
      const nullFieldRead = await safeCall(() =>
        readService.readMedia("c-null", "office-logo"),
      );
      const missingFileCompany = new Map<string, MockCompanyRow>([
        ["c-missing", { officeLogoPath: "c1/office-logo/no-such-file.png" }],
      ]);
      const missingFileMock = buildMediaMockPrisma(missingFileCompany);
      const missingFileService = new CompanyMediaService(
        missingFileMock.prisma,
        tempRoot,
      );
      const missingFileRead = await safeCall(() =>
        missingFileService.readMedia("c-missing", "office-logo"),
      );
      record(
        "X",
        "public read 404s (null) for missing Company, null path, and missing file",
        missingCompanyRead.value === null &&
          nullFieldRead.value === null &&
          missingFileRead.value === null,
      );

      const liveReadCompanies = new Map<string, MockCompanyRow>([
        ["c1", { ...companies.get("c1")! }],
      ]);
      const liveReadMock = buildMediaMockPrisma(liveReadCompanies);
      const liveReadService = new CompanyMediaService(
        liveReadMock.prisma,
        tempRoot,
      );
      const liveRead = await safeCall(() =>
        liveReadService.readMedia("c1", "office-logo"),
      );
      const streamResult = liveRead.value
        ? await safeCall(() =>
            new Promise<string>((resolve, reject) => {
              const stream = liveRead.value?.stream;
              if (!stream) {
                reject(new Error("no stream"));
                return;
              }
              let data = "";
              stream.on("data", (chunk: Buffer) => {
                data += chunk.toString("latin1");
              });
              stream.on("end", () => resolve(data));
              stream.on("error", reject);
            }),
          )
        : { value: null, error: null };
      record(
        "Y",
        "public read streams the stored bytes with the detected content type",
        liveRead.value?.contentType === "image/png" &&
          typeof streamResult.value === "string" &&
          (streamResult.value as string).startsWith(
            PNG_SIGNATURE.toString("latin1"),
          ),
        `contentType=${liveRead.value?.contentType ?? "none"} streamError=${streamResult.error === null ? "none" : String(streamResult.error)} key=${String(companies.get("c1")?.officeLogoPath ?? null)}`,
      );

      // W: no arbitrary-path read surface (behavioral: read only takes id + kind)
      record(
        "W",
        "public read exposes no arbitrary filesystem path parameter (id + closed kind only)",
        !/\?\s*path|req\.query\.(path|file|key)/i.test(mediaControllerSource),
      );

      // T/U: removal semantics (after the read checks — remove unlinks the
      // referenced file, which is exactly the §15 contract).
      const removeMock = buildMediaMockPrisma(
        new Map<string, MockCompanyRow>([
          ["c1", { ...companies.get("c1")! }],
        ]),
      );
      const removeService = new CompanyMediaService(
        removeMock.prisma,
        tempRoot,
      );
      const removal = await safeCall(() =>
        removeService.remove("c1", "office-logo"),
      );
      const removeUpdate = removeMock.lastUpdateCall();
      const removeDataKeys = removeUpdate
        ? Object.keys(removeUpdate.args.data as Record<string, unknown>)
        : [];
      const removedValue = removeUpdate
        ? (removeUpdate.args.data as Record<string, unknown>).officeLogoPath
        : undefined;
      record(
        "T",
        "remove sets only the mapped field to null",
        removal.error === null &&
          removeDataKeys.length === 1 &&
          removeDataKeys[0] === "officeLogoPath" &&
          removedValue === null,
        `keys=${removeDataKeys.join(",")} value=${String(removedValue)}`,
      );

      record(
        "U",
        "remove never changes backgroundMode",
        !removeDataKeys.includes("backgroundMode"),
        `keys=${removeDataKeys.join(",")}`,
      );
    } else {
      for (const id of [
        "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "N2",
        "RESP", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y",
      ]) {
        record(id, "CompanyMediaService is implemented", false);
      }
    }

    // --- Z/AA/AB/AC: routes and guards ---------------------------------------

    record(
      "Z",
      "protected POST upload endpoint exists on the Company controller (multipart field)",
      /@Post\(":id\/media\/:kind"\)/.test(companyControllerSource) &&
        /FileInterceptor\("file"/.test(companyControllerSource),
    );

    record(
      "AA",
      "protected DELETE media endpoint exists on the Company controller",
      /@Delete\(":id\/media\/:kind"\)/.test(companyControllerSource),
    );

    record(
      "AB",
      "public GET read endpoint exists (company-media controller, no auth guards)",
      /@Controller\("company-media"\)/.test(mediaControllerSource) &&
        /@Get\(":id\/:kind"\)/.test(mediaControllerSource) &&
        !/AuthGuard/.test(mediaControllerSource),
    );

    record(
      "AC",
      "existing Company controller guards were not weakened",
      /@Roles\(ACCOUNTANT_ROLE\)/.test(companyControllerSource) &&
        /@UseGuards\(AuthGuard,\s*RolesGuard\)/.test(companyControllerSource),
    );

    record(
      "AC2",
      "media service/controller are registered in CompanyModule",
      /CompanyMediaController/.test(companyModuleSource) &&
        /CompanyMediaService/.test(companyModuleSource),
    );

    // --- AD/AE: DTO protection -------------------------------------------------

    const pathFieldAttacks = [
      "officeLogoPath",
      "customBackgroundPath",
      "printLogoPath",
    ];
    const dtoAttacksRejected = pathFieldAttacks.every(
      (field) =>
        validateBody(UpdateCompanyDto, { [field]: "x.png" }).errors.length >
        0,
    );
    record(
      "AD",
      "UpdateCompanyDto still rejects all three file-path fields (D7A contract intact)",
      dtoAttacksRejected,
    );

    const createDtoSource = await readSource(
      "apps/api/src/company/dto/create-company.dto.ts",
    );
    record(
      "AE",
      "CreateCompanyDto still does not expose path fields",
      !/officeLogoPath|customBackgroundPath|printLogoPath/.test(
        createDtoSource,
      ),
    );

    // --- AF/AG/AH: format and hard-coding ---------------------------------------

    record(
      "AF",
      "no SVG/AI upload support in production media code",
      !/image\/svg|\.ai\b|\.eps|\.psd/i.test(mediaServiceSource) &&
        !/image\/svg|\.ai\b|\.eps|\.psd/i.test(mediaControllerSource),
    );

    record(
      "AG",
      "no arbitrary URL/path upload (no remote fetch, buffer-only upload)",
      !/https?:\/\//i.test(mediaServiceSource) &&
        !/fetch\(|axios|import\s+.*http/.test(mediaServiceSource) &&
        /buffer/.test(mediaServiceSource),
    );

    const d7bProductionAll = `${mediaServiceSource}\n${mediaControllerSource}\n${companyControllerSource}`;
    record(
      "AH",
      "no RESDA/Afseen hard-coding in D7B production files",
      !/afseen|resda|652B7C/i.test(d7bProductionAll),
    );

    // --- AI: D8 frontend consumes the controlled D7B media contract -------------

    // D8 note: the original D7B phase boundary asserted apps/web was untouched.
    // D8 is the authorized Company Setup frontend phase, so this check now pins
    // the enduring invariant: the Company frontend uses ONLY the closed media
    // kinds, previews through the public /company-media route, never exposes
    // stored filesystem paths, and never makes the media path fields writable
    // through the JSON PATCH input.

    const companyUiSources = [
      await readSource("apps/web/src/app/app/company/page.tsx"),
      await readSource(
        "apps/web/src/app/app/company/_components/OfficeList.tsx",
      ),
      await readSource(
        "apps/web/src/app/app/company/_components/OfficeEditor.tsx",
      ),
      await readSource(
        "apps/web/src/app/app/company/_components/CompanyMediaField.tsx",
      ),
    ];
    const companyApiSource = await readSource("apps/web/src/lib/api.ts");
    const companyUi = companyUiSources.join("\n");

    const closedKinds = ["office-logo", "custom-background", "print-logo"];
    const frontendKindLiterals = [
      ...companyUi.matchAll(/kind="([^"]+)"/g),
    ].map((match) => match[1]);
    const frontendKindsClosed =
      frontendKindLiterals.length > 0 &&
      frontendKindLiterals.every((kind) => closedKinds.includes(kind));

    const noArbitraryFrontendPaths =
      !/storage\/company-branding/.test(companyUi) &&
      !/src=\{[^}]*(?:officeLogoPath|customBackgroundPath|printLogoPath)/.test(
        companyUi,
      ) &&
      !/(?:officeLogoPath|customBackgroundPath|printLogoPath)\s*===?\s*["']/.test(
        companyUi,
      );

    const previewUsesPublicMediaRoute =
      /\/company-media\/\$\{companyId\}\/\$\{kind\}/.test(companyApiSource) &&
      /src=\{companyMediaUrl\(/.test(companyUi);

    const mediaMutationsUseD7BRoutes =
      /\/company\/\$\{companyId\}\/media\/\$\{kind\}/.test(companyApiSource) &&
      /export function uploadCompanyMedia\(/.test(companyApiSource) &&
      /export function removeCompanyMedia\(/.test(companyApiSource);

    const updateInputMatch = companyApiSource.match(
      /export type UpdateCompanyInput = ([\s\S]*?)\n\};/,
    );
    const updateInputBody = updateInputMatch ? updateInputMatch[1] : "";
    const pathFieldsNotJsonWritable =
      updateInputBody !== "" &&
      !/(officeLogoPath|customBackgroundPath|printLogoPath)/.test(
        updateInputBody,
      );

    const aiPasses =
      frontendKindsClosed &&
      noArbitraryFrontendPaths &&
      previewUsesPublicMediaRoute &&
      mediaMutationsUseD7BRoutes &&
      pathFieldsNotJsonWritable;

    record(
      "AI",
      "D8 frontend consumes the controlled D7B media contract (closed kinds only, public /company-media previews, no filesystem paths, path fields not JSON-writable)",
      aiPasses,
      aiPasses ? undefined : `kinds=[${frontendKindLiterals.join(",")}]`,
    );

    // --- AJ: runtime storage is gitignored -----------------------------------------

    let ignoredApi = false;
    let ignoredRoot = false;
    try {
      execFileSync(
        process.platform === "win32" ? "git.exe" : "git",
        ["check-ignore", "-q", "apps/api/storage/company-branding/x.png"],
        { cwd: ROOT, stdio: "ignore" },
      );
      ignoredApi = true;
    } catch {
      ignoredApi = false;
    }
    try {
      execFileSync(
        process.platform === "win32" ? "git.exe" : "git",
        ["check-ignore", "-q", "storage/company-branding/x.png"],
        { cwd: ROOT, stdio: "ignore" },
      );
      ignoredRoot = true;
    } catch {
      ignoredRoot = false;
    }
    record(
      "AJ",
      "runtime storage directory is gitignored (API runtime path covered)",
      ignoredApi || ignoredRoot,
      `api=${ignoredApi} root=${ignoredRoot}`,
    );

    // --- Report ---------------------------------------------------------------------

    console.log("D7B company media upload verification (DB-free, temp OS storage)");
    console.log(`Temp storage root: ${tempRoot}`);
    console.log("");
    for (const outcome of outcomes) {
      const marker = outcome.passed ? "PASS" : "FAIL";
      const suffix = outcome.detail ? ` -> ${outcome.detail}` : "";
      console.log(`  ${marker}  [${outcome.id}] ${outcome.label}${suffix}`);
    }

    const failed = outcomes.filter((outcome) => !outcome.passed);

    console.log("");
    console.log(
      `Summary: ${outcomes.length - failed.length} PASS / ${failed.length} FAIL`,
    );

    return failed.length > 0 ? 1 : 0;
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
}

void main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
