import { createRequire } from "node:module";

export const ATTENDANCE_DEV_DATABASE = "real_capita_accounts_salary_dev";
export const ATTENDANCE_SCRATCH_DATABASE = "hr2c";
export const ATTENDANCE_SCRATCH_PORTS = new Set(["55496", "55497", "55498"]);

function parseVerificationUrl(value: string | undefined): URL {
  let url: URL;
  try {
    url = new URL(value ?? "");
  } catch {
    throw new Error("A safe verification database URL is required.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Verification requires a PostgreSQL URL.");
  }
  return url;
}

export function assertAttendanceDevDatabase(value: string | undefined): string {
  const url = parseVerificationUrl(value);
  if (
    url.hostname !== "localhost" ||
    url.port !== "55432" ||
    decodeURIComponent(url.pathname) !== `/${ATTENDANCE_DEV_DATABASE}` ||
    [...url.searchParams.keys()].some((key) => key !== "schema") ||
    (url.searchParams.has("schema") && url.searchParams.get("schema") !== "public")
  ) {
    throw new Error("Verification requires localhost:55432/real_capita_accounts_salary_dev only.");
  }
  return value!;
}

export function assertAttendanceScratchDatabase(value: string | undefined): string {
  const url = parseVerificationUrl(value);
  if (
    url.hostname !== "127.0.0.1" ||
    !ATTENDANCE_SCRATCH_PORTS.has(url.port) ||
    decodeURIComponent(url.pathname) !== `/${ATTENDANCE_SCRATCH_DATABASE}` ||
    [...url.searchParams.keys()].some((key) => key !== "schema") ||
    (url.searchParams.has("schema") && url.searchParams.get("schema") !== "public")
  ) {
    throw new Error(
      "Scratch verification requires 127.0.0.1 on port 55496, 55497, or 55498 with database hr2c only.",
    );
  }
  return value!;
}

export interface VerificationPg {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, any>>; rowCount: number | null }>;
}

export function verificationPg(value: string | undefined): VerificationPg {
  const connectionString = parseVerificationUrl(value).toString();
  const require = createRequire(import.meta.url);
  const adapterRequire = createRequire(require.resolve("@prisma/adapter-pg"));
  const { Client } = adapterRequire("pg");
  return new Client({ connectionString });
}

export async function databaseFingerprint(pg: VerificationPg) {
  const { rows } = await pg.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  const result: Record<string, { count: string; fingerprint: string }> = {};
  for (const { tablename } of rows) {
    const identifier = '"' + String(tablename).replaceAll('"', '""') + '"';
    const data = await pg.query(
      `SELECT count(*)::text AS count, md5(COALESCE(string_agg(row_hash, '' ORDER BY row_hash), '')) AS fingerprint FROM (SELECT md5(row_to_json(t)::text) AS row_hash FROM public.${identifier} t) rows`,
    );
    result[String(tablename)] = data.rows[0] as { count: string; fingerprint: string };
  }
  return result;
}

const PRISMA_LIFECYCLE_KEYS = new Set([
  "$connect",
  "$disconnect",
  "enableShutdownHooks",
  "onApplicationShutdown",
  "onModuleDestroy",
  "onModuleInit",
]);

export function scopedPrismaFacade(tx: Record<PropertyKey, any>) {
  let sequence = 0;
  const facade = new Proxy(tx, {
    get(target, property) {
      if (property === "$transaction") {
        return async (work: (inner: unknown) => Promise<unknown>) => {
          const savepoint = `hr2c_verify_${++sequence}`;
          await tx.$executeRawUnsafe(`SAVEPOINT "${savepoint}"`);
          try {
            const result = await work(facade);
            await tx.$executeRawUnsafe(`RELEASE SAVEPOINT "${savepoint}"`);
            return result;
          } catch (error) {
            await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT "${savepoint}"`);
            await tx.$executeRawUnsafe(`RELEASE SAVEPOINT "${savepoint}"`);
            throw error;
          }
        };
      }
      if (typeof property === "string" && PRISMA_LIFECYCLE_KEYS.has(property)) {
        return undefined;
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return facade;
}
