import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// Injection token for the runtime media storage root. The module factory
// resolves COMPANY_MEDIA_ROOT when set; otherwise the API's runtime working
// directory carries a "storage/company-branding" subtree.
export const COMPANY_MEDIA_STORAGE_ROOT = Symbol("COMPANY_MEDIA_STORAGE_ROOT");

export const COMPANY_MEDIA_STORAGE_SUBROOT = "company-branding";

export type CompanyMediaKind =
  | "office-logo"
  | "custom-background"
  | "print-logo";

export type CompanyMediaField =
  | "officeLogoPath"
  | "customBackgroundPath"
  | "printLogoPath";

type MediaKindSpec = {
  field: CompanyMediaField;
  maxBytes: number;
};

// Closed media-kind map: URL input can never select an arbitrary Company
// property, only one of these three exact kinds.
export const MEDIA_KINDS: Record<CompanyMediaKind, MediaKindSpec> = {
  "office-logo": { field: "officeLogoPath", maxBytes: 2 * 1024 * 1024 },
  "custom-background": {
    field: "customBackgroundPath",
    maxBytes: 5 * 1024 * 1024,
  },
  "print-logo": { field: "printLogoPath", maxBytes: 2 * 1024 * 1024 },
};

// The multipart interceptor ceiling (largest kind limit) so oversized
// payloads never reach service validation.
export const COMPANY_MEDIA_UPLOAD_CEILING_BYTES = 5 * 1024 * 1024;

// Local uploaded-file shape (avoids a @types/multer dependency): multer with
// memory storage provides exactly these members.
export type CompanyMediaUploadedFile = {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname?: string;
};

type DetectedImage = {
  ext: "png" | "jpg" | "webp";
  contentType: "image/png" | "image/jpeg" | "image/webp";
};

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

// Company ids are server-issued cuid-style tokens; this pattern also blocks
// path separators, traversal segments, and other junk before any filesystem
// or database work.
const COMPANY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// Deterministic magic-byte detection. The client's declared mimetype and the
// original filename are never trusted for storage decisions.
function detectImageType(buffer: Buffer): DetectedImage | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { contentType: "image/png", ext: "png" };
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { contentType: "image/jpeg", ext: "jpg" };
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("latin1", 0, 4) === "RIFF" &&
    buffer.toString("latin1", 8, 12) === "WEBP"
  ) {
    return { contentType: "image/webp", ext: "webp" };
  }

  return null;
}

function mediaFieldUpdate(
  field: CompanyMediaField,
  value: string | null,
): Prisma.CompanyUpdateInput {
  if (field === "officeLogoPath") {
    return { officeLogoPath: value };
  }
  if (field === "customBackgroundPath") {
    return { customBackgroundPath: value };
  }
  return { printLogoPath: value };
}

function mediaFieldSelect(field: CompanyMediaField): Prisma.CompanySelect {
  if (field === "officeLogoPath") {
    return { officeLogoPath: true };
  }
  if (field === "customBackgroundPath") {
    return { customBackgroundPath: true };
  }
  return { printLogoPath: true };
}

function isCompanyMediaKind(kind: string): kind is CompanyMediaKind {
  return Object.prototype.hasOwnProperty.call(MEDIA_KINDS, kind);
}

@Injectable()
export class CompanyMediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(COMPANY_MEDIA_STORAGE_ROOT) private readonly storageRoot: string,
  ) {}

  // Full upload pipeline: validate company + kind + bytes + size, persist the
  // file under a server-generated key, update ONLY the mapped Company field,
  // then clean the replaced file. Any DB failure after the write removes the
  // newly-written file so no orphans remain.
  async upload(
    companyId: string,
    kind: string,
    file: CompanyMediaUploadedFile,
  ): Promise<{ status: "ok"; kind: CompanyMediaKind; company: unknown }> {
    if (!isCompanyMediaKind(kind)) {
      throw new NotFoundException("Company media kind was not found.");
    }
    const spec = MEDIA_KINDS[kind];
    this.requireValidCompanyId(companyId);

    const existing = await this.loadMediaField(companyId, spec.field);
    if (!existing.companyExists) {
      throw new NotFoundException("Company was not found.");
    }

    if (!file || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException("A file is required.");
    }

    const byteSize = typeof file.size === "number" ? file.size : file.buffer.length;
    if (byteSize > spec.maxBytes || file.buffer.length > spec.maxBytes) {
      throw new PayloadTooLargeException(
        `${kind} must not exceed ${Math.floor(spec.maxBytes / (1024 * 1024))} MiB.`,
      );
    }

    const detected = detectImageType(file.buffer);
    if (!detected) {
      throw new BadRequestException(
        "Unsupported image content. Only PNG, JPEG, or WebP files are accepted.",
      );
    }
    if ((file.mimetype ?? "") !== detected.contentType) {
      throw new BadRequestException(
        "The declared file type does not match the actual file content.",
      );
    }

    const relativeKey = path.posix.join(
      companyId,
      kind,
      `${randomUUID()}.${detected.ext}`,
    );
    const targetPath = this.resolveSafePath(relativeKey);
    if (targetPath === null) {
      throw new BadRequestException("Invalid media storage key.");
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, file.buffer);

    try {
      const company = await this.prisma.company.update({
        data: mediaFieldUpdate(spec.field, relativeKey),
        where: { id: companyId },
      });

      await this.safeUnlink(this.resolveSafePath(existing.value));

      return { status: "ok" as const, kind, company };
    } catch (error) {
      await this.safeUnlink(targetPath);
      throw error;
    }
  }

  // Explicit removal: clears the DB reference first, then best-effort
  // filesystem cleanup. backgroundMode is never touched here; CUSTOM with a
  // missing background file stays valid because rendering falls back to
  // DEFAULT_PREMIUM.
  async remove(
    companyId: string,
    kind: string,
  ): Promise<{ status: "ok"; kind: CompanyMediaKind; company: unknown }> {
    if (!isCompanyMediaKind(kind)) {
      throw new NotFoundException("Company media kind was not found.");
    }
    const spec = MEDIA_KINDS[kind];
    this.requireValidCompanyId(companyId);

    const existing = await this.loadMediaField(companyId, spec.field);
    if (!existing.companyExists) {
      throw new NotFoundException("Company was not found.");
    }

    const company = await this.prisma.company.update({
      data: mediaFieldUpdate(spec.field, null),
      where: { id: companyId },
    });

    await this.safeUnlink(this.resolveSafePath(existing.value));

    return { status: "ok" as const, kind, company };
  }

  // Public read support: resolves only the currently referenced file for the
  // closed kind map. Any unknown kind, missing company, null field, missing
  // file, or containment failure yields null (the caller surfaces a 404).
  async readMedia(
    companyId: string,
    kind: string,
  ): Promise<{ stream: Readable; contentType: string } | null> {
    if (!isCompanyMediaKind(kind)) {
      return null;
    }
    if (!COMPANY_ID_PATTERN.test(companyId)) {
      return null;
    }
    const spec = MEDIA_KINDS[kind];

    const existing = await this.loadMediaField(companyId, spec.field);
    if (!existing.companyExists || existing.value === null) {
      return null;
    }

    const absolutePath = this.resolveSafePath(existing.value);
    if (absolutePath === null) {
      return null;
    }

    try {
      const info = await stat(absolutePath);
      if (!info.isFile()) {
        return null;
      }
    } catch {
      return null;
    }

    const ext = path.posix.extname(existing.value).replace(/^\./, "");
    const contentType = CONTENT_TYPE_BY_EXT[ext];
    if (!contentType) {
      return null;
    }

    return { stream: createReadStream(absolutePath), contentType };
  }

  private requireValidCompanyId(companyId: string): void {
    if (!COMPANY_ID_PATTERN.test(companyId)) {
      throw new NotFoundException("Company was not found.");
    }
  }

  private async loadMediaField(
    companyId: string,
    field: CompanyMediaField,
  ): Promise<{ companyExists: boolean; value: string | null }> {
    const row = await this.prisma.company.findUnique({
      select: mediaFieldSelect(field),
      where: { id: companyId },
    });
    if (!row) {
      return { companyExists: false, value: null };
    }
    const value = (row as Record<string, unknown>)[field];
    return {
      companyExists: true,
      value: typeof value === "string" ? value : null,
    };
  }

  // Containment guard: resolves storageRoot + relativeKey and verifies the
  // result stays inside storageRoot. Protects reads/removals even against
  // unexpected legacy or corrupt DB values.
  private resolveSafePath(relativeKey: string | null): string | null {
    if (typeof relativeKey !== "string" || relativeKey.length === 0) {
      return null;
    }
    const root = path.resolve(this.storageRoot);
    const absolute = path.resolve(root, relativeKey);
    const relative = path.relative(root, absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return null;
    }
    return absolute;
  }

  private async safeUnlink(absolutePath: string | null): Promise<void> {
    if (absolutePath === null) {
      return;
    }
    try {
      await unlink(absolutePath);
    } catch {
      // Best-effort cleanup: missing or locked files are tolerated.
    }
  }
}
