import {onboardingTables,onboardingReadPrivileges} from './onboarding-privileges';
import assert from "node:assert/strict";
export const runtimeWriteTables = ['auth_sessions','departments','employees','salary_structures','salary_structure_components','employee_salary_assignments','employee_payment_profiles','companies','work_schedules','work_schedule_days','work_schedule_assignments','attendance_records','attendance_revisions','attendance_policies','company_calendar_exceptions','fiscal_years','accounting_periods','projects','cost_centers','account_groups','ledger_accounts','cash_bank_accounts','vouchers','voucher_lines','voucher_number_sequences','customers','bookable_items','bookings','booking_installments','booking_receipt_allocations'];
export const readOnlyTables = ['roles','user_roles','account_classes','leave_categories','user_permissions','employee_account_bindings'];
export const appendOnlyTables = ['audit_events','attendance_day_finalizations','leave_request_events','user_admin_events'];
export const paymentTables = ['payroll_finance_delegates','payroll_finance_delegate_revocations','payroll_source_authorizations','payroll_source_actions','payroll_source_decisions','payroll_payment_batches','payroll_payment_lines','payroll_payment_reservations','payroll_payment_confirmations','payroll_cancellation_requests','payroll_cancellation_decisions'];
const qi=(name: string)=>{assert(/^[a-z_][a-z0-9_]{2,62}$/.test(name),'Unsafe database identifier');return `"${name}"`;};
export async function provisionDatabaseRoles(admin: any, options: {database: string; migration: string; runtime: string; finance: string; executor?: string; passwords: Record<string,string>}) {
  const {database,migration,runtime,finance,executor,passwords}=options;
  const identities=[migration,runtime,finance,...(executor?[executor]:[])];
  assert(new Set(identities).size===identities.length);[database,...identities].forEach(qi);
  assert.equal((await admin.query('SELECT current_database() AS db')).rows[0].db,database);
  const tables=(await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map((r: any)=>r.tablename).sort();
  const hasConfirmation=tables.includes('payroll_cash_acknowledgments');
  assert(!hasConfirmation||executor,'Confirmation schema requires a distinct executor identity');
  const principals=[runtime,finance,...(executor?[executor]:[])].map(qi).join(',');
  const authorityTables=tables.includes('authority_mandates')?['authority_bootstraps','authority_events','authority_mandates','authority_requests','authority_role_grants']:[];
  const expected=[...(tables.includes('onboarding_identities')?onboardingTables:[]),...(tables.includes('leave_workflows')?['leave_workflows','leave_stage_decisions']:[]),...authorityTables,...(hasConfirmation?['payroll_cash_acknowledgments']:[]),...runtimeWriteTables,...readOnlyTables,...appendOnlyTables,...paymentTables,'users','payroll_runs','payroll_run_lines','leave_requests','_prisma_migrations'].sort();
  assert.deepEqual(tables,expected,'Unknown/missing tables require a reviewed privilege profile');
  await admin.query('BEGIN');
  try {
    for(const role of identities) {
      const existing=(await admin.query('SELECT rolname,rolsuper,rolcreaterole,rolcreatedb,rolbypassrls,rolreplication FROM pg_roles WHERE rolname=$1',[role])).rows[0];
      if(existing){assert(!existing.rolsuper&&!existing.rolcreaterole&&!existing.rolcreatedb&&!existing.rolbypassrls&&!existing.rolreplication,'Existing role is privileged; do not silently repair');}
      else {assert(passwords[role]?.length>=32,'New role needs a separately managed strong secret');const sql=(await admin.query("SELECT format('CREATE ROLE %I LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',$1::text,$2::text) AS sql",[role,passwords[role]])).rows[0].sql;await admin.query(sql);}
      assert.equal((await admin.query('SELECT count(*)::int AS n FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=$1)',[role])).rows[0].n,0,'Role memberships require independent review');
    }
    await admin.query(`ALTER DATABASE ${qi(database)} OWNER TO ${qi(migration)}`);
    await admin.query(`ALTER SCHEMA public OWNER TO ${qi(migration)}`);
    for(const t of tables)await admin.query(`ALTER TABLE public.${qi(t)} OWNER TO ${qi(migration)}`);
    const sequences=(await admin.query("SELECT sequencename FROM pg_sequences WHERE schemaname='public'")).rows;
    for(const s of sequences)await admin.query(`ALTER SEQUENCE public.${qi(s.sequencename)} OWNER TO ${qi(migration)}`);
    const functions=(await admin.query("SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS args FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'")).rows;
    for(const f of functions) {assert(/^[a-z][a-z0-9_]+$/.test(f.proname));await admin.query(`ALTER FUNCTION public.${qi(f.proname)}(${f.args}) OWNER TO ${qi(migration)}`);}
    await admin.query(`REVOKE ALL ON DATABASE ${qi(database)} FROM PUBLIC,${principals}`);
    await admin.query(`GRANT CONNECT ON DATABASE ${qi(database)} TO ${principals}`);
    await admin.query(`REVOKE ALL ON SCHEMA public FROM PUBLIC,${principals}`);
    await admin.query(`GRANT USAGE ON SCHEMA public TO ${principals}`);
    await admin.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,${principals}`);
    await admin.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC,${principals}`);
    await admin.query(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,${principals}`);
    for(const t of [...runtimeWriteTables,...readOnlyTables,...appendOnlyTables,...paymentTables,'users','payroll_runs','payroll_run_lines','leave_requests'])await admin.query(`GRANT SELECT ON public.${qi(t)} TO ${qi(runtime)}`);
    for(const t of runtimeWriteTables)await admin.query(`GRANT INSERT,UPDATE ON public.${qi(t)} TO ${qi(runtime)}`);
    for(const t of ['salary_structure_components','attendance_records','attendance_revisions','voucher_lines'])await admin.query(`GRANT DELETE ON public.${qi(t)} TO ${qi(runtime)}`);
    await admin.query(`GRANT UPDATE ("lastLoginAt","updatedAt","email","fullName","isActive","adminVersion") ON users TO ${qi(runtime)}`);
    for(const t of [...appendOnlyTables,'payroll_runs','payroll_run_lines','payroll_payment_batches','payroll_payment_lines','leave_requests'])await admin.query(`GRANT INSERT ON public.${qi(t)} TO ${qi(runtime)}`);
    await admin.query(`GRANT UPDATE (status,version,"approvedById","approvedAt","updatedAt") ON payroll_runs TO ${qi(runtime)}`);
    for(const s of sequences)await admin.query(`GRANT USAGE ON SEQUENCE public.${qi(s.sequencename)} TO ${qi(runtime)},${qi(finance)}`);
    await admin.query(`GRANT UPDATE (status,version,"withdrawnById","withdrawnAt","reviewedById","reviewedAt","decisionReason","reviewAuthoritySnapshot") ON leave_requests TO ${qi(runtime)}`);
    await admin.query(`GRANT INSERT ON users,user_roles,user_permissions,employee_account_bindings,leave_categories TO ${qi(runtime)}`);
    await admin.query(`GRANT DELETE ON user_roles TO ${qi(runtime)}`);
    await admin.query(`GRANT UPDATE ("revokedAt","revokedById") ON user_permissions TO ${qi(runtime)}`);
    await admin.query(`GRANT UPDATE ("unboundAt","unboundById") ON employee_account_bindings TO ${qi(runtime)}`);
    await admin.query(`GRANT UPDATE (code,name,description,"isActive",version) ON leave_categories TO ${qi(runtime)}`);
    // Private finance worker/provisioner only; never installed in the API process.
    for(const t of [...paymentTables,'audit_events','users','user_roles','roles','companies','cash_bank_accounts','ledger_accounts','payroll_runs','payroll_run_lines'])await admin.query(`GRANT SELECT ON public.${qi(t)} TO ${qi(finance)}`);
    for(const t of ['payroll_finance_delegates','payroll_finance_delegate_revocations','payroll_source_authorizations','payroll_source_actions','payroll_source_decisions','payroll_cancellation_requests','payroll_cancellation_decisions','audit_events'])await admin.query(`GRANT INSERT ON public.${qi(t)} TO ${qi(finance)}`);
    await admin.query(`GRANT UPDATE (status,version) ON payroll_payment_batches TO ${qi(finance)}`);
    // Table REVOKE does not remove an older column-level grant. Explicitly
    // revoke the legacy ID privileges when upgrading a previously reviewed role.
    for(const t of ['companies','cash_bank_accounts','ledger_accounts'])await admin.query(`REVOKE UPDATE (id) ON public.${qi(t)} FROM ${qi(finance)}${executor?','+qi(executor):''}`);
    // No master-column UPDATE: row locking is exclusively bounded elevation.
    // Bounded elevation: read/lock source masters, and mutate reservations ONLY
    // as a consequence of already guarded instruction insertion/transition.
    for(const [fn,args]of [['payroll_payment_source_snapshot','text,text,"PayrollPaymentChannel"'],['payroll_payment_reserve_line',''],['payroll_payment_transition_reservations',''],['payroll_payment_line_guard',''],['payroll_payment_lock_obligations','text,text[]'],['payroll_payment_source_action_guard',''],['payroll_payment_source_decision_guard',''],['payroll_payment_cancellation_request_guard',''],['payroll_payment_cancellation_decision_guard',''],['payroll_payment_delegate_designation_guard',''],['payroll_payment_delegate_revocation_guard','']]) {
      await admin.query(`ALTER FUNCTION public.${qi(fn)}(${args}) SECURITY DEFINER`);
      await admin.query(`ALTER FUNCTION public.${qi(fn)}(${args}) SET search_path=pg_catalog,public,pg_temp`);
    }
    for(const [fn,args]of [['payroll_payment_source_snapshot','text,text,"PayrollPaymentChannel"'],['payroll_payment_grant_valid','text'],['payroll_payment_delegate','text,text,boolean'],['payroll_payment_lock_obligations','text,text[]']])await admin.query(`GRANT EXECUTE ON FUNCTION public.${qi(fn)}(${args}) TO ${qi(runtime)},${qi(finance)}`);
    await admin.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${qi(migration)} IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,${principals}`);
    await admin.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${qi(migration)} IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`);
    if(hasConfirmation&&executor) {
      for(const [fn,args]of [['payroll_payment_source_snapshot','text,text,"PayrollPaymentChannel"'],['payroll_payment_grant_valid','text'],['payroll_payment_lock_obligations','text,text[]']])await admin.query(`GRANT EXECUTE ON FUNCTION public.${qi(fn)}(${args}) TO ${qi(executor)}`);
      for(const t of [...paymentTables,'payroll_cash_acknowledgments','users','user_roles','roles','companies','cash_bank_accounts','ledger_accounts','payroll_runs','payroll_run_lines'])await admin.query(`GRANT SELECT ON public.${qi(t)} TO ${qi(executor)}`);
      await admin.query('GRANT EXECUTE ON FUNCTION payroll_payment_confirm(text,integer,text,text,text,jsonb,text) TO '+qi(executor));
      await admin.query(`GRANT EXECUTE ON FUNCTION payroll_payment_lock_parent(text) TO ${qi(finance)}`);
    }

    const {authorityReadPrivileges}=await import('./authority-privileges');await authorityReadPrivileges(admin,runtime);await onboardingReadPrivileges(admin,runtime);
    await admin.query('COMMIT');
  }catch(e){await admin.query('ROLLBACK');throw e;}
}
