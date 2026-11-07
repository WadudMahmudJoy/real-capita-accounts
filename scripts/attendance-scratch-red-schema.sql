-- TEST-ONLY scratch RED schema (structural only; HR-2C business protections intentionally absent).
-- Column lists are subsets of the real schema so one fixture path serves both this scratch
-- schema and the fully migrated final schema.

DO $$ BEGIN
  CREATE TYPE "AttendancePresenceState" AS ENUM ('PRESENT', 'ABSENT', 'INCOMPLETE', 'NOT_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AttendanceOrigin" AS ENUM ('MANUAL_ENTRY', 'MANUAL_CORRECTION', 'SYSTEM_FINALIZATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AttendanceExpectedDayKind" AS ENUM ('WORKING_DAY', 'WEEKLY_REST', 'HOLIDAY', 'SPECIAL_WORKING_DAY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CompanyCalendarExceptionType" AS ENUM ('HOLIDAY', 'SPECIAL_WORKING_DAY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "WorkScheduleAssignmentScope" AS ENUM ('COMPANY_DEFAULT', 'EMPLOYEE_OVERRIDE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "companies" (
 "id" TEXT NOT NULL, "singletonKey" TEXT NOT NULL, "name" TEXT NOT NULL, "currency" TEXT NOT NULL DEFAULT 'BDT',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "users" (
 "id" TEXT NOT NULL, "email" TEXT NOT NULL, "fullName" TEXT NOT NULL, "passwordHash" TEXT NOT NULL,
 "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "employees" (
 "id" TEXT NOT NULL, "employeeCode" TEXT NOT NULL, "fullName" TEXT NOT NULL, "designation" TEXT NOT NULL,
 "joiningDate" TIMESTAMP(3) NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "isDeleted" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "work_schedules" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "code" VARCHAR(32) NOT NULL, "name" TEXT NOT NULL,
 "description" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "work_schedule_assignments" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "scope" "WorkScheduleAssignmentScope" NOT NULL,
 "workScheduleId" TEXT NOT NULL, "employeeId" TEXT, "effectiveFrom" DATE NOT NULL, "effectiveTo" DATE,
 "changeReason" TEXT, "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, "cancelledAt" TIMESTAMP(3), "replacesAssignmentId" TEXT,
 CONSTRAINT "work_schedule_assignments_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "attendance_records" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "businessDate" DATE NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "attendance_day_finalizations" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "businessDate" DATE NOT NULL,
 "finalizedAt" TIMESTAMP(3) NOT NULL, "finalizedById" TEXT NOT NULL,
 CONSTRAINT "attendance_day_finalizations_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "attendance_policies" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "effectiveFrom" DATE NOT NULL, "effectiveTo" DATE,
 "lateGraceMinutes" INTEGER NOT NULL, "earlyLeaveGraceMinutes" INTEGER NOT NULL, "changeReason" VARCHAR(500),
 "replacesPolicyId" TEXT, "cancelledAt" TIMESTAMP(3), "cancelledById" TEXT, "cancellationReason" VARCHAR(500),
 "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "attendance_policies_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "company_calendar_exceptions" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "businessDate" DATE NOT NULL, "exceptionType" "CompanyCalendarExceptionType" NOT NULL,
 "name" VARCHAR(150) NOT NULL, "startMinuteOfDay" INTEGER, "endMinuteOfDay" INTEGER,
 "unpaidBreakMinutes" INTEGER NOT NULL DEFAULT 0, "crossesMidnight" BOOLEAN NOT NULL DEFAULT false,
 "changeReason" VARCHAR(500), "replacesExceptionId" TEXT, "supersededAt" TIMESTAMP(3), "supersededById" TEXT,
 "cancelledAt" TIMESTAMP(3), "cancelledById" TEXT, "cancellationReason" VARCHAR(500),
 "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "company_calendar_exceptions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "attendance_revisions" (
 "id" TEXT NOT NULL, "attendanceRecordId" TEXT NOT NULL, "revisionNo" INTEGER NOT NULL, "origin" "AttendanceOrigin" NOT NULL,
 "isAttendanceApplicable" BOOLEAN, "checkInAt" TIMESTAMP(3), "checkOutAt" TIMESTAMP(3), "note" VARCHAR(500),
 "expectedDayKind" "AttendanceExpectedDayKind", "workScheduleAssignmentId" TEXT, "workScheduleSource" "WorkScheduleAssignmentScope",
 "calendarExceptionId" TEXT, "attendancePolicyId" TEXT, "scheduledStartMinute" INTEGER, "scheduledEndMinute" INTEGER,
 "crossesMidnight" BOOLEAN, "unpaidBreakMinutes" INTEGER, "expectedWorkMinutes" INTEGER, "lateGraceMinutes" INTEGER, "earlyLeaveGraceMinutes" INTEGER,
 "timeZone" VARCHAR(64), "presenceState" "AttendancePresenceState", "isLate" BOOLEAN, "isEarlyLeave" BOOLEAN,
 "isNonWorkingDayAttendance" BOOLEAN, "arrivalDelayMinutes" INTEGER, "earlyDepartureMinutes" INTEGER, "changeReason" VARCHAR(500),
 "createdById" TEXT NOT NULL, "finalizedById" TEXT, "finalizedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "attendance_revisions_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "attendance_records" DROP CONSTRAINT IF EXISTS "attendance_records_companyId_scratch_fkey";
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_companyId_scratch_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_records" DROP CONSTRAINT IF EXISTS "attendance_records_employeeId_scratch_fkey";
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employeeId_scratch_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_day_finalizations" DROP CONSTRAINT IF EXISTS "attendance_day_finalizations_companyId_scratch_fkey";
ALTER TABLE "attendance_day_finalizations" ADD CONSTRAINT "attendance_day_finalizations_companyId_scratch_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_day_finalizations" DROP CONSTRAINT IF EXISTS "attendance_day_finalizations_finalizedById_scratch_fkey";
ALTER TABLE "attendance_day_finalizations" ADD CONSTRAINT "attendance_day_finalizations_finalizedById_scratch_fkey" FOREIGN KEY ("finalizedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_policies" DROP CONSTRAINT IF EXISTS "attendance_policies_companyId_scratch_fkey";
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_companyId_scratch_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_policies" DROP CONSTRAINT IF EXISTS "attendance_policies_createdById_scratch_fkey";
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_createdById_scratch_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_policies" DROP CONSTRAINT IF EXISTS "attendance_policies_replacesPolicyId_scratch_fkey";
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_replacesPolicyId_scratch_fkey" FOREIGN KEY ("replacesPolicyId") REFERENCES "attendance_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_calendar_exceptions" DROP CONSTRAINT IF EXISTS "company_calendar_exceptions_companyId_scratch_fkey";
ALTER TABLE "company_calendar_exceptions" ADD CONSTRAINT "company_calendar_exceptions_companyId_scratch_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_calendar_exceptions" DROP CONSTRAINT IF EXISTS "company_calendar_exceptions_createdById_scratch_fkey";
ALTER TABLE "company_calendar_exceptions" ADD CONSTRAINT "company_calendar_exceptions_createdById_scratch_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_revisions" DROP CONSTRAINT IF EXISTS "attendance_revisions_attendanceRecordId_scratch_fkey";
ALTER TABLE "attendance_revisions" ADD CONSTRAINT "attendance_revisions_attendanceRecordId_scratch_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "attendance_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_revisions" DROP CONSTRAINT IF EXISTS "attendance_revisions_workScheduleAssignmentId_scratch_fkey";
ALTER TABLE "attendance_revisions" ADD CONSTRAINT "attendance_revisions_workScheduleAssignmentId_scratch_fkey" FOREIGN KEY ("workScheduleAssignmentId") REFERENCES "work_schedule_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_revisions" DROP CONSTRAINT IF EXISTS "attendance_revisions_calendarExceptionId_scratch_fkey";
ALTER TABLE "attendance_revisions" ADD CONSTRAINT "attendance_revisions_calendarExceptionId_scratch_fkey" FOREIGN KEY ("calendarExceptionId") REFERENCES "company_calendar_exceptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_revisions" DROP CONSTRAINT IF EXISTS "attendance_revisions_attendancePolicyId_scratch_fkey";
ALTER TABLE "attendance_revisions" ADD CONSTRAINT "attendance_revisions_attendancePolicyId_scratch_fkey" FOREIGN KEY ("attendancePolicyId") REFERENCES "attendance_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_revisions" DROP CONSTRAINT IF EXISTS "attendance_revisions_createdById_scratch_fkey";
ALTER TABLE "attendance_revisions" ADD CONSTRAINT "attendance_revisions_createdById_scratch_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_revisions" DROP CONSTRAINT IF EXISTS "attendance_revisions_finalizedById_scratch_fkey";
ALTER TABLE "attendance_revisions" ADD CONSTRAINT "attendance_revisions_finalizedById_scratch_fkey" FOREIGN KEY ("finalizedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
