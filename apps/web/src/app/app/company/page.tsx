"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getCompanies,
  switchCompany,
  toErrorMessage,
  type Company,
} from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  LoadingPanel,
  Notice,
  PageIntro,
} from "../_components/ui";
import { OfficeEditor } from "./_components/OfficeEditor";
import { OfficeList } from "./_components/OfficeList";
import { notifyOfficeBrandingUpdated } from "../_lib/office-theme";

type PageNotice = {
  tone: "error" | "success";
  message: string;
};

// Only persisted changes to the theme-affecting branding fields notify the
// office theme shell: brandAccentColor, backgroundMode, and the custom
// background (its path changes on upload/remove). Basic Info and print-only
// saves never dispatch, and editing any office merely notifies — the shell
// still resolves theme authority from the activeCompanyId refetch.
function reflectsThemeChange(
  previous: Company | undefined,
  updated: Company,
): boolean {
  if (!previous) {
    return true;
  }
  return (
    previous.brandAccentColor !== updated.brandAccentColor ||
    previous.backgroundMode !== updated.backgroundMode ||
    previous.customBackgroundPath !== updated.customBackgroundPath
  );
}

export default function CompanyPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [switchingCompanyId, setSwitchingCompanyId] = useState<string | null>(
    null,
  );
  const [pageNotice, setPageNotice] = useState<PageNotice | null>(null);
  const [mediaRevision, setMediaRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const result = await getCompanies(controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        setCompanies(result.companies);
        setActiveCompanyId(result.activeCompanyId);
        setStatus("ready");
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }

        setLoadError(toErrorMessage(caught));
        setStatus("error");
      }
    }

    void load();

    return () => controller.abort();
  }, [router]);

  async function refreshCompanies(): Promise<void> {
    const result = await getCompanies();
    setCompanies(result.companies);
    setActiveCompanyId(result.activeCompanyId);
  }

  // Selecting an office for editing only changes the editor target. It never
  // touches the session's active office; only an explicit Switch does that.
  function handleSelectForEditing(company: Company): void {
    setEditingCompanyId(company.id);
    setEditingCompany(company);
    setIsCreating(false);
    setPageNotice(null);
  }

  function handleAddOffice(): void {
    setIsCreating(true);
    setEditingCompanyId(null);
    setEditingCompany(null);
    setPageNotice(null);
  }

  function handleCloseEditor(): void {
    setIsCreating(false);
    setEditingCompanyId(null);
    setEditingCompany(null);
  }

  // After creation the new office is selected for editing. The office list is
  // refreshed from the server so the active office reflects reality: the
  // backend binds the first-ever company automatically, while any existing
  // active office stays selected.
  async function handleCompanyCreated(created: Company): Promise<void> {
    setEditingCompanyId(created.id);
    setEditingCompany(created);
    setIsCreating(false);

    try {
      await refreshCompanies();
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }
      setPageNotice({ tone: "error", message: toErrorMessage(caught) });
      return;
    }

    setPageNotice({
      tone: "success",
      message: `Office "${created.name}" was created and is now selected for editing.`,
    });
  }

  function handleCompanySaved(updated: Company): void {
    const previous = companies.find((company) => company.id === updated.id);
    setCompanies((currentCompanies) =>
      currentCompanies.map((company) =>
        company.id === updated.id ? updated : company,
      ),
    );
    if (editingCompanyId === updated.id) {
      setEditingCompany(updated);
    }
    if (reflectsThemeChange(previous, updated)) {
      notifyOfficeBrandingUpdated();
    }
  }

  function handleCompanyMediaChanged(updated: Company): void {
    handleCompanySaved(updated);
    setMediaRevision((revision) => revision + 1);
  }

  async function handleSwitchCompany(company: Company): Promise<void> {
    setSwitchingCompanyId(company.id);
    setPageNotice(null);

    try {
      const result = await switchCompany(company.id);
      setActiveCompanyId(result.activeCompanyId);
      setCompanies((previous) =>
        previous.map((item) =>
          item.id === result.company.id ? result.company : item,
        ),
      );
      setPageNotice({
        tone: "success",
        message: `Active office switched to "${result.company.name}".`,
      });
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }
      setPageNotice({ tone: "error", message: toErrorMessage(caught) });
    } finally {
      setSwitchingCompanyId(null);
    }
  }

  const isEditing = editingCompany !== null;

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        description="Manage the offices of your organisation. Edit an office profile, add a new office, or switch the office you are actively working in."
        title="Company Setup"
      />

      {status === "loading" ? (
        <LoadingPanel message="Loading offices..." />
      ) : null}

      {status === "error" ? (
        <Notice tone="error">{loadError}</Notice>
      ) : null}

      {status === "ready" ? (
        <Card>
          <CardHeader
            actions={
              <Button onClick={handleAddOffice} type="button">
                + Add Office
              </Button>
            }
            description="All company offices available in this accounting system. The current office indicator marks your active session."
            title="Offices"
          />

          <div className="mt-6">
            {companies.length === 0 ? (
              <EmptyState
                description="No office exists yet. Add the first office to begin."
                title="No offices yet"
              />
            ) : (
              <OfficeList
                activeCompanyId={activeCompanyId}
                companies={companies}
                editingCompanyId={editingCompanyId}
                onEdit={handleSelectForEditing}
                onSwitch={(company) => void handleSwitchCompany(company)}
                switchingCompanyId={switchingCompanyId}
              />
            )}
          </div>

          {pageNotice ? (
            <div className="mt-4">
              <Notice tone={pageNotice.tone}>{pageNotice.message}</Notice>
            </div>
          ) : null}
        </Card>
      ) : null}

      {status === "ready" && (isCreating || isEditing) ? (
        <OfficeEditor
          company={isCreating ? null : editingCompany}
          isActiveOffice={
            !isCreating &&
            editingCompany !== null &&
            editingCompany.id === activeCompanyId
          }
          key={isCreating ? "create" : editingCompanyId ?? "edit"}
          mediaRevision={mediaRevision}
          onCancel={handleCloseEditor}
          onCreated={(created) => void handleCompanyCreated(created)}
          onMediaChanged={handleCompanyMediaChanged}
          onSaved={handleCompanySaved}
        />
      ) : null}
    </div>
  );
}
