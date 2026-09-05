import { createRequire } from "node:module";

export function assertWorkScheduleVerificationDatabase(value: string | undefined): string {
  let url: URL;
  try { url = new URL(value ?? ""); } catch { throw new Error("Safe verification database URL is required."); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== "localhost" ||
      url.port !== "55432" || decodeURIComponent(url.pathname) !== "/real_capita_accounts_salary_dev" ||
      [...url.searchParams.keys()].some((key) => key !== "schema") ||
      (url.searchParams.has("schema") && url.searchParams.get("schema") !== "public")) {
    throw new Error("Verification requires localhost:55432/real_capita_accounts_salary_dev only.");
  }
  return value!;
}

export interface VerificationPg {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, any>>; rowCount: number | null }>;
}

export function verificationPg(value: string | undefined): VerificationPg {
  const connectionString = assertWorkScheduleVerificationDatabase(value);
  const require = createRequire(import.meta.url);
  const adapterRequire = createRequire(require.resolve("@prisma/adapter-pg"));
  const { Client } = adapterRequire("pg");
  return new Client({ connectionString });
}

export async function databaseFingerprint(pg: VerificationPg) {
  const { rows } = await pg.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);
  const result: Record<string, { count: string; fingerprint: string }> = {};
  for (const { tablename } of rows) {
    const identifier = '"' + String(tablename).replaceAll('"', '""') + '"';
    const data = await pg.query(`SELECT count(*)::text AS count, md5(COALESCE(string_agg(row_hash, '' ORDER BY row_hash), '')) AS fingerprint FROM (SELECT md5(row_to_json(t)::text) AS row_hash FROM public.${identifier} t) rows`);
    result[String(tablename)] = data.rows[0] as { count: string; fingerprint: string };
  }
  return result;
}

export class WorkScheduleVerificationRollback extends Error {}

export async function rollbackOnly(pg: VerificationPg, run: () => Promise<void>) {
  await pg.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
  try {
    await run();
    throw new WorkScheduleVerificationRollback();
  } catch (error) {
    await pg.query("ROLLBACK");
    if (!(error instanceof WorkScheduleVerificationRollback)) throw error;
  }
}
