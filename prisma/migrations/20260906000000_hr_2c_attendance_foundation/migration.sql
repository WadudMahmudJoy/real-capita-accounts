CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE TYPE "AttendancePresenceState" AS ENUM ('PRESENT', 'ABSENT', 'INCOMPLETE', 'NOT_REQUIRED');
CREATE TYPE "AttendanceOrigin" AS ENUM ('MANUAL_ENTRY', 'MANUAL_CORRECTION', 'SYSTEM_FINALIZATION');
CREATE TYPE "AttendanceExpectedDayKind" AS ENUM ('WORKING_DAY', 'WEEKLY_REST', 'HOLIDAY', 'SPECIAL_WORKING_DAY');
CREATE TYPE "CompanyCalendarExceptionType" AS ENUM ('HOLIDAY', 'SPECIAL_WORKING_DAY');

CREATE TABLE "attendance_records" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "businessDate" DATE NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "attendance_day_finalizations" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "businessDate" DATE NOT NULL,
 "finalizedAt" TIMESTAMP(3) NOT NULL, "finalizedById" TEXT NOT NULL,
 CONSTRAINT "attendance_day_finalizations_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "attendance_policies" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "effectiveFrom" DATE NOT NULL, "effectiveTo" DATE,
 "lateGraceMinutes" INTEGER NOT NULL, "earlyLeaveGraceMinutes" INTEGER NOT NULL, "changeReason" VARCHAR(500),
 "replacesPolicyId" TEXT, "cancelledAt" TIMESTAMP(3), "cancelledById" TEXT, "cancellationReason" VARCHAR(500),
 "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "attendance_policies_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "attendance_policies_effective_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
 CONSTRAINT "attendance_policies_graces_check" CHECK ("lateGraceMinutes" >= 0 AND "earlyLeaveGraceMinutes" >= 0),
 CONSTRAINT "attendance_policies_cancelled_pair_check" CHECK (("cancelledAt" IS NULL) = ("cancelledById" IS NULL)),
 CONSTRAINT "attendance_policies_cancellation_reason_check" CHECK ("cancelledAt" IS NULL OR ("cancellationReason" IS NOT NULL AND btrim("cancellationReason") <> '')),
 CONSTRAINT "attendance_policies_replacement_reason_check" CHECK ("replacesPolicyId" IS NULL OR ("changeReason" IS NOT NULL AND btrim("changeReason") <> '')),
 CONSTRAINT "attendance_policies_change_reason_blank_check" CHECK ("changeReason" IS NULL OR btrim("changeReason") <> '')
);
CREATE TABLE "company_calendar_exceptions" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "businessDate" DATE NOT NULL, "exceptionType" "CompanyCalendarExceptionType" NOT NULL,
 "name" VARCHAR(150) NOT NULL, "startMinuteOfDay" INTEGER, "endMinuteOfDay" INTEGER,
 "unpaidBreakMinutes" INTEGER NOT NULL DEFAULT 0, "crossesMidnight" BOOLEAN NOT NULL DEFAULT false,
 "changeReason" VARCHAR(500), "replacesExceptionId" TEXT, "supersededAt" TIMESTAMP(3), "supersededById" TEXT,
 "cancelledAt" TIMESTAMP(3), "cancelledById" TEXT, "cancellationReason" VARCHAR(500),
 "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "company_calendar_exceptions_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "company_calendar_exceptions_shape_check" CHECK (
   ("exceptionType" = 'HOLIDAY' AND "startMinuteOfDay" IS NULL AND "endMinuteOfDay" IS NULL AND "unpaidBreakMinutes" = 0 AND NOT "crossesMidnight") OR
   ("exceptionType" = 'SPECIAL_WORKING_DAY' AND "startMinuteOfDay" IS NOT NULL AND "endMinuteOfDay" IS NOT NULL AND
    "startMinuteOfDay" BETWEEN 0 AND 1439 AND "endMinuteOfDay" BETWEEN 0 AND 1439 AND "endMinuteOfDay" <> "startMinuteOfDay" AND "unpaidBreakMinutes" >= 0 AND
    ((NOT "crossesMidnight" AND "endMinuteOfDay" > "startMinuteOfDay" AND "unpaidBreakMinutes" < "endMinuteOfDay" - "startMinuteOfDay") OR
     ("crossesMidnight" AND "endMinuteOfDay" < "startMinuteOfDay" AND "unpaidBreakMinutes" < 1440 - "startMinuteOfDay" + "endMinuteOfDay")))
 ),
 CONSTRAINT "company_calendar_exceptions_name_check" CHECK (btrim("name") <> ''),
 CONSTRAINT "company_calendar_exceptions_exclusive_states_check" CHECK (NOT ("supersededAt" IS NOT NULL AND "cancelledAt" IS NOT NULL)),
 CONSTRAINT "company_calendar_exceptions_superseded_pair_check" CHECK (("supersededAt" IS NULL) = ("supersededById" IS NULL)),
 CONSTRAINT "company_calendar_exceptions_cancelled_pair_check" CHECK (("cancelledAt" IS NULL) = ("cancelledById" IS NULL)),
 CONSTRAINT "company_calendar_exceptions_cancellation_reason_check" CHECK ("cancelledAt" IS NULL OR ("cancellationReason" IS NOT NULL AND btrim("cancellationReason") <> '')),
 CONSTRAINT "company_calendar_exceptions_replacement_reason_check" CHECK ("replacesExceptionId" IS NULL OR ("changeReason" IS NOT NULL AND btrim("changeReason") <> '')),
 CONSTRAINT "company_calendar_exceptions_change_reason_blank_check" CHECK ("changeReason" IS NULL OR btrim("changeReason") <> '')
);
CREATE TABLE "attendance_revisions" (
 "id" TEXT NOT NULL, "attendanceRecordId" TEXT NOT NULL, "revisionNo" INTEGER NOT NULL, "origin" "AttendanceOrigin" NOT NULL,
 "isAttendanceApplicable" BOOLEAN, "checkInAt" TIMESTAMP(3), "checkOutAt" TIMESTAMP(3), "note" VARCHAR(500),
 "expectedDayKind" "AttendanceExpectedDayKind", "workScheduleAssignmentId" TEXT, "workScheduleSource" "WorkScheduleAssignmentScope",
 "calendarExceptionId" TEXT, "attendancePolicyId" TEXT, "scheduledStartMinute" INTEGER, "scheduledEndMinute" INTEGER,
 "crossesMidnight" BOOLEAN, "unpaidBreakMinutes" INTEGER, "expectedWorkMinutes" INTEGER, "lateGraceMinutes" INTEGER, "earlyLeaveGraceMinutes" INTEGER,
 "timeZone" VARCHAR(64), "presenceState" "AttendancePresenceState", "isLate" BOOLEAN, "isEarlyLeave" BOOLEAN,
 "isNonWorkingDayAttendance" BOOLEAN, "arrivalDelayMinutes" INTEGER, "earlyDepartureMinutes" INTEGER, "changeReason" VARCHAR(500),
 "createdById" TEXT NOT NULL, "finalizedById" TEXT, "finalizedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "attendance_revisions_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "attendance_revisions_revisionNo_check" CHECK ("revisionNo" >= 1),
 CONSTRAINT "attendance_revisions_finalized_pair_check" CHECK (("finalizedAt" IS NULL) = ("finalizedById" IS NULL)),
 CONSTRAINT "attendance_revisions_origin_finalized_check" CHECK ("origin" NOT IN ('MANUAL_CORRECTION','SYSTEM_FINALIZATION') OR "finalizedAt" IS NOT NULL),
 CONSTRAINT "attendance_revisions_change_reason_check" CHECK (("origin" = 'MANUAL_CORRECTION') = ("changeReason" IS NOT NULL)),
 CONSTRAINT "attendance_revisions_change_reason_blank_check" CHECK ("changeReason" IS NULL OR btrim("changeReason") <> ''),
 CONSTRAINT "attendance_revisions_checkout_requires_checkin_check" CHECK ("checkOutAt" IS NULL OR "checkInAt" IS NOT NULL),
 CONSTRAINT "attendance_revisions_punch_order_check" CHECK ("checkInAt" IS NULL OR "checkOutAt" IS NULL OR "checkOutAt" > "checkInAt"),
 CONSTRAINT "attendance_revisions_arrival_nonnegative_check" CHECK ("arrivalDelayMinutes" IS NULL OR "arrivalDelayMinutes" >= 0),
 CONSTRAINT "attendance_revisions_departure_nonnegative_check" CHECK ("earlyDepartureMinutes" IS NULL OR "earlyDepartureMinutes" >= 0),
 CONSTRAINT "attendance_revisions_finalized_applicable_check" CHECK ("finalizedAt" IS NULL OR "isAttendanceApplicable" IS NOT NULL),
 CONSTRAINT "attendance_revisions_draft_applicable_null_check" CHECK ("finalizedAt" IS NOT NULL OR "isAttendanceApplicable" IS NULL),
 CONSTRAINT "attendance_revisions_system_finalization_applicable_check" CHECK ("origin" <> 'SYSTEM_FINALIZATION' OR "isAttendanceApplicable" = true),
 CONSTRAINT "attendance_revisions_void_origin_check" CHECK ("isAttendanceApplicable" IS DISTINCT FROM false OR "origin" = 'MANUAL_CORRECTION'),
 CONSTRAINT "attendance_revisions_draft_shape_check" CHECK (
   "finalizedAt" IS NOT NULL OR (
     "origin" = 'MANUAL_ENTRY' AND "isAttendanceApplicable" IS NULL AND "changeReason" IS NULL AND "finalizedById" IS NULL AND
     "expectedDayKind" IS NULL AND "workScheduleAssignmentId" IS NULL AND "workScheduleSource" IS NULL AND "calendarExceptionId" IS NULL AND "attendancePolicyId" IS NULL AND
     "scheduledStartMinute" IS NULL AND "scheduledEndMinute" IS NULL AND "crossesMidnight" IS NULL AND "unpaidBreakMinutes" IS NULL AND "expectedWorkMinutes" IS NULL AND
     "lateGraceMinutes" IS NULL AND "earlyLeaveGraceMinutes" IS NULL AND "timeZone" IS NULL AND "presenceState" IS NULL AND
     "isLate" IS NULL AND "isEarlyLeave" IS NULL AND "isNonWorkingDayAttendance" IS NULL AND "arrivalDelayMinutes" IS NULL AND "earlyDepartureMinutes" IS NULL
   )
 ),
 CONSTRAINT "attendance_revisions_void_shape_check" CHECK (
   "isAttendanceApplicable" IS DISTINCT FROM false OR (
     "presenceState" IS NULL AND "expectedDayKind" IS NULL AND "timeZone" IS NULL AND
     "workScheduleAssignmentId" IS NULL AND "workScheduleSource" IS NULL AND "calendarExceptionId" IS NULL AND "attendancePolicyId" IS NULL AND
     "scheduledStartMinute" IS NULL AND "scheduledEndMinute" IS NULL AND "crossesMidnight" IS NULL AND "unpaidBreakMinutes" IS NULL AND "expectedWorkMinutes" IS NULL AND
     "lateGraceMinutes" IS NULL AND "earlyLeaveGraceMinutes" IS NULL AND
     "isLate" IS NULL AND "isEarlyLeave" IS NULL AND "isNonWorkingDayAttendance" IS NULL AND "arrivalDelayMinutes" IS NULL AND "earlyDepartureMinutes" IS NULL
   )
 ),
 CONSTRAINT "attendance_revisions_finalized_core_check" CHECK (
   "isAttendanceApplicable" IS DISTINCT FROM true OR (
     "expectedDayKind" IS NOT NULL AND "timeZone" = 'Asia/Dhaka' AND
     "presenceState" IS NOT NULL AND "isLate" IS NOT NULL AND "isEarlyLeave" IS NOT NULL AND "isNonWorkingDayAttendance" IS NOT NULL
   )
 ),
 CONSTRAINT "attendance_revisions_expected_kind_shape_check" CHECK (
   "isAttendanceApplicable" IS DISTINCT FROM true OR
   ("expectedDayKind" = 'WORKING_DAY' AND "workScheduleAssignmentId" IS NOT NULL AND "workScheduleSource" IS NOT NULL AND "calendarExceptionId" IS NULL AND
    "scheduledStartMinute" IS NOT NULL AND "scheduledEndMinute" IS NOT NULL AND "crossesMidnight" IS NOT NULL AND "unpaidBreakMinutes" IS NOT NULL AND "expectedWorkMinutes" IS NOT NULL AND
    "attendancePolicyId" IS NOT NULL AND "lateGraceMinutes" IS NOT NULL AND "earlyLeaveGraceMinutes" IS NOT NULL) OR
   ("expectedDayKind" = 'SPECIAL_WORKING_DAY' AND "calendarExceptionId" IS NOT NULL AND "workScheduleAssignmentId" IS NULL AND "workScheduleSource" IS NULL AND
    "scheduledStartMinute" IS NOT NULL AND "scheduledEndMinute" IS NOT NULL AND "crossesMidnight" IS NOT NULL AND "unpaidBreakMinutes" IS NOT NULL AND "expectedWorkMinutes" IS NOT NULL AND
    "attendancePolicyId" IS NOT NULL AND "lateGraceMinutes" IS NOT NULL AND "earlyLeaveGraceMinutes" IS NOT NULL) OR
   ("expectedDayKind" = 'WEEKLY_REST' AND "workScheduleAssignmentId" IS NOT NULL AND "workScheduleSource" IS NOT NULL AND "calendarExceptionId" IS NULL AND
    "scheduledStartMinute" IS NULL AND "scheduledEndMinute" IS NULL AND "crossesMidnight" IS NULL AND "unpaidBreakMinutes" IS NULL AND "expectedWorkMinutes" IS NULL AND
    "attendancePolicyId" IS NULL AND "lateGraceMinutes" IS NULL AND "earlyLeaveGraceMinutes" IS NULL) OR
   ("expectedDayKind" = 'HOLIDAY' AND "calendarExceptionId" IS NOT NULL AND "workScheduleAssignmentId" IS NULL AND "workScheduleSource" IS NULL AND
    "scheduledStartMinute" IS NULL AND "scheduledEndMinute" IS NULL AND "crossesMidnight" IS NULL AND "unpaidBreakMinutes" IS NULL AND "expectedWorkMinutes" IS NULL AND
    "attendancePolicyId" IS NULL AND "lateGraceMinutes" IS NULL AND "earlyLeaveGraceMinutes" IS NULL)
 ),
 CONSTRAINT "attendance_revisions_presence_shape_check" CHECK (
   "isAttendanceApplicable" IS DISTINCT FROM true OR (
     ("presenceState" = 'PRESENT' AND "checkInAt" IS NOT NULL AND "checkOutAt" IS NOT NULL AND "checkOutAt" > "checkInAt") OR
     ("presenceState" = 'INCOMPLETE' AND "checkInAt" IS NOT NULL AND "checkOutAt" IS NULL) OR
     ("presenceState" = 'ABSENT' AND "checkInAt" IS NULL AND "checkOutAt" IS NULL AND "expectedDayKind" IN ('WORKING_DAY','SPECIAL_WORKING_DAY')) OR
     ("presenceState" = 'NOT_REQUIRED' AND "checkInAt" IS NULL AND "checkOutAt" IS NULL AND "expectedDayKind" IN ('WEEKLY_REST','HOLIDAY') AND "isNonWorkingDayAttendance" = false)
   )
 ),
 CONSTRAINT "attendance_revisions_nonworking_attendance_check" CHECK (
   "isAttendanceApplicable" IS DISTINCT FROM true OR
   ("isNonWorkingDayAttendance" = ("checkInAt" IS NOT NULL AND "expectedDayKind" IN ('WEEKLY_REST','HOLIDAY')))
 ),
 CONSTRAINT "attendance_revisions_nonworking_nulls_check" CHECK (
   "isAttendanceApplicable" IS DISTINCT FROM true OR
   ("expectedDayKind" NOT IN ('WEEKLY_REST','HOLIDAY') OR ("isLate" = false AND "isEarlyLeave" = false AND "arrivalDelayMinutes" IS NULL AND "earlyDepartureMinutes" IS NULL))
 ),
 CONSTRAINT "attendance_revisions_factual_minutes_check" CHECK (
   "isAttendanceApplicable" IS DISTINCT FROM true OR "expectedDayKind" NOT IN ('WORKING_DAY','SPECIAL_WORKING_DAY') OR (
     ("presenceState" = 'ABSENT' AND "arrivalDelayMinutes" IS NULL AND "earlyDepartureMinutes" IS NULL AND "isLate" = false AND "isEarlyLeave" = false) OR
     ("presenceState" = 'INCOMPLETE' AND "arrivalDelayMinutes" IS NOT NULL AND "earlyDepartureMinutes" IS NULL AND "isLate" = ("arrivalDelayMinutes" > "lateGraceMinutes") AND "isEarlyLeave" = false) OR
     ("presenceState" = 'PRESENT' AND "arrivalDelayMinutes" IS NOT NULL AND "earlyDepartureMinutes" IS NOT NULL AND "isLate" = ("arrivalDelayMinutes" > "lateGraceMinutes") AND "isEarlyLeave" = ("earlyDepartureMinutes" > "earlyLeaveGraceMinutes"))
   )
 )
);
CREATE UNIQUE INDEX "attendance_records_employeeId_businessDate_key" ON "attendance_records"("employeeId", "businessDate");
CREATE INDEX "attendance_records_companyId_businessDate_idx" ON "attendance_records"("companyId", "businessDate");
CREATE UNIQUE INDEX "attendance_revisions_attendanceRecordId_revisionNo_key" ON "attendance_revisions"("attendanceRecordId", "revisionNo");
CREATE INDEX "attendance_revisions_attendanceRecordId_finalizedAt_idx" ON "attendance_revisions"("attendanceRecordId", "finalizedAt");
CREATE INDEX "attendance_revisions_createdById_idx" ON "attendance_revisions"("createdById");
CREATE INDEX "attendance_revisions_finalizedById_idx" ON "attendance_revisions"("finalizedById");
CREATE INDEX "attendance_revisions_attendancePolicyId_idx" ON "attendance_revisions"("attendancePolicyId");
CREATE INDEX "attendance_revisions_calendarExceptionId_idx" ON "attendance_revisions"("calendarExceptionId");
CREATE INDEX "attendance_revisions_workScheduleAssignmentId_idx" ON "attendance_revisions"("workScheduleAssignmentId");
CREATE UNIQUE INDEX "attendance_revisions_draft_unique" ON "attendance_revisions"("attendanceRecordId") WHERE "finalizedAt" IS NULL;
CREATE UNIQUE INDEX "attendance_day_finalizations_companyId_businessDate_key" ON "attendance_day_finalizations"("companyId", "businessDate");
CREATE INDEX "attendance_day_finalizations_finalizedById_idx" ON "attendance_day_finalizations"("finalizedById");
CREATE INDEX "attendance_policies_companyId_effectiveFrom_idx" ON "attendance_policies"("companyId", "effectiveFrom");
CREATE INDEX "attendance_policies_replacesPolicyId_idx" ON "attendance_policies"("replacesPolicyId");
CREATE INDEX "attendance_policies_createdById_idx" ON "attendance_policies"("createdById");
CREATE INDEX "attendance_policies_cancelledById_idx" ON "attendance_policies"("cancelledById");
CREATE UNIQUE INDEX "attendance_policies_replaces_policy_unique" ON "attendance_policies"("replacesPolicyId") WHERE ("cancelledAt" IS NULL AND "replacesPolicyId" IS NOT NULL);
CREATE UNIQUE INDEX "company_calendar_exceptions_id_companyId_businessDate_key" ON "company_calendar_exceptions"("id", "companyId", "businessDate");
CREATE INDEX "company_calendar_exceptions_companyId_businessDate_idx" ON "company_calendar_exceptions"("companyId", "businessDate");
CREATE INDEX "company_calendar_exceptions_replacesExceptionId_idx" ON "company_calendar_exceptions"("replacesExceptionId");
CREATE INDEX "company_calendar_exceptions_supersededById_idx" ON "company_calendar_exceptions"("supersededById");
CREATE INDEX "company_calendar_exceptions_cancelledById_idx" ON "company_calendar_exceptions"("cancelledById");
CREATE INDEX "company_calendar_exceptions_createdById_idx" ON "company_calendar_exceptions"("createdById");
CREATE UNIQUE INDEX "company_calendar_exceptions_live_unique" ON "company_calendar_exceptions"("companyId", "businessDate") WHERE ("supersededAt" IS NULL AND "cancelledAt" IS NULL);
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_day_finalizations" ADD CONSTRAINT "attendance_day_finalizations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_day_finalizations" ADD CONSTRAINT "attendance_day_finalizations_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_replacesPolicyId_fkey" FOREIGN KEY ("replacesPolicyId") REFERENCES "attendance_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_calendar_exceptions" ADD CONSTRAINT "company_calendar_exceptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_calendar_exceptions" ADD CONSTRAINT "company_calendar_exceptions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_calendar_exceptions" ADD CONSTRAINT "company_calendar_exceptions_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_calendar_exceptions" ADD CONSTRAINT "company_calendar_exceptions_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_calendar_exceptions" ADD CONSTRAINT "company_calendar_exceptions_replacesExceptionId_companyId_businessDate_fkey" FOREIGN KEY ("replacesExceptionId", "companyId", "businessDate") REFERENCES "company_calendar_exceptions"("id", "companyId", "businessDate") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_revisions" ADD CONSTRAINT "attendance_revisions_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "attendance_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_revisions" ADD CONSTRAINT "attendance_revisions_workScheduleAssignmentId_fkey" FOREIGN KEY ("workScheduleAssignmentId") REFERENCES "work_schedule_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_revisions" ADD CONSTRAINT "attendance_revisions_calendarExceptionId_fkey" FOREIGN KEY ("calendarExceptionId") REFERENCES "company_calendar_exceptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_revisions" ADD CONSTRAINT "attendance_revisions_attendancePolicyId_fkey" FOREIGN KEY ("attendancePolicyId") REFERENCES "attendance_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_revisions" ADD CONSTRAINT "attendance_revisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_revisions" ADD CONSTRAINT "attendance_revisions_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_live_range_excl" EXCLUDE USING gist ("companyId" WITH =, daterange("effectiveFrom", "effectiveTo", '[)') WITH &&) WHERE ("cancelledAt" IS NULL);
CREATE FUNCTION "attendance_revisions_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Finalized attendance revisions are immutable.';
END;
$$ LANGUAGE plpgsql;
CREATE FUNCTION "attendance_day_finalizations_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Attendance day finalizations are write-once.';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "attendance_revisions_finalized_update_guard" BEFORE UPDATE ON "attendance_revisions" FOR EACH ROW WHEN (OLD."finalizedAt" IS NOT NULL) EXECUTE FUNCTION "attendance_revisions_immutable"();
CREATE TRIGGER "attendance_revisions_finalized_delete_guard" BEFORE DELETE ON "attendance_revisions" FOR EACH ROW WHEN (OLD."finalizedAt" IS NOT NULL) EXECUTE FUNCTION "attendance_revisions_immutable"();
CREATE TRIGGER "attendance_day_finalizations_immutable_guard" BEFORE UPDATE OR DELETE ON "attendance_day_finalizations" FOR EACH ROW EXECUTE FUNCTION "attendance_day_finalizations_immutable"();
