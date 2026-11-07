CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');
CREATE TYPE "WorkScheduleAssignmentScope" AS ENUM ('COMPANY_DEFAULT', 'EMPLOYEE_OVERRIDE');

CREATE TABLE "work_schedules" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "code" VARCHAR(32) NOT NULL, "name" TEXT NOT NULL,
 "description" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "work_schedules_code_check" CHECK ("code" = upper(btrim("code")) AND "code" ~ '^[A-Z0-9][A-Z0-9/_-]{0,31}$'),
 CONSTRAINT "work_schedules_name_check" CHECK (btrim("name") <> '')
);
CREATE TABLE "work_schedule_days" (
 "id" TEXT NOT NULL, "workScheduleId" TEXT NOT NULL, "dayOfWeek" "DayOfWeek" NOT NULL,
 "isWorkingDay" BOOLEAN NOT NULL, "startMinuteOfDay" INTEGER, "endMinuteOfDay" INTEGER,
 "unpaidBreakMinutes" INTEGER NOT NULL DEFAULT 0, "crossesMidnight" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "work_schedule_days_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "work_schedule_days_shape_check" CHECK (
   (NOT "isWorkingDay" AND "startMinuteOfDay" IS NULL AND "endMinuteOfDay" IS NULL AND "unpaidBreakMinutes" = 0 AND NOT "crossesMidnight") OR
   ("isWorkingDay" AND "startMinuteOfDay" IS NOT NULL AND "endMinuteOfDay" IS NOT NULL AND "startMinuteOfDay" BETWEEN 0 AND 1439 AND "endMinuteOfDay" BETWEEN 0 AND 1439 AND "unpaidBreakMinutes" >= 0 AND
    ((NOT "crossesMidnight" AND "endMinuteOfDay" > "startMinuteOfDay" AND "unpaidBreakMinutes" < "endMinuteOfDay" - "startMinuteOfDay") OR
     ("crossesMidnight" AND "endMinuteOfDay" < "startMinuteOfDay" AND "unpaidBreakMinutes" < 1440 - "startMinuteOfDay" + "endMinuteOfDay")))
 )
);
CREATE TABLE "work_schedule_assignments" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "scope" "WorkScheduleAssignmentScope" NOT NULL,
 "workScheduleId" TEXT NOT NULL, "employeeId" TEXT, "effectiveFrom" DATE NOT NULL, "effectiveTo" DATE,
 "changeReason" TEXT, "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, "cancelledAt" TIMESTAMP(3), "replacesAssignmentId" TEXT,
 CONSTRAINT "work_schedule_assignments_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "work_schedule_assignments_scope_employee_check" CHECK (("scope" = 'COMPANY_DEFAULT' AND "employeeId" IS NULL) OR ("scope" = 'EMPLOYEE_OVERRIDE' AND "employeeId" IS NOT NULL)),
 CONSTRAINT "work_schedule_assignments_effective_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);
CREATE UNIQUE INDEX "work_schedules_companyId_code_key" ON "work_schedules"("companyId", "code");
CREATE UNIQUE INDEX "work_schedules_id_companyId_key" ON "work_schedules"("id", "companyId");
CREATE UNIQUE INDEX "work_schedule_days_workScheduleId_dayOfWeek_key" ON "work_schedule_days"("workScheduleId", "dayOfWeek");
CREATE INDEX "work_schedule_assignments_companyId_effectiveFrom_idx" ON "work_schedule_assignments"("companyId", "effectiveFrom");
CREATE INDEX "work_schedule_assignments_employeeId_effectiveFrom_idx" ON "work_schedule_assignments"("employeeId", "effectiveFrom");
CREATE INDEX "work_schedule_assignments_workScheduleId_idx" ON "work_schedule_assignments"("workScheduleId");
CREATE INDEX "work_schedule_assignments_createdById_idx" ON "work_schedule_assignments"("createdById");
CREATE INDEX "work_schedule_assignments_replacesAssignmentId_idx" ON "work_schedule_assignments"("replacesAssignmentId");
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_schedule_days" ADD CONSTRAINT "work_schedule_days_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "work_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_schedule_assignments" ADD CONSTRAINT "work_schedule_assignments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_schedule_assignments" ADD CONSTRAINT "work_schedule_assignments_workScheduleId_companyId_fkey" FOREIGN KEY ("workScheduleId", "companyId") REFERENCES "work_schedules"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_schedule_assignments" ADD CONSTRAINT "work_schedule_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_schedule_assignments" ADD CONSTRAINT "work_schedule_assignments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_schedule_assignments" ADD CONSTRAINT "work_schedule_assignments_replacesAssignmentId_fkey" FOREIGN KEY ("replacesAssignmentId") REFERENCES "work_schedule_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_schedule_assignments" ADD CONSTRAINT "work_schedule_assignments_default_range_excl" EXCLUDE USING gist ("companyId" WITH =, daterange("effectiveFrom", "effectiveTo", '[)') WITH &&) WHERE ("scope" = 'COMPANY_DEFAULT' AND "cancelledAt" IS NULL);
ALTER TABLE "work_schedule_assignments" ADD CONSTRAINT "work_schedule_assignments_employee_range_excl" EXCLUDE USING gist ("employeeId" WITH =, daterange("effectiveFrom", "effectiveTo", '[)') WITH &&) WHERE ("scope" = 'EMPLOYEE_OVERRIDE' AND "cancelledAt" IS NULL);
