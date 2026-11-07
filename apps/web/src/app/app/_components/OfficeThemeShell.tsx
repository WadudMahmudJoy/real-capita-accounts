"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  companyMediaUrl,
  getCompanies,
  type CompanyListResponse,
} from "@/lib/api";
import {
  OFFICE_BRANDING_UPDATED_EVENT,
  resolveOfficeTheme,
} from "../_lib/office-theme";

type CustomBackgroundStatus = "none" | "checking" | "ready" | "failed";

/**
 * Presentation-only office theme shell. It resolves the ACTIVE office from
 * the authoritative company list (activeCompanyId equality), derives the
 * safe theme, and applies CSS custom properties plus the workspace
 * background treatment to the common app shell so the sidebar and workspace
 * inherit matching shades. It never creates, updates, switches, or mutates
 * companies: theme authority is always the refetched activeCompanyId.
 */
export function OfficeThemeShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [companyList, setCompanyList] =
    useState<CompanyListResponse | null>(null);
  const [mediaRevision, setMediaRevision] = useState(0);
  const [loadedBackgroundUrl, setLoadedBackgroundUrl] = useState<string | null>(
    null,
  );
  const [failedBackgroundUrl, setFailedBackgroundUrl] = useState<
    string | null
  >(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOfficeContext() {
      try {
        const result = await getCompanies(controller.signal);
        setCompanyList(result);
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }

        // Theme resolution must never break the application: the existing
        // default Real Capita treatment stays active.
      }
    }

    void loadOfficeContext();

    return () => controller.abort();
  }, [router]);

  // D8 branding saves/uploads dispatch the narrow refresh event; refetch the
  // company context and bump the media revision so replaced custom
  // backgrounds are re-requested (cache-busted). Theme authority remains the
  // refetched activeCompanyId, so editing a non-active office never themes
  // the workspace.
  useEffect(() => {
    function handleBrandingUpdated() {
      setMediaRevision((revision) => revision + 1);
      getCompanies()
        .then((result) => setCompanyList(result))
        .catch(() => undefined);
    }

    window.addEventListener(
      OFFICE_BRANDING_UPDATED_EVENT,
      handleBrandingUpdated,
    );

    return () =>
      window.removeEventListener(
        OFFICE_BRANDING_UPDATED_EVENT,
        handleBrandingUpdated,
      );
  }, []);

  const activeCompany = useMemo(() => {
    if (!companyList) {
      return null;
    }
    return (
      companyList.companies.find(
        (company) => company.id === companyList.activeCompanyId,
      ) ?? null
    );
  }, [companyList]);

  const theme = useMemo(
    () => resolveOfficeTheme(activeCompany?.brandAccentColor ?? null),
    [activeCompany?.brandAccentColor],
  );

  // CUSTOM mode: customBackgroundPath is only a presence signal; the image is
  // requested from the public D7B media endpoint and validated by a browser
  // preload. A broken or missing image falls back to the premium treatment.
  // The load outcome is recorded per URL so a cache-busted replacement is
  // revalidated, and the applied status is derived — never set synchronously.
  const customBackgroundCandidate = useMemo(() => {
    if (
      activeCompany &&
      activeCompany.backgroundMode === "CUSTOM" &&
      activeCompany.customBackgroundPath !== null
    ) {
      return companyMediaUrl(
        activeCompany.id,
        "custom-background",
        mediaRevision,
      );
    }
    return null;
  }, [activeCompany, mediaRevision]);

  const customBackgroundStatus: CustomBackgroundStatus =
    customBackgroundCandidate === null
      ? "none"
      : loadedBackgroundUrl === customBackgroundCandidate
        ? "ready"
        : failedBackgroundUrl === customBackgroundCandidate
          ? "failed"
          : "checking";

  useEffect(() => {
    if (customBackgroundCandidate === null) {
      return;
    }
    if (
      loadedBackgroundUrl === customBackgroundCandidate ||
      failedBackgroundUrl === customBackgroundCandidate
    ) {
      return;
    }

    const image = new window.Image();
    image.onload = () => setLoadedBackgroundUrl(customBackgroundCandidate);
    image.onerror = () => setFailedBackgroundUrl(customBackgroundCandidate);
    image.src = customBackgroundCandidate;
  }, [customBackgroundCandidate, loadedBackgroundUrl, failedBackgroundUrl]);

  const usesCustomBackground = customBackgroundStatus === "ready";

  const themeVariables: Record<string, string> = {
    "--office-accent": theme.accent,
    "--office-sidebar-start": theme.sidebarStart,
    "--office-sidebar-mid": theme.sidebarMid,
    "--office-sidebar-end": theme.sidebarEnd,
    "--office-sidebar-hover": theme.sidebarHover,
    "--office-workspace-tint": theme.workspaceTint,
    "--office-workspace-tint-strong": theme.workspaceTintStrong,
    "--office-accent-soft": theme.accentSoft,
    "--office-border-accent": theme.borderAccent,
    // The existing sidebar gradient variables are overridden so the untouched
    // navigation consumes the derived office shades.
    "--sidebar-blue": theme.sidebarStart,
    "--sidebar-teal": theme.sidebarMid,
    "--sidebar-green": theme.sidebarEnd,
  };

  const workspaceBackground: Record<string, string> = usesCustomBackground
    ? {
        backgroundColor: theme.workspaceTint,
        backgroundImage: `url("${loadedBackgroundUrl ?? ""}")`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }
    : theme.isDefault
      ? // No configured accent: keep the existing application background.
        { backgroundColor: "var(--background)" }
      : {
          // DEFAULT_PREMIUM with a configured accent: a subtle light
          // multi-stop gradient derived from the same accent.
          backgroundColor: theme.workspaceTint,
          backgroundImage: `linear-gradient(180deg, ${theme.workspaceTint} 0%, #FFFFFF 45%, ${theme.workspaceTintStrong} 100%)`,
        };

  const shellStyle = {
    ...themeVariables,
    ...workspaceBackground,
  } as CSSProperties;

  return (
    <div
      className="office-theme-shell relative min-h-screen overflow-x-hidden text-foreground"
      style={shellStyle}
    >
      {usesCustomBackground ? (
        <div
          aria-hidden="true"
          className="office-theme-shell-overlay pointer-events-none absolute inset-0"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.88)" }}
        />
      ) : null}

      <div className="relative z-10 mx-auto flex min-h-screen w-full flex-col px-5 py-5 sm:px-8 lg:h-screen lg:min-h-0 lg:overflow-hidden">
        {children}
      </div>
    </div>
  );
}
