"use client";

import type { Company } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button, StatusBadge } from "../../_components/ui";

type OfficeListProps = {
  companies: Company[];
  activeCompanyId: string | null;
  editingCompanyId: string | null;
  switchingCompanyId: string | null;
  onEdit: (company: Company) => void;
  onSwitch: (company: Company) => void;
};

function OfficeCard({
  company,
  activeCompanyId,
  isEditing,
  isSwitching,
  onEdit,
  onSwitch,
}: {
  company: Company;
  activeCompanyId: string | null;
  isEditing: boolean;
  isSwitching: boolean;
  onEdit: (company: Company) => void;
  onSwitch: (company: Company) => void;
}) {
  const isCurrentOffice = company.id === activeCompanyId;
  const canSwitch = company.isActive && !isCurrentOffice;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-[0_8px_24px_rgba(24,92,103,0.07)]",
        isEditing ? "border-ring" : "border-border",
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <p className="text-base font-semibold text-foreground">
              {company.name}
            </p>
            {company.legalName ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {company.legalName}
              </p>
            ) : null}
          </div>
          <StatusBadge tone={company.isActive ? "active" : "inactive"}>
            {company.isActive ? "Active" : "Inactive"}
          </StatusBadge>
        </div>

        {isCurrentOffice ? (
          <StatusBadge tone="neutral">Current office</StatusBadge>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button
          disabled={isSwitching}
          onClick={() => onEdit(company)}
          type="button"
          variant="secondary"
        >
          Edit
        </Button>
        <Button
          disabled={!canSwitch || isSwitching}
          onClick={() => onSwitch(company)}
          title={
            company.isActive
              ? undefined
              : "This office is inactive and cannot be selected."
          }
          type="button"
          variant="primary"
        >
          {isCurrentOffice
            ? "Current office"
            : isSwitching
              ? "Switching..."
              : "Switch"}
        </Button>
      </div>
    </div>
  );
}

/**
 * All offices of the accounting system. Cards distinguish the caller's
 * active office from the office currently being edited; switching is the
 * only action that changes the session's active company.
 */
export function OfficeList({
  companies,
  activeCompanyId,
  editingCompanyId,
  switchingCompanyId,
  onEdit,
  onSwitch,
}: OfficeListProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {companies.map((company) => (
        <OfficeCard
          activeCompanyId={activeCompanyId}
          company={company}
          isEditing={editingCompanyId === company.id}
          isSwitching={switchingCompanyId === company.id}
          key={company.id}
          onEdit={onEdit}
          onSwitch={onSwitch}
        />
      ))}
    </div>
  );
}
