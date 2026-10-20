// Actual PostgreSQL negative acceptance only. All fixture inserts roll back.
// No fabricated attendance finalization or salary/deduction approvals.
import "reflect-metadata";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
const root = resolve(__dirname, ".."), requireRoot = createRequire(join(root, "package.json"));
const local = requireRoot("dotenv").parse(readFileSync(join(root, ".env"))).DATABASE_URL;
function target(value: string | undefined) {
  assert(value, "Missing database configuration"); const url = new URL(value);
  assert(["postgresql:", "postgres:"].includes(url.protocol));
  assert.equal(url.hostname, "localhost"); assert.equal(url.port, "55532");
  assert.equal(decodeURIComponent(url.pathname.slice(1)), "real_capita_accounts_salary_dev");
  assert.equal(url.hash, ""); assert.equal(url.searchParams.get("schema") ?? "public", "public");
  assert([...url.searchParams.keys()].every(k => ["schema","sslmode","connect_timeout","connection_limit","pool_timeout"].includes(k)));
}
const configured = process.env.DATABASE_URL ?? local;
// Validate every possible target before constructing any client or connection.
target(configured); if (process.env.DATABASE_URL && local) target(local);
process.env.DATABASE_URL = configured;
const output = mkdtempSync(join(root, "apps/api/.payroll-db-verify-"));
let prisma: any;
let passed = 0;
function pass(name: string) { passed++; console.log(`PASS PostgreSQL: ${name}`); }
async function main() {
  execFileSync(process.execPath, [requireRoot.resolve("typescript/bin/tsc"), "-p", "apps/api/tsconfig.json", "--outDir", output,
    "--incremental", "false", "--declaration", "false", "--sourceMap", "false"], { cwd: root, stdio: "inherit" });
  const load = (name: string) => requireRoot(join(output, name));
  const { PrismaService } = load("prisma/prisma.service.js");
  const { PayrollParentResolver } = load("payroll/payroll-parent.resolver.js");
  const { MonthlyPayrollCalculationService } = load("payroll/monthly-payroll-calculation.service.js");
  const { PayrollReadinessService } = load("payroll/payroll-readiness.service.js");
  const { PayrollAttendanceCompletenessService } = load("payroll/payroll-attendance-completeness.service.js");
  const { PayrollDraftService } = load("payroll/payroll-draft.service.js");
  const { SalaryCalculator } = load("salary/salary-calculator.js");
  const { Prisma } = load("generated/prisma/client.js");
  prisma = new PrismaService(); await prisma.$connect();
  const identity = await prisma.$queryRaw`SELECT current_database() AS name`;
  assert.equal(identity[0].name, "real_capita_accounts_salary_dev"); pass("identity confirmed at localhost:55532");
  const parent = await prisma.company.findUnique({where:{singletonKey:"PRIMARY"},select:{id:true,isActive:true}});
  assert(parent?.isActive); pass("existing active PRIMARY found");
  const migrationName = "20261013000000_hr_3b_payroll_foundation";
  const migrations: any[] = await prisma.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations`;
  const migration = migrations.find(m => m.migration_name === migrationName);
  assert(migration?.finished_at && !migration.rolled_back_at);
  assert(!migrations.some(m => !m.finished_at && !m.rolled_back_at));
  const applied = new Set(migrations.filter(m=>m.finished_at&&!m.rolled_back_at).map(m=>m.migration_name));
  assert(readdirSync(join(root,"prisma/migrations"),{withFileTypes:true}).filter(d=>d.isDirectory()).every(d=>applied.has(d.name)));
  const sql=readFileSync(join(root,`prisma/migrations/${migrationName}/migration.sql`),"utf8");
  assert.equal(migration.checksum,createHash("sha256").update(sql).digest("hex")); pass("migration history and checksum");
  const constraints: any[] = await prisma.$queryRaw`SELECT conname::text,contype::text,convalidated,confdeltype::text,confupdtype::text,pg_get_constraintdef(oid,true) AS definition FROM pg_constraint WHERE conrelid IN ('public.payroll_runs'::regclass,'public.payroll_run_lines'::regclass)`;
  assert.equal(constraints.filter(c=>c.contype==='f'&&c.convalidated&&c.confdeltype==='r'&&c.confupdtype==='r').length,8);
  const normalize=(s:string)=>s.replace(/::numeric/g,"").replace(/[()\s]/g,"");
  const checks=[...sql.matchAll(/ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "([^"]+)" (CHECK \([^;]+\));/g)]; assert.equal(checks.length,6);
  for(const [,name,expression] of checks){const c=constraints.find(c=>c.conname===name);assert(c?.convalidated);assert.equal(normalize(c.definition),normalize(expression));}
  const columns:any[]=await prisma.$queryRaw`SELECT table_name,column_name,data_type,numeric_precision,numeric_scale,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('payroll_runs','payroll_run_lines')`;
  assert.equal(columns.filter(c=>c.data_type==='numeric'&&c.numeric_precision===18&&c.numeric_scale===2&&c.is_nullable==='NO').length,11);
  assert.equal(columns.filter(c=>c.data_type==='jsonb'&&c.is_nullable==='NO').length,5);
  const indexes:any[]=await prisma.$queryRaw`SELECT ci.relname,i.indisunique,i.indisvalid,pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class ci ON ci.oid=i.indexrelid WHERE i.indrelid IN ('public.payroll_runs'::regclass,'public.payroll_run_lines'::regclass)`;
  for(const [name,keys] of [["payroll_runs_payrollYear_payrollMonth_key",'("payrollYear", "payrollMonth")'],["payroll_run_lines_payrollRunId_employeeId_key",'("payrollRunId", "employeeId")']]){const i=indexes.find(i=>i.relname===name);assert(i?.indisunique&&i.indisvalid&&i.definition.includes(keys));}
  pass("tables, precise amounts, required JSONB, restrictive FKs, uniqueness and six financial expressions");
  const actor=await prisma.user.findFirst({where:{isActive:true,roles:{some:{role:{code:"ACCOUNTANT"}}}},select:{id:true}});
  assert(actor,"An existing authorized creator is required; no user will be created");
  const actorContext={id:actor.id,email:"verification@example.invalid",fullName:"Verification",roles:[{code:"ACCOUNTANT",name:"Accountant"}]};
  const fingerprint=async(db:any)=>({runs:await db.payrollRun.count(),lines:await db.payrollRunLine.count(),audits:await db.auditEvent.count(),employees:await db.employee.count(),assignments:await db.employeeSalaryAssignment.count(),profiles:await db.employeePaymentProfile.count()});
  const before=await fingerprint(prisma); const prefix=`PAYROLL_NEGATIVE_${randomUUID().replaceAll('-','')}`;const rollback=Symbol("rollback-only verification");
  try {
    await prisma.$transaction(async(tx:any)=>{
      assert.equal((await tx.$queryRaw`SELECT current_database() AS name`)[0].name,"real_capita_accounts_salary_dev");
      // Synthetic employee only: no approved salary or attendance authority is
      // invented. It exists solely to exercise missing-evidence rejection.
      const employee=await tx.employee.create({data:{employeeCode:prefix.slice(-30),fullName:"Synthetic rollback-only negative fixture",designation:"Verification",joiningDate:new Date("2000-01-01T00:00:00Z")}});
      let sequence=0;let facade:any;
      facade=new Proxy(tx,{get(t,key){if(key==="$transaction")return async(work:any,options:any)=>{
        assert.equal(options.isolationLevel,"Serializable");const sp=`payroll_negative_${++sequence}`;await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
        try {const result=await work(facade);await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);return result;}
        catch(error){await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);throw error;}
      };const value=Reflect.get(t,key,t);return typeof value==="function"?value.bind(t):value;}});
      const resolver=new PayrollParentResolver(facade),calc=new MonthlyPayrollCalculationService(facade,resolver,new SalaryCalculator());
      const readiness=new PayrollReadinessService(facade,resolver,calc,new PayrollAttendanceCompletenessService()),writer=new PayrollDraftService(facade,readiness);
      const month={year:2001,month:1};assert.equal(await tx.payrollRun.count({where:{payrollYear:month.year,payrollMonth:month.month}}),0,"Test month already has payroll; stop rather than modify it");
      const employees=await tx.employee.findMany({where:{joiningDate:{lt:new Date("2001-02-01T00:00:00Z")},OR:[{separationDate:null},{separationDate:{gte:new Date("2001-01-01T00:00:00Z")}}]},select:{id:true}});
      const zero=()=>({amount:"0.00",zeroConfirmed:true});const input={...month,deductions:employees.map((e:any)=>({...month,employeeId:e.id,attendanceDeduction:zero(),providentFundDeduction:zero(),loanOrSalaryAdvanceDeduction:zero(),aitDeduction:zero(),otherApprovedDeductions:[],otherDeductionsZeroConfirmed:true}))};
      const prior=await fingerprint(tx);
      try{await writer.create(input,actorContext);assert.fail("Missing attendance was accepted");}catch(e:any){assert.equal(e.getStatus?.(),422);assert(e.getResponse().exceptions.some((b:any)=>b.employeeId===employee.id&&b.code==="ATTENDANCE_DATE_MISSING"));}
      assert.deepEqual(await fingerprint(tx),prior);pass("real DRAFT service rejects missing attendance; no run/line/audit deltas");
      // Rollback-only collision fixture, not a valid business payroll or an
      // approval source. No employee lines or audit event are fabricated.
      const run=await tx.payrollRun.create({data:{companyId:parent.id,payrollYear:month.year,payrollMonth:month.month,createdById:actor.id,companySnapshot:{verificationOnly:true}}});
      const collisionBefore=await fingerprint(tx);
      try{await writer.create(input,actorContext);assert.fail("Existing month was overwritten");}catch(e:any){assert.equal(e.getStatus?.(),409);}
      assert.deepEqual(await fingerprint(tx),collisionBefore);pass("real service returns 409 for existing month; no additional records");
      await tx.$executeRawUnsafe("SAVEPOINT duplicate_constraint");
      try{await tx.payrollRun.create({data:{companyId:parent.id,payrollYear:month.year,payrollMonth:month.month,createdById:actor.id,companySnapshot:{verificationOnly:true}}});assert.fail("Duplicate month accepted");}
      catch(e:any){assert.equal(e.code,"P2002");}
      finally{await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT duplicate_constraint");await tx.$executeRawUnsafe("RELEASE SAVEPOINT duplicate_constraint");}
      assert.equal(await tx.payrollRun.count({where:{id:run.id}}),1);pass("actual PostgreSQL duplicate-month constraint rejects creation");
      throw rollback;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:60000});
  } catch(e){if(e!==rollback)throw e;}
  assert.deepEqual(await fingerprint(prisma),before);pass("outer rollback restored all checked counts; no fixture/payroll/audit retained");
  console.log(`SKIPPED PostgreSQL successful creation/concurrent writers: no approved complete monthly fixture and verified business inputs; fabricating authority is prohibited.`);
  console.log(`${passed} actual PostgreSQL checks passed; no persistent records created`);
}
main().catch(e=>{console.error(`FAIL safe PostgreSQL verification: ${e?.code??e?.name??"ERROR"}`);process.exitCode=1;}).finally(async()=>{
  if(prisma)await prisma.$disconnect();assert(output.startsWith(join(root,"apps/api/.payroll-db-verify-")));rmSync(output,{recursive:true,force:true});
});
