-- AddCheckConstraint
ALTER TABLE "employees" ADD CONSTRAINT "employees_deleted_inactive_check"
    CHECK ("isDeleted" = false OR "isActive" = false);
ALTER TABLE "employees" ADD CONSTRAINT "employees_emergency_contact_group_check"
    CHECK (num_nonnulls(
        "emergencyContactName",
        "emergencyContactRelationship",
        "emergencyContactMobile"
    ) IN (0, 3));
ALTER TABLE "employees" ADD CONSTRAINT "employees_separation_date_required_check"
    CHECK ("separationReason" IS NULL OR "separationDate" IS NOT NULL);
