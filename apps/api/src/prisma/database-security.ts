export function runtimeDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.PRIVATE_WORKER_DATABASE_URL || env.DB_CONFIRMATION_SECRET || env.DB_FINANCE_SECRET || env.DB_MIGRATION_SECRET || env.CONFIRMATION_DATABASE_URL || env.PRIVATE_WORKER_CREDENTIAL_FILE || env.MIGRATION_DATABASE_URL || env.MIGRATION_SHADOW_DATABASE_URL || env.FINANCE_PROVISIONING_DATABASE_URL || env.DATABASE_ADMIN_URL) throw new Error("Privileged database credentials must not be present in the API process.");
  if (env.DATABASE_URL) throw new Error("Legacy DATABASE_URL must be removed from the API process; no owner fallback is permitted.");
  const value = env.RUNTIME_DATABASE_URL;
  if (!value) throw new Error("RUNTIME_DATABASE_URL is required; legacy DATABASE_URL is never a fallback.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid runtime database configuration."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.username || !url.pathname.slice(1) || !env.RUNTIME_DATABASE_NAME || decodeURIComponent(url.pathname.slice(1)) !== env.RUNTIME_DATABASE_NAME) throw new Error("Runtime database identity must be explicitly configured.");
  return value;
}

export async function assertRuntimeDatabase(query: (sql: string) => Promise<unknown>, expectedDatabase: string) {
  const rows = await query(`SELECT current_database() AS db,r.rolsuper,r.rolcreaterole,r.rolcreatedb,r.rolbypassrls,r.rolreplication,
    EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) AS member,
    EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=r.oid) AS db_owner,
    (EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relowner=r.oid) OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proowner=r.oid)) AS object_owner,
    has_schema_privilege(current_user,'public','CREATE') AS schema_create,
    EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles o ON o.oid=p.proowner WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege(p.oid,'EXECUTE') AND (p.proname NOT IN ('payroll_payment_source_snapshot','payroll_payment_lock_obligations') OR o.rolsuper OR NOT coalesce(p.proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp'],false))) AS function_escalation,
    EXISTS(SELECT 1 FROM pg_class c WHERE c.relname IN ('payroll_finance_delegates','payroll_finance_delegate_revocations','payroll_source_authorizations','payroll_source_actions','payroll_source_decisions','payroll_cancellation_requests','payroll_cancellation_decisions','payroll_payment_confirmations') AND c.relnamespace='public'::regnamespace AND (has_table_privilege(c.oid,'INSERT') OR has_table_privilege(c.oid,'UPDATE') OR has_table_privilege(c.oid,'DELETE') OR has_table_privilege(c.oid,'TRUNCATE'))) AS authority_writer
    FROM pg_roles r WHERE r.rolname=current_user`) as Record<string, unknown>[];
  const r=rows[0];
  if (!r || r.db !== expectedDatabase || ["rolsuper","rolcreaterole","rolcreatedb","rolbypassrls","rolreplication","member","db_owner","object_owner","schema_create","function_escalation","authority_writer"].some(k => r[k] !== false)) throw new Error("Runtime database privilege/identity acceptance failed; startup denied.");
}
